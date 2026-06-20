const { ask } = require('../ai-agent');
const { getPrices } = require('../market-api');

async function findBestFlips(budget, server = 'west') {
  const watchlist = [
    'T5_BAG', 'T6_BAG', 'T5_CAPE', 'T6_CAPE',
    'T6_2H_CURSEDSTAFF', 'T7_MAIN_NATURESTAFF',
    'T6_HEAD_PLATE_SET1', 'T7_ARMOR_LEATHER_SET1',
  ];

  const prices = await getPrices(watchlist, server);
  if (prices.error) return { error: prices.error };

  return ask(
    `With a budget of ${budget} silver, identify the best market flip opportunities 
     from this price data. Rank by estimated profit after tax, note transport risk per route, 
     and flag any items with thin margins. Be specific with city names and silver amounts.`,
    prices.data,
    'market'
  );
}

async function analyzeTrend(itemQuery, location = 'Caerleon') {
  const { getPriceHistory } = require('../market-api');
  const history = await getPriceHistory(itemQuery, location, 48);
  if (history.error) return { error: history.error };

  return ask(
    `Analyze this 48-hour price history for "${itemQuery}" in ${location}. 
     Is the trend bullish, bearish, or stable? When is the best time to buy or sell? 
     What might be driving the price movement?`,
    history.data,
    'market'
  );
}

module.exports = { findBestFlips, analyzeTrend };