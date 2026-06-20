// test/item-resolver.test.js
const test = require('node:test');
const assert = require('node:assert');
const { resolveItem, resolveItems } = require('../src/item-resolver');

test('Item Resolver - Fuzzy Search', async (t) => {
  await t.test('should resolve tier 5 sword', () => {
    const result = resolveItem('t5 sword');
    assert(result !== null, 'Should find a sword');
    assert(result.id, 'Should have item ID');
    assert(result.score < 0.3, 'Should have good match score (lower is better)');
  });

  await t.test('should resolve nature staff', () => {
    const result = resolveItem('nature staff');
    assert(result !== null, 'Should find nature staff');
    assert(result.id.includes('NATURE'), 'Should be nature-related');
  });

  await t.test('should return null for invalid query', () => {
    const result = resolveItem('xyz invalid item name');
    assert(result === null || result.score > 0.6, 'Should not match or have poor score');
  });

  await t.test('should resolve multiple items', () => {
    const results = resolveItems(['t5 sword', 'plate armor', 'holy staff']);
    assert.strictEqual(results.length, 3, 'Should resolve 3 items');
    assert(results[0] !== null, 'First item should resolve');
  });

  await t.test('should ignore queries under 3 chars', () => {
    const result = resolveItem('ab');
    assert(result === null, 'Should reject short queries');
  });
});
