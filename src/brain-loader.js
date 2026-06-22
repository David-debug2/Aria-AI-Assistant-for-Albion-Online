// src/brain-loader.js
// Maps user query intent to brain files and builds a trimmed AI context string.

const fs = require('fs');
const path = require('path');
const config = require('../config/config.js');

const BRAIN_DIR = path.join(__dirname, '../albion-brain');

// --- Keyword → Brain File Mapping ---
const MODULE_MAP = {
  market: [
    '5_economy_market.md',
    '6_crafting_refining.md',
  ],
  crafting: [
    '6_crafting_refining.md',
    '5_economy_market.md',
    '7_farming_islands.md',
  ],
  build: [
    '8_weapons_armor.md',
    '3_pve_activities.md',
    '4_pvp_factions_zvz.md',
  ],
  pvp: [
    '4_pvp_factions_zvz.md',
    '8_weapons_armor.md',
    '2_world_zones_mists.md',
  ],
  pve: [
    '3_pve_activities.md',
    '8_weapons_armor.md',
    '2_world_zones_mists.md',
  ],
  zone: [
    '2_world_zones_mists.md',
    '3_pve_activities.md',
    '4_pvp_factions_zvz.md',
  ],
  guild: [
    '9_guild_management.md',
    '4_pvp_factions_zvz.md',
    '5_economy_market.md',
  ],
  farming: [
    '7_farming_islands.md',
    '6_crafting_refining.md',
    '5_economy_market.md',
  ],
  beginner: [
    '1_basics_progression.md',
    '2_world_zones_mists.md',
    '3_pve_activities.md',
  ],
};

// Fixed Intent Order: Highly specific operational targets (like farming/crafting) 
// are checked first before falling back to generalized text groups.
const INTENT_KEYWORDS = [
  { intent: 'farming',   keywords: ['island', 'crop', 'animal', 'pasture', 'herb', 'seed', 'grove', 'carrots', 'breeding'] },
  { intent: 'crafting',  keywords: ['craft', 'refine', 'refining', 'journal', 'focus', 'crafted', 'recipe'] },
  { intent: 'market',    keywords: ['market', 'price', 'silver', 'flip', 'profit', 'buy', 'sell', 'trade', 'tax', 'shop'] },
  { intent: 'guild',     keywords: ['guild', 'alliance', 'territory', 'hq', 'war', 'claim', 'hideout', 'season', 'points'] },
  { intent: 'pvp',       keywords: ['pvp', 'gank', 'hellgate', 'zvz', 'zerg', 'pk', 'fight', 'kill', 'outnumbered', 'faction'] },
  { intent: 'pve',       keywords: ['pve', 'dungeon', 'solo dungeon', 'chest', 'mob', 'boss', 'loot', 'harvest', 'expedition', 'fame farm', 'fame-farm'] },
  { intent: 'zone',      keywords: ['zone', 'map', 'mists', 'roads', 'black zone', 'yellow zone', 'red zone', 'blue zone', 'royal', 'outland'] },
  { intent: 'build',     keywords: ['build', 'gear', 'loadout', 'weapon', 'armor', 'helmet', 'boots', 'off-hand', 'spell', 'ability', 'rotation'] },
  { intent: 'beginner',  keywords: ['start', 'new', 'beginner', 'newbie', 'tutorial', 'learn', 'getting started', 'first time'] },
];

// Expanded Context Bound: Scaled up to 64,000 characters (~16,000 tokens)
// to comfortably match Gemini and DeepSeek capabilities.
const MAX_CONTEXT_CHARS = 64000;

/**
 * Parse a markdown file into header-delimited chunks. Splits on lines starting
 * with `##` or `###` and returns an array of `{ heading, content, sourceFile }`.
 *
 * @param {string} markdown
 * @param {string} sourceFile
 * @returns {Array<{heading:string,content:string,sourceFile:string}>}
 */
