// src/brain-loader.js
// Maps user query intent to relevant markdown sections and builds a trimmed AI context string.

const fs = require('fs');
const path = require('path');
require('dotenv').config({ quiet: true });
const { GoogleGenerativeAI, TaskType } = require('@google/generative-ai');
const config = require('../config/config.js');

const BRAIN_DIR = path.join(__dirname, '../albion-brain');
const DEFAULT_BRAIN_EMBEDDINGS_PATH = path.join(__dirname, '../data/brain-embeddings.json');
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || config.brain?.embeddingModel || 'gemini-embedding-001';
const TOP_K_CHUNKS = 6;
const MAX_CONTEXT_CHARS = config.brain?.maxContextSize || config.ai?.contextBudget || 64000;
let brainEmbeddingIndex = null;
let brainEmbeddingPath = null;
let genAI = null;

// Fixed intent order keeps specific operational targets ahead of broader groups.
const INTENT_ORDER = [
  'farming',
  'crafting',
  'market',
  'guild',
  'pvp',
  'pve',
  'zone',
  'build',
  'beginner',
];

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'best',
  'does',
  'from',
  'have',
  'help',
  'with',
  'what',
  'when',
  'where',
  'which',
  'work',
  'should',
  'your',
]);

function getBrainFiles() {
  if (!fs.existsSync(BRAIN_DIR)) return [];

  return fs.readdirSync(BRAIN_DIR)
    .filter(filename => filename.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Parse a markdown file into section-level chunks. The corpus uses `##` as the
 * section boundary and `###` as nested subsections, so child headings stay with
 * their parent section and tables are never split away from local context.
 *
 * @param {string} markdown
 * @param {string} sourceFile
 * @returns {Array<{heading:string,content:string,sourceFile:string}>}
 */
function parseMarkdownToChunks(markdown, sourceFile) {
  const lines = markdown.split(/\r?\n/);
  const chunks = [];

  let currentHeading = '';
  let buffer = [];

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)$/);

    if (sectionMatch) {
      if (currentHeading || buffer.some(part => part.trim())) {
        chunks.push({
          heading: currentHeading,
          content: buffer.join('\n').trim(),
          sourceFile,
        });
      }

      currentHeading = sectionMatch[1].trim();
      buffer = [];
      continue;
    }

    // Skip the document title. Section headings are supplied separately.
    if (!currentHeading && /^#\s+/.test(line)) continue;
    buffer.push(line);
  }

  if (currentHeading || buffer.some(part => part.trim())) {
    chunks.push({
      heading: currentHeading || sourceFile.replace(/\.md$/i, ''),
      content: buffer.join('\n').trim(),
      sourceFile,
    });
  }

  return chunks.filter(chunk => chunk.content.length > 0);
}

function tokenizeQuery(query) {
  return Array.from(new Set(
    String(query)
      .toLowerCase()
      .match(/[a-z0-9@+-]{3,}/g) || []
  )).filter(term => !STOP_WORDS.has(term));
}

function getIntentKeywords(intent) {
  const configuredKeywords = config.brain?.intentKeywords?.[intent] || [];
  return Array.from(new Set([intent, ...configuredKeywords]));
}

function termMatches(text, term) {
  const normalized = term.toLowerCase();
  if (text.includes(normalized)) return true;

  // Covers common pairs like refine/refining without adding a stemmer dependency.
  if (normalized.endsWith('e') && normalized.length > 4) {
    return text.includes(normalized.slice(0, -1));
  }

  return false;
}

function countTermOverlap(text, terms) {
  return terms.reduce((score, term) => {
    if (!term || typeof term !== 'string') return score;
    return termMatches(text, term) ? score + 1 : score;
  }, 0);
}

function getChunkScore(chunk, intent, query = '') {
  const headingText = chunk.heading.toLowerCase();
  const searchableText = `${chunk.heading}\n${chunk.content}`.toLowerCase();
  const intentKeywords = getIntentKeywords(intent);
  const queryTerms = tokenizeQuery(query);

  const headingQueryScore = countTermOverlap(headingText, queryTerms);
  const queryScore = countTermOverlap(searchableText, queryTerms);
  const intentScore = countTermOverlap(searchableText, intentKeywords);

  return {
    headingQueryScore,
    queryScore,
    intentScore,
    total: (headingQueryScore * 6) + (queryScore * 3) + intentScore,
  };
}

function scoreChunk(chunk, intent, query = '') {
  return getChunkScore(chunk, intent, query).total;
}

