const { ask } = require('../ai-agent');
const { resolveItem, extractAndResolve } = require('../item-resolver');
const { getWeaponStats, getArmorStats, getSpells } = require('../openalbion-loader');

const ROLE_CANDIDATES = {
  dps: ['T5_MAIN_SWORD', 'T5_2H_AXE', 'T5_2H_BOW', 'T6_MAIN_FIRESTAFF'],
  tank: ['T5_MAIN_MACE', 'T5_2H_HAMMER', 'T5_ARMOR_PLATE_SET1'],
  healer: ['T5_MAIN_HOLYSTAFF', 'T5_MAIN_NATURESTAFF', 'T5_ARMOR_CLOTH_SET1'],
  support: ['T5_MAIN_ARCANESTAFF', 'T5_MAIN_CURSEDSTAFF', 'T5_ARMOR_CLOTH_SET1'],
};

function compactEntry(identifier) {
  const normalStats =
    getWeaponStats(identifier, 'Normal', 0) ||
    getArmorStats(identifier, 'Normal', 0);
  const spells = getSpells(identifier);

  if (!normalStats && !spells) return null;
  return { identifier, normalStats, spells };
}

function resolveIdentifiersFromText(text) {
  const identifiers = new Set();

  for (const result of extractAndResolve(text)) {
    if (result.resolved?.id) identifiers.add(result.resolved.id);
  }

  const direct = resolveItem(text);
  if (direct?.id) identifiers.add(direct.id);

  return [...identifiers];
}

function buildLiveData(role, content, enemyBuild = '') {
  try {
    const normalizedRole = String(role || '').toLowerCase();
    const inferred = Object.entries(ROLE_CANDIDATES)
      .filter(([key]) => normalizedRole.includes(key))
      .flatMap(([, ids]) => ids);
    const resolved = resolveIdentifiersFromText(`${role || ''} ${content || ''} ${enemyBuild || ''}`);
    const identifiers = [...new Set([...resolved, ...inferred])];
    const items = identifiers.map(compactEntry).filter(Boolean);
    return items.length ? { source: 'openalbion', items } : null;
  } catch (err) {
    console.warn(`Build live data unavailable: ${err.message}`);
    return null;
  }
}

async function getBuild(role, content, budget) {
  const liveData = buildLiveData(role, content);
  return ask(
    `Create a complete Albion Online build for a ${role} doing ${content} with a budget of ${budget} silver.
     
     Build the answer in this order:
     1. Classify the role as frontline, backline, support, or hybrid and name the build's win condition.
     2. Select weapon, off-hand, helmet, chest, boots, cape, bag, food, and potion around that win condition.
     3. Give spell rotation and budget notes after the final gear list.
     Put the role/win-condition reasoning in summary and each gear-slot reason, then keep the gear list concrete.`,
    liveData,
    'build'
  );
}

async function counterBuild(enemyBuild) {
  const liveData = buildLiveData('', '', enemyBuild);
  return ask(
    `How do I counter a player running "${enemyBuild}" in open-world PvP?
     Give 2-3 counter builds with gear lists.
     For each counter, separate the countering mechanic from the final gear list:
     1. First explain the mechanic being countered and your answer to it (purge, interrupt, reflect, kite, burst window, cleanse, or sustain denial).
     2. Then list the exact weapon, off-hand, helmet, chest, boots, cape, food, and potion.
     3. Then give the rotation and the tradeoff or warning.
     Put "Countering mechanic:" before the mechanic explanation in summary or gear reasons, and put "Final gear:" before the concrete item list.`,
    liveData,
    'pvp'
  );
}

module.exports = { getBuild, counterBuild };
