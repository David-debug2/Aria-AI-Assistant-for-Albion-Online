// scripts/embed-brain.js
// Run with: npm run embed-brain

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI, TaskType } = require('@google/generative-ai');
const { loadBrainChunks } = require('../src/brain-loader');

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const OUT_PATH = path.join(__dirname, '../data/brain-embeddings.json');

function chunkToEmbeddingText(chunk) {
  return `${chunk.sourceFile}\n${chunk.heading}\n\n${chunk.content}`.trim();
}

async function embedBrain() {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not configured');
  }

  const chunks = loadBrainChunks();
  if (chunks.length === 0) {
    throw new Error('No brain chunks found in albion-brain');
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  console.log(`Embedding ${chunks.length} brain chunks with ${EMBEDDING_MODEL}...`);

  const entries = [];
  for (const [index, chunk] of chunks.entries()) {
    const text = chunkToEmbeddingText(chunk);
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      title: chunk.heading,
    });

    entries.push({
      id: `${chunk.sourceFile}#${chunk.heading}`,
      sourceFile: chunk.sourceFile,
      heading: chunk.heading,
      text,
      content: chunk.content,
      embedding: result.embedding.values,
    });

    console.log(`Embedded ${index + 1}/${chunks.length}: ${chunk.sourceFile} - ${chunk.heading}`);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2));
  console.log(`Saved ${entries.length} brain embeddings to data/brain-embeddings.json`);
}

embedBrain().catch(err => {
  console.error('Error during execution:', err.message);
  process.exit(1);
});
