// src/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { ask } = require('./ai-agent');
const { getPrices, getPriceHistory } = require('./market-api');
const { stats: cacheStats } = require('./market-cache');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- AI Chat Endpoint ---
app.post('/api/ask', async (req, res) => {
  const { query, itemQueries, server } = req.body;

  if (!query || query.trim().length < 3) {
    return res.status(400).json({ error: 'Query too short.' });
  }

  let liveData = null;
  if (itemQueries && itemQueries.length > 0) {
    const prices = await getPrices(itemQueries, server || 'west');
    if (!prices.error) liveData = prices.data;
  }

  try {
    const result = await ask(query, liveData);
    res.json(result);
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: 'AI agent failed. Check server logs.' });
  }
});

// --- Market Prices Endpoint (direct, no AI) ---
app.post('/api/prices', async (req, res) => {
  const { items, server, locations } = req.body;
  const result = await getPrices(items || [], server, locations);
  res.json(result);
});

// --- Price History Endpoint ---
app.get('/api/history/:item', async (req, res) => {
  const { location, timescale } = req.query;
  const result = await getPriceHistory(
    req.params.item,
    location || 'Caerleon',
    parseInt(timescale) || 24
  );
  res.json(result);
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', cache: cacheStats() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Albion AI Platform running at http://localhost:${PORT}`);
});