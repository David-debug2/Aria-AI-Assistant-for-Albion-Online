const { ask } = require('../ai-agent');
const { getPrices } = require('../market-api');
const {
  DEFAULT_MARKET_TAX_RATE,
  calculateMargin,
  formatMarginPercent,
  roundCurrency,
} = require('./calc-helpers');

function computeFlipOpportunities(priceData, budget, taxRate = DEFAULT_MARKET_TAX_RATE) {
  const byItem = new Map();

  for (const entry of priceData || []) {
    if (!entry?.item_id) continue;
    const records = byItem.get(entry.item_id) || [];
    records.push(entry);
    byItem.set(entry.item_id, records);
  }

  return Array.from(byItem.entries())
    .map(([itemId, records]) => {
      const buySide = records
        .filter(entry => entry.sell_price_min > 0)
        .sort((a, b) => a.sell_price_min - b.sell_price_min)[0];
      const sellSide = records
        .filter(entry => entry.buy_price_max > 0)
        .sort((a, b) => b.buy_price_max - a.buy_price_max)[0];

      if (!buySide || !sellSide) return null;

      const buyPrice = buySide.sell_price_min;
      const sellPrice = sellSide.buy_price_max;
      const margin = calculateMargin({
        cost: buyPrice,
        revenue: sellPrice,
        taxRate,
        taxBase: 'revenue',
      });
      const maxUnits = buyPrice > 0 ? Math.floor(budget / buyPrice) : 0;

      return {
        itemId,
        buyLocation: buySide.city,
        sellLocation: sellSide.city,
        buyPrice: roundCurrency(buyPrice),
        sellPrice: roundCurrency(sellPrice),
        spread: roundCurrency(sellPrice - buyPrice),
        tax: roundCurrency(margin.tax),
        profitPerUnit: roundCurrency(margin.profit),
        margin: formatMarginPercent(margin.margin),
        maxUnits,
        totalProfit: roundCurrency(margin.profit * maxUnits),
        profitable: margin.profit > 0,
        thinMargin: margin.margin > 0 && margin.margin < 5,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.totalProfit !== a.totalProfit) return b.totalProfit - a.totalProfit;
      if (b.profitPerUnit !== a.profitPerUnit) return b.profitPerUnit - a.profitPerUnit;
      return a.itemId.localeCompare(b.itemId);
    })
    .map((opportunity, index) => ({
      rank: index + 1,
      ...opportunity,
    }));
}

function computeTrendSummary(historyData, taxRate = DEFAULT_MARKET_TAX_RATE) {
  const series = Array.isArray(historyData) ? historyData[0] : null;
  const points = Array.isArray(series?.data) ? series.data : [];
  const chronological = [...points]
    .filter(point => Number(point.avg_price) > 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (chronological.length === 0) {
    return {
      itemId: series?.item_id || null,
      location: series?.location || null,
      points: [],
      error: 'No usable price history points',
    };
  }

  const first = chronological[0];
  const latest = chronological[chronological.length - 1];
  const low = chronological.reduce((best, point) => (
    point.avg_price < best.avg_price ? point : best
  ), chronological[0]);
  const high = chronological.reduce((best, point) => (
    point.avg_price > best.avg_price ? point : best
  ), chronological[0]);
  const margin = calculateMargin({
    cost: low.avg_price,
    revenue: high.avg_price,
    taxRate,
    taxBase: 'revenue',
  });
  const priceChange = latest.avg_price - first.avg_price;
  const priceChangePercent = first.avg_price === 0 ? 0 : (priceChange / first.avg_price) * 100;

  return {
    itemId: series?.item_id || null,
    location: series?.location || null,
    pointCount: chronological.length,
    firstPrice: roundCurrency(first.avg_price),
    latestPrice: roundCurrency(latest.avg_price),
    priceChange: roundCurrency(priceChange),
    priceChangePercent: formatMarginPercent(priceChangePercent),
    lowPrice: roundCurrency(low.avg_price),
    lowTimestamp: low.timestamp,
    highPrice: roundCurrency(high.avg_price),
    highTimestamp: high.timestamp,
    spread: roundCurrency(high.avg_price - low.avg_price),
    tax: roundCurrency(margin.tax),
    profitAfterTax: roundCurrency(margin.profit),
    margin: formatMarginPercent(margin.margin),
    direction: priceChangePercent > 2 ? 'bullish' : priceChangePercent < -2 ? 'bearish' : 'stable',
  };
}

async function findBestFlips(budget, server = 'west') {
  const watchlist = [
    'T5_BAG', 'T6_BAG', 'T5_CAPE', 'T6_CAPE',
    'T6_2H_CURSEDSTAFF', 'T7_MAIN_NATURESTAFF',
    'T6_HEAD_PLATE_SET1', 'T7_ARMOR_LEATHER_SET1',
  ];

  const prices = await getPrices(watchlist, server);
  if (prices.error) return { error: prices.error };
  const rankedOpportunities = computeFlipOpportunities(prices.data, budget);

  return ask(
    `Narrate this precomputed ranked list of market flip opportunities for a ${budget} silver budget.
     Do not calculate or change any arithmetic. Use the provided ranks, profit figures, margins, routes,
     and thin-margin flags. Note transport risk per route and be specific with city names and silver amounts.`,
    {
      budget,
      taxRate: DEFAULT_MARKET_TAX_RATE,
      rankedOpportunities,
    },
    'summarize'
  );
}

async function analyzeTrend(itemQuery, location = 'Caerleon') {
  const { getPriceHistory } = require('../market-api');
  const history = await getPriceHistory(itemQuery, location, 48);
  if (history.error) return { error: history.error };
  const trendSummary = computeTrendSummary(history.data);

  return ask(
    `Narrate this precomputed 48-hour price trend summary for "${itemQuery}" in ${location}.
     Do not calculate or change any arithmetic. Use the provided direction, price change,
     buy/sell timing, spread, margin, and profit-after-tax figures. Briefly mention plausible market drivers.`,
    trendSummary,
    'summarize'
  );
}

module.exports = {
  findBestFlips,
  analyzeTrend,
  computeFlipOpportunities,
  computeTrendSummary,
};