function parseMarkdownToChunks(markdown, sourceFile) {
  const lines = markdown.split(/\r?\n/);
  const chunks = [];

  let currentHeading = null;
  let buffer = [];

  // Skip top-level title lines that start with a single '#'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Only split on '## ' (two hashes) so that '###' subheadings remain inside a chunk
    const headerMatch = line.match(/^##\s+(.*)$/);

    if (headerMatch) {
      // If we have an existing buffer before the first header, keep it.
      if (currentHeading !== null) {
        chunks.push({ heading: currentHeading, content: buffer.join('\n').trim(), sourceFile });
      } else if (buffer.length > 0) {
        chunks.push({ heading: '', content: buffer.join('\n').trim(), sourceFile });
      }

      currentHeading = headerMatch[1].trim();
      buffer = [];
      continue;
    }

    // Lines before the first '##' header are grouped under a null heading
    buffer.push(line);
  }

  // Flush the final buffer
  if (currentHeading !== null) {
    chunks.push({ heading: currentHeading, content: buffer.join('\n').trim(), sourceFile });
  } else if (buffer.length > 0) {
    // Entire file had no '##' headers — return as single chunk
    chunks.push({ heading: '', content: buffer.join('\n').trim(), sourceFile });
  }

  return chunks;
}

function scoreChunk(chunk, intent) {
  const keywords = (config.brain && config.brain.intentKeywords && config.brain.intentKeywords[intent]) || [];
  const lowerContent = `${chunk.heading} ${chunk.content}`.toLowerCase();

  return keywords.reduce((score, keyword) => {
    if (!keyword || typeof keyword !== 'string') return score;
    const term = keyword.toLowerCase();
    return score + (lowerContent.includes(term) ? 1 : 0);
  }, 0);
}

function selectTopChunks(chunks, intent, k = 6) {
  const scored = chunks
    .map((chunk, index) => ({
      ...chunk,
      score: scoreChunk(chunk, intent),
      order: index,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    });

  return scored.slice(0, k);
}

function buildContextFromChunks(chunks) {
  const contextPieces = [];
  let totalLength = 0;

  for (const chunk of chunks) {
    const header = `\n\n### ALBION KNOWLEDGE — ${chunk.sourceFile.replace('.md', '').toUpperCase()} — ${chunk.heading} ###\n\n`;
    const piece = header + chunk.content;
    const nextLength = totalLength + piece.length;

    if (nextLength > MAX_CONTEXT_CHARS) break;

    contextPieces.push(piece);
    totalLength = nextLength;
  }

  return contextPieces.join('');
}

/**
 * Detect the primary intent of a user query using word boundaries or explicit substrings.
 *
 * @param {string} query
 * @returns {string}
 */
function detectIntent(query) {
  const q = query.toLowerCase().trim();

  for (const { intent, keywords } of INTENT_KEYWORDS) {
    // Uses plain string lookups but prioritizes the sorted sequence to prevent clashes
    if (keywords.some(kw => q.includes(kw))) {
      return intent;
    }
  }

  return 'build'; 
}

/**
 * Load brain files for a given intent and return an accurate, budget-capped context string.
 *
 * @param {string} query - The user's raw query
 * @param {string|null} forceIntent - Override auto-detection (optional)
 * @returns {{ context: string, intent: string, filesLoaded: string[] }}
 */
function loadBrainContext(query, forceIntent = null) {
  const intent = forceIntent || detectIntent(query);
  const files = MODULE_MAP[intent] || MODULE_MAP['build'];
  const loaded = [];
  const chunks = [];

  for (const filename of files) {
    const filePath = path.join(BRAIN_DIR, filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`Brain file missing: ${filename}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8').trim();
    const fileChunks = parseMarkdownToChunks(content, filename);

    for (const chunk of fileChunks) {
      chunks.push(chunk);
    }

    loaded.push(filename);
  }

  const topChunks = selectTopChunks(chunks, intent, 6);
  const context = buildContextFromChunks(topChunks);
  const filesLoaded = Array.from(new Set(topChunks.map(c => c.sourceFile)));

  return { context, intent, filesLoaded };
}

module.exports = { loadBrainContext, detectIntent, parseMarkdownToChunks };