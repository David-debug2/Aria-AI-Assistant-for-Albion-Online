const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.ARIA_DATA_DIR || path.join(__dirname, '../data');
const FETCH_HINT = 'Run: npm run fetch-openalbion';

let cache = null;

function readJsonFile(filename, fallback) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`OpenAlbion data file missing: ${filename}. ${FETCH_HINT}`);
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeQuality(quality) {
  return String(quality || 'Normal').toLowerCase();
}

function normalizeEnchantment(enchantment) {
  const numeric = Number(enchantment);
  return Number.isFinite(numeric) ? numeric : 0;
}

function statKey(identifier, quality, enchantment) {
  return `${identifier}|${normalizeQuality(quality)}|${normalizeEnchantment(enchantment)}`;
}

function addStats(index, rows) {
  for (const row of rows) {
    if (!row?.identifier) continue;
    index.set(statKey(row.identifier, row.quality, row.enchantment), row);
  }
}

function groupSpellsByIdentifier(rows) {
  const grouped = new Map();

  for (const spell of rows) {
    if (!spell?.identifier) continue;
    if (!grouped.has(spell.identifier)) grouped.set(spell.identifier, {});

    const bySlot = grouped.get(spell.identifier);
    const slot = spell.slot || 'Unknown';
    if (!bySlot[slot]) bySlot[slot] = [];
    bySlot[slot].push(spell);
  }

  return grouped;
}

function loadData() {
  if (cache) return cache;

  const weaponStats = readJsonFile('openalbion-weapon-stats.json', []);
  const armorStats = readJsonFile('openalbion-armor-stats.json', []);
  const spells = readJsonFile('openalbion-spells.json', { weapons: [], armors: [] });

  const weaponIndex = new Map();
  const armorIndex = new Map();
  addStats(weaponIndex, Array.isArray(weaponStats) ? weaponStats : []);
  addStats(armorIndex, Array.isArray(armorStats) ? armorStats : []);

  const spellRows = [
    ...(Array.isArray(spells.weapons) ? spells.weapons : []),
    ...(Array.isArray(spells.armors) ? spells.armors : []),
  ];

  cache = {
    weaponIndex,
    armorIndex,
    spellIndex: groupSpellsByIdentifier(spellRows),
  };
  return cache;
}

function getWeaponStats(identifier, quality = 'Normal', enchantment = 0) {
  return loadData().weaponIndex.get(statKey(identifier, quality, enchantment)) || null;
}

function getArmorStats(identifier, quality = 'Normal', enchantment = 0) {
  return loadData().armorIndex.get(statKey(identifier, quality, enchantment)) || null;
}

function getSpells(identifier) {
  return loadData().spellIndex.get(identifier) || null;
}

function __resetForTests() {
  cache = null;
}

module.exports = {
  getWeaponStats,
  getArmorStats,
  getSpells,
  __resetForTests,
};
