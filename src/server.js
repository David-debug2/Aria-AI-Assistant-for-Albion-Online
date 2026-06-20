// src/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { ask } = require('./ai-agent');
const { getPrices, getPriceHistory } = require('./market-api');
const { calculateCraftingProfit } = require('./modules/crafting-profit');
const { getTerritoryStrategy, getZvZComposition, getProgressionRoadmap } = require('./modules/guild-strategist');
const { stats: cacheStats } = require('./market-cache');
const config = require('../config/config');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// --- Error Handler Middleware ---
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// --- AI Chat Endpoint ---
app.post('/api/ask', async (req, res) => {
  try {
    const { query, itemQueries, server } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({ error: 'Query must be at least 3 characters.' });
    }

    let liveData = null;
    if (itemQueries && Array.isArray(itemQueries) && itemQueries.length > 0) {
      const prices = await getPrices(itemQueries, server || 'west');
      if (!prices.error) liveData = prices.data;
    }

    const result = await ask(query.trim(), liveData);
    res.json(result);
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: 'AI service temporarily unavailable' });
  }
});

// --- Single Item Price Endpoint ---
app.get('/api/price/:item', async (req, res) => {
  try {
    const { item } = req.params;
    const { server = 'west', location = 'Caerleon' } = req.query;

    if (!item || item.trim().length < 2) {
      return res.status(400).json({ error: 'Item name too short' });
    }

    const result = await getPrices([item], server, [location]);
    if (result.error) {
      return res.status(503).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Price lookup error:', err.message);
    res.status(500).json({ error: 'Price lookup failed' });
  }
});

// --- Market Prices Endpoint (batch) ---
app.post('/api/prices', async (req, res) => {
  try {
    const { items, server, locations } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array required' });
    }

    const result = await getPrices(items, server || 'west', locations);
    res.json(result);
  } catch (err) {
    console.error('Prices endpoint error:', err.message);
    res.status(500).json({ error: 'Price batch lookup failed' });
  }
});

// --- Price History Endpoint ---
app.get('/api/history/:item', async (req, res) => {
  try {
    const { item } = req.params;
    const { location = 'Caerleon', timescale = '24' } = req.query;

    if (!item || item.trim().length < 2) {
      return res.status(400).json({ error: 'Item name too short' });
    }

    const ts = Math.min(Math.max(parseInt(timescale), 6), 48);
    const result = await getPriceHistory(item, location, ts);

    if (result.error) {
      return res.status(503).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('History endpoint error:', err.message);
    res.status(500).json({ error: 'History lookup failed' });
  }
});

// --- Crafting Profit Calculator ---
app.post('/api/crafting-profit', async (req, res) => {
  try {
    const { item, enchantmentLevel = 0, server = 'west', location = 'Caerleon' } = req.body;

    if (!item || typeof item !== 'string' || item.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Item name required (min 2 chars)' });
    }

    const level = Math.max(0, Math.min(parseInt(enchantmentLevel), 3));
    const result = await calculateCraftingProfit(item, { server, location, enchantmentLevel: level });

    res.json(result);
  } catch (err) {
    console.error('Crafting profit error:', err.message);
    res.status(500).json({ success: false, error: 'Profit calculation failed' });
  }
});

// --- Guild Territory Strategy ---
app.post('/api/guild/territory-strategy', (req, res) => {
  try {
    const { members = 30, treasury = 100000, experience = 'beginner' } = req.body;

    const result = getTerritoryStrategy({
      members: Math.max(1, parseInt(members)),
      treasury: Math.max(0, parseInt(treasury)),
      experience,
    });

    res.json(result);
  } catch (err) {
    console.error('Territory strategy error:', err.message);
    res.status(500).json({ error: 'Territory strategy failed' });
  }
});

// --- ZvZ Composition Advisor ---
app.get('/api/guild/zvz-composition/:scale', (req, res) => {
  try {
    const { scale } = req.params;

    if (!['small', 'medium', 'large'].includes(scale)) {
      return res.status(400).json({ error: 'Scale must be: small, medium, or large' });
    }

    const result = getZvZComposition(scale);
    res.json(result);
  } catch (err) {
    console.error('ZvZ composition error:', err.message);
    res.status(500).json({ error: 'ZvZ composition failed' });
  }
});

// --- Guild Progression Roadmap ---
app.post('/api/guild/progression-roadmap', (req, res) => {
  try {
    const { members = 20, experience = 'beginner', territories = 0 } = req.body;

    const result = getProgressionRoadmap({
      members: Math.max(1, parseInt(members)),
      experience,
      territories: Math.max(0, parseInt(territories)),
    });

    res.json(result);
  } catch (err) {
    console.error('Progression roadmap error:', err.message);
    res.status(500).json({ error: 'Progression roadmap failed' });
  }
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    config: {
      env: config.env,
      aiModel: config.ai.primaryModel,
    },
    cache: cacheStats(),
  });
});

// --- Graceful Error Handling ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, HOST, () => {
  console.log(`⚔️  Aria running at http://${HOST}:${PORT}`);
  console.log(`📚 Knowledge base: ${config.brain.filePath}`);
  console.log(`🤖 AI Model: ${config.ai.primaryModel}`);
});