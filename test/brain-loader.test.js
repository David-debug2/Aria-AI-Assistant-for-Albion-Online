const fs = require('fs');
const path = require('path');
const assert = require('node:assert');
const { test } = require('node:test');

const { parseMarkdownToChunks, loadBrainContext } = require('../src/brain-loader');

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

test('all brain files produce 3-10 section chunks', () => {
  const brainDir = path.join(__dirname, '..', 'albion-brain');
  const files = fs.readdirSync(brainDir).filter(file => file.endsWith('.md'));

  assert.strictEqual(files.length, 9, 'expected 9 brain markdown files');

  for (const file of files) {
    const chunks = parseMarkdownToChunks(loadFile(file), file);
    assert.ok(chunks.length >= 3 && chunks.length <= 10, `${file} produced ${chunks.length} chunks`);
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

test('loadBrainContext returns top chunks and same response shape', () => {
  const { context, intent, filesLoaded } = loadBrainContext('How do I refine ore?', null);

  assert.strictEqual(typeof context, 'string');
  assert.strictEqual(typeof intent, 'string');
  assert.ok(Array.isArray(filesLoaded));
  assert.ok(context.includes('ALBION KNOWLEDGE'), 'context should include at least one chunk header');
  assert.ok(filesLoaded.length >= 1, 'should list at least one loaded file');

  const chunkHeaders = (context.match(/### ALBION KNOWLEDGE/g) || []).length;
  assert.ok(chunkHeaders <= 6, `expected at most 6 selected chunks, got ${chunkHeaders}`);
  assert.ok(chunkHeaders <= 2, `expected ore refining query to retrieve only 1-2 sections, got ${chunkHeaders}`);
  assert.deepStrictEqual(filesLoaded, ['6_crafting_refining.md']);
});
