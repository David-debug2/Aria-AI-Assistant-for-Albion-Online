const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const fixtureDir = path.join(__dirname, 'fixtures');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aria-openalbion-'));

for (const [source, target] of [
  ['openalbion-weapon-stats.fixture.json', 'openalbion-weapon-stats.json'],
  ['openalbion-armor-stats.fixture.json', 'openalbion-armor-stats.json'],
  ['openalbion-spells.fixture.json', 'openalbion-spells.json'],
]) {
  fs.copyFileSync(path.join(fixtureDir, source), path.join(tempDir, target));
}

process.env.ARIA_DATA_DIR = tempDir;
const loader = require('../src/openalbion-loader');

test('OpenAlbion loader indexes stats and spells', async (t) => {
  await t.test('returns weapon stats for quality and enchantment', () => {
    const stats = loader.getWeaponStats('T4_2H_AXE', 'Normal', 0);
    assert(stats);
    assert.strictEqual(stats.DPS, '79/s');
    assert.strictEqual(stats['Physical damage'], '71');
  });

  await t.test('returns armor stats for quality and enchantment', () => {
    const stats = loader.getArmorStats('T4_ARMOR_PLATE_SET1', 'Normal', 0);
    assert(stats);
    assert.strictEqual(stats.Armor, '218');
  });

  await t.test('groups spells by slot', () => {
    const spells = loader.getSpells('T4_2H_AXE');
    assert(spells);
    assert(Array.isArray(spells['First Slot']));
    assert.strictEqual(spells['First Slot'][0].name, 'Rending Strike');
  });

  await t.test('returns null for missing identifiers', () => {
    assert.strictEqual(loader.getWeaponStats('T8_FAKE', 'Normal', 0), null);
    assert.strictEqual(loader.getSpells('T8_FAKE'), null);
  });
});
