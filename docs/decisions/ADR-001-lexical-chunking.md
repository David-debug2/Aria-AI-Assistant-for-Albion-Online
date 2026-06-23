# ADR-001: Section-Level Lexical Chunking for Brain Loader

## Status
Accepted

## Date
_(Fill in when Phase 0 is completed)_

---

## What This Decision Is About

In Alpha, `brain-loader.js` would load entire markdown files (each 5–8KB) and send all of that text to the AI every time someone asked a question. If a player asked "how do I refine ore?", Aria would send the entire `6_crafting_refining.md` file — including sections on enchantments, tax optimization, and guild halls — even though only 1–2 paragraphs were relevant. This was wasteful: it consumed more of the AI's context window, made responses slower, and increased costs.

The question was: how do we make the brain loader smarter without over-engineering it?

---

## The Decision

Split each brain file into sections at startup (using markdown headers as dividers), score each section against the user's query using keyword overlap, and return only the top-K most relevant sections — up to the existing context budget.

---

## Why This Option Was Chosen

- **No new dependencies.** The keyword list already existed in `config.js`. This reuses it instead of adding new infrastructure.
- **Same-day change.** The parser is a simple string split on `##`/`###` boundaries. It can be shipped and measured in a single session.
- **Establishes a baseline.** Before adding embeddings (Phase 2), we need to know how much the simpler approach saves. This gives us a measured starting point.
- **Low risk.** `loadBrainContext()` returns the same data shape as before — callers in `ai-agent.js` don't change at all.
- **The corpus is tiny.** At ~45KB total for all 9 files, there's no need for a vector database. A scored flat array is sub-millisecond.

---

## Alternatives That Were Considered

### Option: Jump straight to embeddings
- **What it is:** Pre-compute vector embeddings for every brain section, then retrieve by semantic similarity at query time
- **Pros:** Better semantic matching — "how do I make money?" would correctly match economy sections even without exact keyword overlap
- **Why rejected:** Requires the SDK migration (Phase 1) to be done first since embeddings need `@google/genai`. Starting here would block Phase 0 on Phase 1. The lexical approach ships now and acts as a fallback baseline for the embedding system in Phase 2.

### Option: Keep whole-file loading, just trim file sizes
- **What it is:** Reduce the size of each brain file so loading whole files is less wasteful
- **Pros:** No code changes to `brain-loader.js`
- **Why rejected:** It trades information quality for context efficiency. The brain files are already concise — trimming them further would hurt AI answer quality, not improve it.

### Option: Use a vector database (ChromaDB, Pinecone, etc.)
- **What it is:** Stand up a dedicated embedding store with proper vector indexing
- **Pros:** Most scalable, best retrieval quality for large corpora
- **Why rejected:** The 9 brain files total ~45KB. Standing up ChromaDB for a 45KB corpus is infrastructure for a problem that doesn't exist yet. Revisit if the corpus grows past a few hundred KB or per-guild custom knowledge is added.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| Keyword scoring can miss semantically related content ("money" won't match a section titled "Silver Economy") | Phase 2 adds embedding-based retrieval as the primary path; lexical scoring becomes the fallback |
| Chunking on `##` boundaries might split a section from its parent context | Tables and their preceding heading are kept in the same chunk — verified manually per acceptance criteria |
| Top-K is a fixed number (starting at K=6) — might be too few or too many | K is configurable; measure context length across sample queries and tune before Phase 2 |

---

## Files Changed

| File | Change |
|---|---|
| `src/brain-loader.js` | Modified — added section parser and keyword-overlap scoring |

---

## How to Verify It's Working

1. Run `npm test` — all existing tests should pass without modification
2. Start the server and ask "how do I refine ore?" — check server logs and confirm `context.length` is significantly smaller than before (target: 60–70% reduction)
3. Manually verify that the returned sections are actually about refining, not about unrelated topics like guilds or PvP

---

## Related Decisions

- Depends on: None
- Supersedes: None (Alpha had no formal decision recorded for this)
- Related: ADR-002 (SDK migration), ADR-003 (embedding retrieval — Phase 2 upgrade of this decision)
