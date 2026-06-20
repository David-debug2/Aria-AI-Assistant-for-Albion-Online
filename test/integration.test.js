// test/integration.test.js
const test = require('node:test');
const assert = require('node:assert');
const { resolveItem } = require('../src/item-resolver');
const { getTerritoryStrategy } = require('../src/modules/guild-strategist');

test('Integration Tests', async (t) => {
  await t.test('end-to-end: resolve item -> get strategy', async () => {
    // Resolve an item
    const item = resolveItem('T5 sword');
    assert(item, 'Should resolve sword');

    // Get guild strategy
    const strategy = getTerritoryStrategy({
      members: 50,
      treasury: 500000,
      experience: 'intermediate',
    });

    assert(strategy.recommendation, 'Should get strategy');
    assert(strategy.readiness !== undefined, 'Should assess readiness');
  });

  await t.test('error handling: invalid inputs don\'t crash', async () => {
    try {
      const item1 = resolveItem('');
      const item2 = resolveItem(null);
      const item3 = resolveItem(undefined);
      // Should not throw, just return null
      assert(true, 'Should handle edge cases gracefully');
    } catch (err) {
      assert.fail('Should not throw on invalid input');
    }
  });

  await t.test('data consistency: resolved items match expected format', () => {
    const item = resolveItem('holy staff');
    if (item) {
      assert(typeof item.id === 'string', 'ID should be string');
      assert(typeof item.name === 'string', 'Name should be string');
      assert(typeof item.score === 'number', 'Score should be number');
      assert(item.score >= 0 && item.score <= 1, 'Score should be 0-1');
    }
  });
});
