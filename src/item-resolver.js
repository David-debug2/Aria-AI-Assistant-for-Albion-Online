// src/item-resolver.js
// Converts free-text player input into Albion Data Project item IDs using fuzzy search.

const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

let fuse = null;
let itemIndex = [];

function getSearchEngine() {
  if (fuse) return fuse;

  const dataPath = path.join(__dirname, '../data/albion-items.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      'Item data not found. Run: node scripts/fetch-items.js'
    );
  }

  itemIndex = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  fuse = new Fuse(itemIndex, {
    // Search both keys, but heavily weight the normalized searchText string
    keys: [
      { name: 'name', weight: 0.3 },
      { name: 'searchText', weight: 0.7 }
    ],
    threshold: 0.4, // Centralized configuration cutoff point (0 = perfect, 1 = chaotic)
    includeScore: true,
    minMatchCharLength: 3,
  });

  console.log(`Item resolver ready: ${itemIndex.length} items indexed`);
  return fuse;
}

function findExactTierItem(query) {
  const normalized = query.toLowerCase().trim();
  const tierMatch = normalized.match(/\b(?:t|tier\s*)([1-8])\b/);
  if (!tierMatch) return null;

  const enchantMatch = normalized.match(/(?:@|\.)\s*([1-4])\b/);
  const tier = tierMatch[1];
  const enchantment = enchantMatch ? `@${enchantMatch[1]}` : '';

  const weaponAliases = [
    { terms: ['sword', 'broadsword'], itemKey: 'MAIN_SWORD' },
    { terms: ['holy staff'], itemKey: 'MAIN_HOLYSTAFF' },
    { terms: ['nature staff'], itemKey: 'MAIN_NATURESTAFF' },
  ];

  const alias = weaponAliases.find(entry => entry.terms.some(term => normalized.includes(term)));
  if (!alias) return null;

  const id = `T${tier}_${alias.itemKey}${enchantment}`;
  return itemIndex.find(item => item.id === id) || null;
}

/**
 * Resolve a single player-typed term to the best matching item ID.
 *
 * @param {string} query - e.g. "t6 nature staff .2"
 * @returns {{ id: string, name: string, score: number } | null}
 */
function resolveItem(query) {
  if (!query || query.trim().length < 3) return null;
  
  const engine = getSearchEngine();
  const exactMatch = findExactTierItem(query);

  if (exactMatch) {
    return {
      id: exactMatch.id,
      name: exactMatch.name,
      score: 0,
    };
  }

  const results = engine.search(query.toLowerCase().trim());

  if (results.length === 0) return null;

  const best = results[0];

  return {
    id: best.item.id,
    name: best.item.name,
    score: parseFloat(best.score.toFixed(3)),
  };
}

/**
 * Resolve multiple terms at once.
 *
 * @param {string[]} queries
 * @returns {Array<{ id: string, name: string, score: number } | null>}
 */
function resolveItems(queries) {
  return queries.map(q => resolveItem(q));
}

/**
 * Extract item mentions from a block of conversational text and resolve them safely.
 *
 * @param {string} text
 * @returns {Array<{ original: string, resolved: { id, name, score } | null }>}
 */
function extractAndResolve(text) {
  // Pattern captures tier indicators: T4, tier 5, T6.2, t8 .3, etc.
  const tierPattern = /\b(t(?:ier\s*)?\d(?:\s*[\.\@]\s*\d)?)\b/gi;
  const found = [];
  let match;

  while ((match = tierPattern.exec(text)) !== null) {
    // Strategy adjustment: Instead of capturing broad character blocks, 
    // extract an isolated word window (up to 3 words after the tier marker)
    const forwardText = text.slice(match.index);
    const words = forwardText.split(/\s+/).slice(0, 4); // [TierTag, Word1, Word2, Word3]
    
    // Clean out common conversational punctuation (, . ! ?) from the item candidate phrase
    const candidatePhrase = words.join(' ').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();

    found.push({
      original: candidatePhrase,
      resolved: resolveItem(candidatePhrase),
    });
  }

  return found;
}

module.exports = { resolveItem, resolveItems, extractAndResolve };
