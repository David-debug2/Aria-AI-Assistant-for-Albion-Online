// src/market-cache.js
// In-memory cache for market price responses.
// Default TTL: 5 minutes (prices don't change that fast).

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function invalidate(key) {
  cache.delete(key);
}

function clearAll() {
  cache.clear();
}

// Report how many entries are live (useful for a /health endpoint)
function stats() {
  const now = Date.now();
  let live = 0;
  for (const entry of cache.values()) {
    if (entry.expiresAt > now) live++;
  }
  return { total: cache.size, live };
}

module.exports = { getCached, setCached, invalidate, clearAll, stats };