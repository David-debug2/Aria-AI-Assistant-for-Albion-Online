const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

function loadMarketAnalyzerWithStubs({ getPrices, getPriceHistory, ask }) {
  const marketApiPath = path.resolve(__dirname, '..', 'src', 'market-api.js');
  const aiAgentPath = path.resolve(__dirname, '..', 'src', 'ai-agent.js');
  const analyzerPath = path.resolve(__dirname, '..', 'src', 'modules', 'market-analyzer.js');

  delete require.cache[analyzerPath];
  require.cache[marketApiPath] = {
    id: marketApiPath,
    filename: marketApiPath,
    loaded: true,
    exports: { getPrices, getPriceHistory },
  };
  require.cache[aiAgentPath] = {
    id: aiAgentPath,
    filename: aiAgentPath,
    loaded: true,
    exports: { ask },
  };

  const analyzer = require('../src/modules/market-analyzer');

  return {
    analyzer,
    cleanup() {
      delete require.cache[analyzerPath];
      delete require.cache[marketApiPath];
      delete require.cache[aiAgentPath];
    },
  };
}

test('Market Analyzer computed margins', async (t) => {
  await t.test('should rank profitable flips by deterministic tax-adjusted profit', () => {
    const { computeFlipOpportunities } = require('../src/modules/market-analyzer');
    const ranked = computeFlipOpportunities([
      { item_id: 'T5_BAG', city: 'Bridgewatch', sell_price_min: 1000, buy_price_max: 900 },
      { item_id: 'T5_BAG', city: 'Caerleon', sell_price_min: 1200, buy_price_max: 1400 },
      { item_id: 'T6_BAG', city: 'Martlock', sell_price_min: 2000, buy_price_max: 1800 },
      { item_id: 'T6_BAG', city: 'Thetford', sell_price_min: 2200, buy_price_max: 2100 },
    ], 10000);

    assert.strictEqual(ranked[0].itemId, 'T5_BAG');
    assert.strictEqual(ranked[0].buyLocation, 'Bridgewatch');
    assert.strictEqual(ranked[0].sellLocation, 'Caerleon');
    assert.strictEqual(ranked[0].spread, 400);
    assert.strictEqual(ranked[0].tax, 91);
    assert.strictEqual(ranked[0].profitPerUnit, 309);
    assert.strictEqual(ranked[0].maxUnits, 10);
    assert.strictEqual(ranked[0].totalProfit, 3090);
    assert.strictEqual(ranked[0].profitable, true);
  });

  await t.test('should include loss-making scenarios without asking the model to calculate them', () => {
    const { computeFlipOpportunities } = require('../src/modules/market-analyzer');
    const ranked = computeFlipOpportunities([
      { item_id: 'T5_CAPE', city: 'Lymhurst', sell_price_min: 1000, buy_price_max: 900 },
      { item_id: 'T5_CAPE', city: 'Fort Sterling', sell_price_min: 1050, buy_price_max: 950 },
    ], 5000);

    assert.strictEqual(ranked.length, 1);
    assert.strictEqual(ranked[0].itemId, 'T5_CAPE');
    assert.strictEqual(ranked[0].spread, -50);
    assert.strictEqual(ranked[0].tax, 61);
    assert.strictEqual(ranked[0].profitPerUnit, -112);
    assert.strictEqual(ranked[0].totalProfit, -559);
    assert.strictEqual(ranked[0].profitable, false);
  });

  await t.test('findBestFlips should pass ranked computed JSON to the LLM', async () => {
    let askArgs = null;
    const { analyzer, cleanup } = loadMarketAnalyzerWithStubs({
      getPrices: async () => ({
        data: [
          { item_id: 'T5_BAG', city: 'Bridgewatch', sell_price_min: 1000, buy_price_max: 900 },
          { item_id: 'T5_BAG', city: 'Caerleon', sell_price_min: 1200, buy_price_max: 1400 },
          { item_id: 'T6_BAG', city: 'Martlock', sell_price_min: 2000, buy_price_max: 1800 },
          { item_id: 'T6_BAG', city: 'Thetford', sell_price_min: 2200, buy_price_max: 2100 },
        ],
      }),
      getPriceHistory: async () => ({ data: [] }),
      ask: async (...args) => {
        askArgs = args;
        return { responseType: 'market', response: { items: [] } };
      },
    });
    t.after(cleanup);

    await analyzer.findBestFlips(10000);

    assert(askArgs, 'Should call ask');
    assert.match(askArgs[0], /Do not calculate or change any arithmetic/);
    assert.strictEqual(askArgs[1].rankedOpportunities[0].itemId, 'T5_BAG');
    assert.strictEqual(askArgs[1].rankedOpportunities[0].profitPerUnit, 309);
    assert.strictEqual(askArgs[1].rankedOpportunities[1].profitable, false);
    assert.strictEqual(askArgs[2], 'market');
  });

  await t.test('analyzeTrend should compute spread and tax-adjusted profit before narration', async () => {
    let askArgs = null;
    const { analyzer, cleanup } = loadMarketAnalyzerWithStubs({
      getPrices: async () => ({ data: [] }),
      getPriceHistory: async () => ({
        data: [{
          item_id: 'T5_BAG',
          location: 'Caerleon',
          data: [
            { timestamp: '2026-06-22T00:00:00Z', avg_price: 1000, item_count: 10 },
            { timestamp: '2026-06-22T12:00:00Z', avg_price: 900, item_count: 8 },
            { timestamp: '2026-06-23T00:00:00Z', avg_price: 1200, item_count: 6 },
          ],
        }],
      }),
      ask: async (...args) => {
        askArgs = args;
        return { responseType: 'market', response: { items: [] } };
      },
    });
    t.after(cleanup);

    await analyzer.analyzeTrend('T5_BAG', 'Caerleon');

    assert(askArgs, 'Should call ask');
    assert.match(askArgs[0], /Do not calculate or change any arithmetic/);
    assert.strictEqual(askArgs[1].direction, 'bullish');
    assert.strictEqual(askArgs[1].spread, 300);
    assert.strictEqual(askArgs[1].tax, 78);
    assert.strictEqual(askArgs[1].profitAfterTax, 222);
    assert.strictEqual(askArgs[2], 'market');
  });
});
