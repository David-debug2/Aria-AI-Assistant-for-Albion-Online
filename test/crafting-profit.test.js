const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  calculateCraftingProfit,
  __setRecipeSourcesForTests,
  __setPriceProviderForTests,
  __resetForTests,
} = require('../src/modules/crafting-profit');

test('Crafting Profit Calculator', async (t) => {
  t.afterEach(() => {
    __resetForTests();
  });

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
    if (result.success) {
      assert(typeof result.profit === 'number', 'Profit should be a number');
      assert(result.breakdown, 'Should have breakdown');
      assert(typeof result.profitMargin === 'string', 'Should have margin');
      assert('silverFee' in result.breakdown, 'Should include silver fee field');
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
    }
  });

  await t.test('should load Gameinfo recipes and include silver fee in total cost', async () => {
    const gear = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'fixtures/gameinfo-gear-recipes.fixture.json'), 'utf-8')
    );

    __setRecipeSourcesForTests({ gear, consumables: [] });
    __setPriceProviderForTests(async (itemIds) => {
      const prices = {
        T5_METALBAR: { item_id: 'T5_METALBAR', sell_price_min: 100, buy_price_max: 0 },
        T5_PLANKS: { item_id: 'T5_PLANKS', sell_price_min: 50, buy_price_max: 0 },
        T5_MAIN_SWORD: { item_id: 'T5_MAIN_SWORD', sell_price_min: 0, buy_price_max: 3000 },
      };

      return { data: itemIds.map(id => prices[id]).filter(Boolean) };
    });

    const result = await calculateCraftingProfit('T5 sword', { enchantmentLevel: 0 });

    assert.strictEqual(result.success, true, result.error);
    assert.strictEqual(result.breakdown.ingredientCost, 2000);
    assert.strictEqual(result.breakdown.craftingTax, 180);
    assert.strictEqual(result.breakdown.silverFee, 250);
    assert.strictEqual(result.breakdown.totalCost, 2430);
    assert.strictEqual(result.profit, 570);
    assert.deepStrictEqual(
      result.breakdown.ingredients.map(ingredient => ({
        id: ingredient.id,
        quantity: ingredient.quantity,
      })),
      [
        { id: 'T5_METALBAR', quantity: 16 },
        { id: 'T5_PLANKS', quantity: 8 },
      ]
    );
  });
});
