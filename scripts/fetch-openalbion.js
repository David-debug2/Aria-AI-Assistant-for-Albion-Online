// scripts/fetch-openalbion.js
// Build-time data enrichment from OpenAlbion plus Gameinfo recipe data.

const fs = require('fs');
const path = require('path');

const OPENALBION_BASE_URL = 'https://api.openalbion.com/api/v3';
const GAMEINFO_BASE_URL = 'https://gameinfo.albiononline.com/api/gameinfo/items';
const OUT_DIR = path.join(__dirname, '../data');
const REQUEST_DELAY_MS = Number(process.env.OPENALBION_DELAY_MS || 300);
const CONCURRENCY = Number(process.env.OPENALBION_CONCURRENCY || 3);
const FETCH_PHASE = process.env.OPENALBION_PHASE || 'all';

let lastFetchStart = 0;
let activeRequests = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function throttledFetchJson(url) {
  const elapsed = Date.now() - lastFetchStart;
  if (elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }

  lastFetchStart = Date.now();
  activeRequests += 1;
  console.log(`Request start (${activeRequests} in flight): ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    activeRequests -= 1;
    console.log(`Request end (${activeRequests} in flight): ${url}`);
  }
}

async function runWithConcurrency(items, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function writeJson(filename, data) {
  ensureOutDir();
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${filename}`);
}

