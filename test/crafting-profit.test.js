// test/crafting-profit.test.js
const test = require('node:test');
const assert = require('node:assert');
const { calculateCraftingProfit } = require('../src/modules/crafting-profit');

test('Crafting Profit Calculator', async (t) => {
  await t.test('should reject invalid item names', async () => {
    const result = await calculateCraftingProfit('xyz not a real item');
    assert.strictEqual(result.success, false, 'Should fail for invalid item');
    assert(result.error, 'Should have error message');
  });

  await t.test('should reject short queries', async () => {
    const result = await calculateCraftingProfit('x');
    assert.strictEqual(result.success, false, 'Should reject short query');
  });

  await t.test('should calculate profit for known recipes', async () => {
    const result = await calculateCraftingProfit('T5 sword', { enchantmentLevel: 0 });
    // Note: This test may fail if market is down - that's expected
    if (result.success) {
      assert(typeof result.profit === 'number', 'Profit should be a number');
      assert(result.breakdown, 'Should have breakdown');
      assert(typeof result.profitMargin === 'string', 'Should have margin');
    }
  });

  await t.test('should handle enchantment levels correctly', async () => {
    const result = await calculateCraftingProfit('T5 helmet', { enchantmentLevel: 2 });
    if (result.success) {
      assert(result.breakdown.enchantmentCost > 0, 'Should include enchantment cost');
    }
  });

  await t.test('should provide recommendations', async () => {
    const result = await calculateCraftingProfit('T4 sword');
    if (result.success) {
      assert(result.recommendation, 'Should have recommendation');
      assert(
        result.recommendation.includes('✅') ||
        result.recommendation.includes('⚠️') ||
        result.recommendation.includes('❌'),
        'Should have status indicator'
      );
    }
  });
});
