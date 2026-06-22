const fs = require('fs');
const path = require('path');
const assert = require('node:assert');
const { test } = require('node:test');

const { parseMarkdownToChunks } = require('../src/brain-loader');

function loadFile(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'albion-brain', name), 'utf-8');
}

test('parseBasicsProgression produces 3-10 chunks and includes headings', () => {
  const content = loadFile('1_basics_progression.md');
  const chunks = parseMarkdownToChunks(content, '1_basics_progression.md');

  assert.ok(Array.isArray(chunks), 'chunks should be an array');
  assert.ok(chunks.length >= 3 && chunks.length <= 10, `expected 3-10 chunks, got ${chunks.length}`);
  // Ensure each chunk has heading and content
  for (const c of chunks) {
    assert.ok('heading' in c, 'chunk should have heading');
    assert.ok('content' in c, 'chunk should have content');
  }
});

test('parseEconomyMarket preserves tables inside a chunk', () => {
  const content = loadFile('5_economy_market.md');
  const chunks = parseMarkdownToChunks(content, '5_economy_market.md');

  assert.ok(chunks.length >= 3 && chunks.length <= 10, `expected 3-10 chunks, got ${chunks.length}`);

  // There is a known table header in this file; assert at least one chunk contains it
  const hasTable = chunks.some(c => c.content && c.content.includes('| Item Type |'));
  assert.ok(hasTable, 'expected at least one chunk to contain the table header');
});
