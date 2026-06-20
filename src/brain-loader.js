// src/brain-loader.js
// Maps user query intent to brain files and builds a trimmed AI context string.

const fs = require('fs');
const path = require('path');

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
  
  let context = '';

  for (const filename of files) {
    const filePath = path.join(BRAIN_DIR, filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`Brain file missing: ${filename}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8').trim();
    const header = `\n\n### ALBION KNOWLEDGE — ${filename.replace('.md', '').toUpperCase()} ###\n\n`;
    
    // Dynamic calculation: Measure directly against the actual growing context length
    const remaining = MAX_CONTEXT_CHARS - context.length;
    const minimalThreshold = header.length + 200;

    if (remaining <= minimalThreshold) break; 

    const maxChunkAllowed = remaining - header.length;
    let chunk;

    if (content.length <= maxChunkAllowed) {
      chunk = content; 
    } else {
      // Clean truncation backing down to the nearest newline character boundary
      const truncated = content.slice(0, maxChunkAllowed);
      const lastNewline = truncated.lastIndexOf('\n');
      
      chunk = lastNewline > maxChunkAllowed * 0.7
        ? truncated.slice(0, lastNewline)
        : truncated;
      chunk += '\n\n[...file trimmed to fit context budget]';
    }

    context += header + chunk;
    loaded.push(filename);
  }

  return { context, intent, filesLoaded: loaded };
}

module.exports = { loadBrainContext, detectIntent };