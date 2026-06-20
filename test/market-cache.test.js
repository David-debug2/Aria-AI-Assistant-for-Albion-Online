// test/market-cache.test.js
const test = require('node:test');
const assert = require('node:assert');
const { getCached, setCached, stats } = require('../src/market-cache');

test('Market Cache', async (t) => {
  await t.test('should store and retrieve data', () => {
    setCached('test-key', { value: 123 });
    const result = getCached('test-key');
    assert.deepStrictEqual(result, { value: 123 }, 'Should retrieve stored value');
  });

  await t.test('should return null for missing keys', () => {
    const result = getCached('nonexistent-key-' + Date.now());
    assert.strictEqual(result, null, 'Should return null for missing keys');
  });

  await t.test('should respect TTL expiration', (t) => {
    // Set data with 100ms TTL
    setCached('expiring-key', { value: 'temp' }, 100);
    const before = getCached('expiring-key');
    assert(before, 'Should exist before TTL');

    // Wait for expiration
    setTimeout(() => {
      const after = getCached('expiring-key');
      assert.strictEqual(after, null, 'Should be null after TTL');
      t.pass();
    }, 150);
  });

  await t.test('should track stats', () => {
    setCached('stat-test', { data: 'value' });
    getCached('stat-test'); // hit
    getCached('missing-stat'); // miss

    const cache_stats = stats();
    assert(cache_stats.size >= 0, 'Should report cache size');
    assert(cache_stats.hits >= 1, 'Should track hits');
  });

  await t.test('should handle large data', () => {
    const largeData = Array(10000).fill({ item: 'data' });
    setCached('large-key', largeData);
    const retrieved = getCached('large-key');
    assert.strictEqual(retrieved.length, 10000, 'Should handle large arrays');
  });
});