function selectTopChunks(chunks, intent, query, k = TOP_K_CHUNKS) {
  const scoredChunks = chunks
    .map((chunk, index) => {
      const scores = getChunkScore(chunk, intent, query);
      return {
        ...chunk,
        ...scores,
        score: scores.total,
        order: index,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    });

  const headingMatches = scoredChunks.filter(chunk => chunk.headingQueryScore > 0);
  if (headingMatches.length > 0) return headingMatches.slice(0, k);

  const queryMatches = scoredChunks.filter(chunk => chunk.queryScore > 0);
  if (queryMatches.length > 0) return queryMatches.slice(0, k);

  const intentMatches = scoredChunks.filter(chunk => chunk.intentScore > 0);
  return (intentMatches.length > 0 ? intentMatches : scoredChunks).slice(0, k);
}

function loadBrainChunks() {
  return getBrainFiles().flatMap(filename => {
    const filePath = path.join(BRAIN_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    return parseMarkdownToChunks(content, filename);
  });
}

function getBrainEmbeddingsPath() {
  return process.env.BRAIN_EMBEDDINGS_PATH || DEFAULT_BRAIN_EMBEDDINGS_PATH;
}

function loadBrainEmbeddings() {
  const dataPath = getBrainEmbeddingsPath();
  if (brainEmbeddingIndex && brainEmbeddingPath === dataPath) return brainEmbeddingIndex;

  if (!fs.existsSync(dataPath)) {
    throw new Error(
      'Brain embeddings not found. Run: npm run embed-brain'
    );
  }

  const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  if (!Array.isArray(parsed)) {
    throw new Error('Brain embeddings file is invalid. Run: npm run embed-brain');
  }

  brainEmbeddingIndex = parsed;
  brainEmbeddingPath = dataPath;
  console.log(`Brain retrieval ready: ${brainEmbeddingIndex.length} chunks indexed`);
  return brainEmbeddingIndex;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;

  const length = Math.min(a.length, b.length);
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;

  for (let i = 0; i < length; i += 1) {
    const aValue = Number(a[i]) || 0;
    const bValue = Number(b[i]) || 0;
    dot += aValue * bValue;
    aMagnitude += aValue * aValue;
    bMagnitude += bValue * bValue;
  }

  if (aMagnitude === 0 || bMagnitude === 0) return 0;
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}

function retrieveChunks(queryEmbedding, k = TOP_K_CHUNKS) {
  return loadBrainEmbeddings()
    .map((chunk, index) => ({
      ...chunk,
      sourceFile: chunk.sourceFile,
      heading: chunk.heading,
      content: chunk.content || chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
      order: index,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    })
    .slice(0, k);
}

async function embedQuery(query) {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not configured');
  }

  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text: String(query || '') }] },
    taskType: TaskType.RETRIEVAL_QUERY,
  });

  return result.embedding.values;
}

function buildContextFromChunks(chunks) {
  const contextPieces = [];
  let totalLength = 0;

  for (const chunk of chunks) {
    const sectionHeading = chunk.heading ? ` - ${chunk.heading}` : '';
    const header = `\n\n### ALBION KNOWLEDGE - ${chunk.sourceFile}${sectionHeading} ###\n\n`;
    const piece = header + chunk.content;

    if (totalLength + piece.length > MAX_CONTEXT_CHARS) break;

    contextPieces.push(piece);
    totalLength += piece.length;
  }

  return contextPieces.join('');
}

/**
 * Detect the primary intent of a user query from config-defined intent keywords.
 *
 * @param {string} query
 * @returns {string}
 */
function detectIntent(query) {
  const q = String(query).toLowerCase().trim();

  for (const intent of INTENT_ORDER) {
    const keywords = getIntentKeywords(intent);
    if (keywords.some(keyword => q.includes(keyword.toLowerCase()))) {
      return intent;
    }
  }

  return 'build';
}

/**
 * Load top-ranked brain chunks for a query and return a budget-capped context string.
 *
 * @param {string} query - The user's raw query
 * @param {string|null} forceIntent - Override auto-detection (optional)
 * @returns {Promise<{ context: string, intent: string, filesLoaded: string[] }>}
 */
async function loadBrainContext(query, forceIntent = null) {
  const intent = forceIntent || detectIntent(query);
  const chunks = loadBrainChunks();
  let topChunks;

  try {
    const queryEmbedding = await embedQuery(query);
    topChunks = retrieveChunks(queryEmbedding, TOP_K_CHUNKS);
  } catch (err) {
    console.warn(`Brain embedding retrieval unavailable; falling back to lexical scoring: ${err.message}`);
    topChunks = selectTopChunks(chunks, intent, query, TOP_K_CHUNKS);
  }

  const context = buildContextFromChunks(topChunks);
  const filesLoaded = Array.from(new Set(topChunks.map(chunk => chunk.sourceFile)));

  return { context, intent, filesLoaded };
}

function resetBrainEmbeddingCache() {
  brainEmbeddingIndex = null;
  brainEmbeddingPath = null;
}

module.exports = {
  loadBrainContext,
  detectIntent,
  parseMarkdownToChunks,
  loadBrainChunks,
  selectTopChunks,
  scoreChunk,
  retrieveChunks,
  cosineSimilarity,
  loadBrainEmbeddings,
  resetBrainEmbeddingCache,
};
