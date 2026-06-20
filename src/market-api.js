// src/market-api.js
// Fetches live price and history data from the Albion Data Project.
// All responses are cached automatically.

const { resolveItems } = require('./item-resolver');
const { getCached, setCached } = require('./market-cache');

const SERVERS = {
  west:   'https://west.albion-online-data.com',
  east:   'https://east.albion-online-data.com',
  europe: 'https://europe.albion-online-data.com',
};

const DEFAULT_LOCATIONS = ['Caerleon', 'Bridgewatch', 'Martlock', 'Thetford', 'Fort Sterling', 'Lymhurst'];

/**
 * Get current buy/sell prices for a list of items.
 * Accepts either raw item IDs or human-readable names (auto-resolved).
 *
 * @param {string[]} itemQueries - IDs like "T6_MAIN_NATURESTAFF@2" OR names like "tier 6 nature staff"
 * @param {string} server - 'west' | 'east' | 'europe'
 * @param {string[]} locations - City names to check prices in
 */
async function getPrices(
  itemQueries,
  server = 'west',
  locations = DEFAULT_LOCATIONS
) {
  // Separate already-resolved IDs from human text that needs resolving
  const resolvedIds = itemQueries.map(q => {
    if (/^T\d_/.test(q)) return q; // already an ID
    const match = resolveItems([q])[0];
    return match ? match.id : null;
  }).filter(Boolean);

  if (resolvedIds.length === 0) {
    return { error: 'No items could be resolved. Check your item names.' };
  }

  const cacheKey = `prices:${server}:${resolvedIds.join(',')}:${locations.join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) return { data: cached, fromCache: true };

  const base = SERVERS[server] || SERVERS.west;
  const url = `${base}/api/v2/stats/prices/${resolvedIds.join(',')}?locations=${locations.join(',')}&qualities=1,2,3`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    // Filter out entries with no price data
    const filtered = data.filter(
      entry => entry.sell_price_min > 0 || entry.buy_price_max > 0
    );

    setCached(cacheKey, filtered);
    return { data: filtered, fromCache: false };
  } catch (err) {
    return { error: `Market API unavailable: ${err.message}` };
  }
}

/**
 * Get price history for a single item to detect trends.
 *
 * @param {string} itemQuery - ID or human name
 * @param {string} location - Single city name
 * @param {number} timescale - Hours of history (6, 24, 48)
 */
async function getPriceHistory(itemQuery, location = 'Caerleon', timescale = 24) {
  const itemId = /^T\d_/.test(itemQuery)
    ? itemQuery
    : resolveItems([itemQuery])[0]?.id;

  if (!itemId) return { error: `Could not resolve item: ${itemQuery}` };

  const cacheKey = `history:${itemId}:${location}:${timescale}`;
  const cached = getCached(cacheKey);
  if (cached) return { data: cached, fromCache: true };

  const url = `${SERVERS.west}/api/v2/stats/history/${itemId}?locations=${location}&time-scale=${timescale}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    setCached(cacheKey, data, 15 * 60 * 1000); // history cached 15 min
    return { data, fromCache: false };
  } catch (err) {
    return { error: `History API unavailable: ${err.message}` };
  }
}

module.exports = { getPrices, getPriceHistory };