function readJson(filename, fallback = null) {
  const filePath = path.join(OUT_DIR, filename);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function readArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeListItem(item) {
  return {
    id: item.id,
    name: item.name,
    tier: item.tier,
    item_power: item.item_power,
    identifier: item.identifier,
    info: item.info,
  };
}

function normalizeAttributes(stats = []) {
  if (!Array.isArray(stats)) return {};
  return stats.reduce((acc, stat) => {
    const key = stat.name || stat.label || stat.stat || stat.attribute;
    const value = stat.value ?? stat.amount ?? stat.text;
    if (key !== undefined && value !== undefined) acc[key] = value;
    return acc;
  }, {});
}

function normalizeStatRows(payload, sourceItem, wantedFields) {
  const groups = readArrayPayload(payload);
  const rows = groups.flatMap(group => {
    if (Array.isArray(group.stats) && group.stats.some(stat => Array.isArray(stat.stats))) {
      return group.stats;
    }
    return [group];
  });

  return rows.map(row => {
    const attributes = normalizeAttributes(row.stats || row.attributes);
    const flat = { ...row, ...attributes };
    const normalized = {
      id: sourceItem.id,
      name: row.name || sourceItem.name,
      tier: row.tier || sourceItem.tier,
      identifier: sourceItem.identifier,
      enchantment: row.enchantment ?? row.enchantment_level ?? row.enchant ?? 0,
      quality: row.quality || row.quality_name || 'Normal',
    };

    for (const field of wantedFields) {
      if (flat[field] !== undefined) normalized[field] = flat[field];
    }

    if (flat['Hit Points Regeneration(Bonus)'] !== undefined) {
      normalized['HP Regen'] = flat['Hit Points Regeneration(Bonus)'];
    }

    return normalized;
  });
}

function normalizeConsumableRecipe(payload, sourceItem) {
  const rows = readArrayPayload(payload);
  const recipe = rows[0] || payload || {};
  const requirements = readArrayPayload(recipe.requirements || recipe.resources || recipe.ingredients);

  return {
    id: sourceItem.id,
    name: recipe.name || sourceItem.name,
    tier: recipe.tier || sourceItem.tier,
    identifier: sourceItem.identifier,
    enchantment: recipe.enchantment ?? recipe.enchantment_level ?? 0,
    per_craft: recipe.per_craft ?? recipe.amount ?? 1,
    requirements: requirements.map(requirement => ({
      name: requirement.name,
      value: Number(requirement.value ?? requirement.count ?? requirement.quantity ?? 0),
      identifier: requirement.identifier || requirement.uniqueName || requirement.itemTypeId,
    })).filter(requirement => requirement.identifier && requirement.value > 0),
  };
}

function normalizeSpellRows(payload, sourceItem, type) {
  const rows = readArrayPayload(payload).flatMap(group => (
    Array.isArray(group.spells)
      ? group.spells.map(spell => ({ ...spell, slot: spell.slot || group.slot }))
      : [group]
  ));

  return rows.map(spell => ({
    [`${type}_id`]: sourceItem.id,
    identifier: sourceItem.identifier,
    slot: spell.slot || spell.slot_name || spell.category || spell.position,
    name: spell.name,
    attributes: Array.isArray(spell.attributes)
      ? spell.attributes.map(attribute => ({
          name: attribute.name || attribute.label || attribute.attribute,
          value: attribute.value ?? attribute.amount ?? attribute.text,
        })).filter(attribute => attribute.name !== undefined)
      : Object.entries(normalizeAttributes(spell.stats || [])).map(([name, value]) => ({ name, value })),
    description: spell.description || spell.info || '',
  })).filter(spell => spell.name);
}

function normalizeGameinfoRecipe(payload, sourceItem) {
  const requirements = payload?.craftingRequirements;
  if (!requirements) return null;

  const resources = requirements.craftResourceList || requirements.craftResourceListNonTradable || [];
  if (!Array.isArray(resources) || resources.length === 0) return null;

  return {
    identifier: sourceItem.identifier,
    name: sourceItem.name,
    tier: sourceItem.tier,
    ingredients: resources.map(resource => ({
      uniqueName: resource.uniqueName || resource.itemTypeId || resource.item,
      count: Number(resource.count || resource.amount || 0),
    })).filter(resource => resource.uniqueName && resource.count > 0),
    silverCost: Number(requirements.silver || 0),
    craftingFocus: Number(requirements.craftingFocus || 0),
    craftingTime: Number(requirements.time || 0),
  };
}

async function fetchRequiredList(name, endpoint) {
  console.log(`Fetching ${name}...`);
  const payload = await throttledFetchJson(`${OPENALBION_BASE_URL}${endpoint}`);
  const items = readArrayPayload(payload).map(normalizeListItem).filter(item => item.id && item.identifier);
  console.log(`Fetching ${name}... ${items.length} items`);
  return items;
}

async function fetchOptional(endpoint, item, normalizer, label) {
  try {
    const payload = await throttledFetchJson(endpoint);
    return normalizer(payload, item);
  } catch (err) {
    console.warn(`Warning: skipped ${label} for ${item.identifier || item.id}: ${err.message}`);
    return null;
  }
}

async function main() {
  const startedAt = Date.now();

  try {
    let existingLists = readJson('openalbion-lists.json');
    let weapons = existingLists?.weapons;
    let armors = existingLists?.armors;
    let accessories = existingLists?.accessories;
    let consumables = existingLists?.consumables;

    if (!existingLists || FETCH_PHASE === 'all' || FETCH_PHASE === 'lists') {
      weapons = await fetchRequiredList('weapons', '/weapons');
      armors = await fetchRequiredList('armors', '/armors');
      accessories = await fetchRequiredList('accessories', '/accessories');
      consumables = await fetchRequiredList('consumables', '/consumables');

      const spell_sources = [
        ...weapons.map(item => ({ weapon_id: item.id, identifier: item.identifier })),
        ...armors.map(item => ({ armor_id: item.id, identifier: item.identifier })),
      ];

      console.log(`Queued ${weapons.length} weapon IDs for spell fetch`);
      console.log(`Queued ${armors.length} armor IDs for spell fetch`);
      writeJson('openalbion-lists.json', { weapons, armors, accessories, consumables, spell_sources });
    }

    if (FETCH_PHASE === 'lists') return;

    if (FETCH_PHASE === 'all' || FETCH_PHASE === 'stats') {
      const weaponStats = (await runWithConcurrency(weapons, item =>
      fetchOptional(
        `${OPENALBION_BASE_URL}/weapon-stats/weapon/${item.id}`,
        item,
        (payload, source) => normalizeStatRows(payload, source, [
          'Item Power',
          'Physical damage',
          'Resilience penetration',
          'Max Hit Points',
          'HP Regen',
          'DPS',
        ]),
        'weapon stats'
      )
      )).filter(Boolean).flat();
      writeJson('openalbion-weapon-stats.json', weaponStats);

      const armorStats = (await runWithConcurrency(armors, item =>
      fetchOptional(
        `${OPENALBION_BASE_URL}/armor-stats/armor/${item.id}`,
        item,
        (payload, source) => normalizeStatRows(payload, source, [
          'Item Power',
          'Armor',
          'Magical Resistance',
          'Max Hit Points',
        ]),
        'armor stats'
      )
      )).filter(Boolean).flat();
      writeJson('openalbion-armor-stats.json', armorStats);

      const consumableStats = (await runWithConcurrency(consumables, item =>
      fetchOptional(
        `${OPENALBION_BASE_URL}/consumable-stats/consumable/${item.id}`,
        item,
        (payload, source) => normalizeStatRows(payload, source, [
          'Item Power',
          'Nutrition',
          'Weight',
          'Crafting Speed',
          'Crafting Quality',
        ]),
        'consumable stats'
      )
      )).filter(Boolean).flat();
      writeJson('openalbion-consumable-stats.json', consumableStats);

      const consumableRecipes = (await runWithConcurrency(consumables, item =>
      fetchOptional(
        `${OPENALBION_BASE_URL}/consumable-craftings/consumable/${item.id}`,
        item,
        normalizeConsumableRecipe,
        'consumable recipe'
      )
      )).filter(Boolean);
      writeJson('openalbion-consumable-recipes.json', consumableRecipes);
    }

    if (FETCH_PHASE === 'all' || FETCH_PHASE === 'spells') {
      const weaponSpells = (await runWithConcurrency(weapons, item =>
      fetchOptional(
        `${OPENALBION_BASE_URL}/spells/weapon/${item.id}`,
        item,
        (payload, source) => normalizeSpellRows(payload, source, 'weapon'),
        'weapon spells'
      )
      )).filter(Boolean).flat();

      const armorSpells = (await runWithConcurrency(armors, item =>
      fetchOptional(
        `${OPENALBION_BASE_URL}/spells/armor/${item.id}`,
        item,
        (payload, source) => normalizeSpellRows(payload, source, 'armor'),
        'armor spells'
      )
      )).filter(Boolean).flat();
      writeJson('openalbion-spells.json', { weapons: weaponSpells, armors: armorSpells });
    }

    if (FETCH_PHASE === 'all' || FETCH_PHASE === 'gear-recipes') {
      const gearItems = [...weapons, ...armors].filter(item => item.identifier);
      const gearRecipes = (await runWithConcurrency(gearItems, item =>
      fetchOptional(
        `${GAMEINFO_BASE_URL}/${encodeURIComponent(item.identifier)}/data`,
        item,
        normalizeGameinfoRecipe,
        'gameinfo gear recipe'
      )
      )).filter(Boolean);
      writeJson('gameinfo-gear-recipes.json', gearRecipes);
    }

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`OpenAlbion fetch complete in ${seconds}s`);
  } catch (err) {
    console.error(`OpenAlbion fetch failed: ${err.message}`);
    process.exit(1);
  }
}

main();
