# ADR-003: Flat-File Embedding Retrieval

## Status

**Accepted**

---

## Date

2026-06-23

---

## What This Decision Is About

Lexical chunking reduced prompt size, but keyword overlap can miss related concepts. Aria needed semantic retrieval while keeping setup simple enough for a local Node app with a small markdown corpus.

---

## The Decision

Generate brain chunk embeddings offline into `data/brain-embeddings.json`, load that file into memory, and rank chunks with brute-force cosine similarity at request time; if embedding retrieval is unavailable, fall back to lexical chunk scoring.

---

## Why This Option Was Chosen

- The corpus is small enough for an in-memory linear scan.
- The generated JSON file is regenerable and does not require a database service.
- The fallback keeps Aria usable when embeddings are missing or the embedding API is unavailable.
- The `loadBrainContext()` signature remains unchanged for callers.

---

## Alternatives That Were Considered

### Option: Vector database
- **What it is:** Use a dedicated vector store for chunk embeddings.
- **Pros:** Better indexing, filtering, and scaling for large corpora.
- **Why rejected:** It adds infrastructure for a corpus that fits comfortably in memory.

### Option: Runtime-only embeddings with no stored index
- **What it is:** Embed chunks every time the server starts or every query runs.
- **Pros:** No generated data file to manage.
- **Why rejected:** It adds startup/API cost and creates more provider dependency than a build-time script.

### Option: Lexical retrieval only
- **What it is:** Keep ADR-001 as the final retrieval approach.
- **Pros:** Fast and dependency-free.
- **Why rejected:** It cannot reliably match semantic equivalents or broader player phrasing.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| Generated embeddings can go stale after brain edits. | Developers rerun `npm run embed-brain` after brain content changes. |
| Missing generated data disables semantic retrieval. | The loader logs a clear fallback warning and uses lexical scoring. |
| Linear cosine search will not scale indefinitely. | Revisit vector storage if the corpus grows beyond a few hundred KB or per-guild custom knowledge is added. |

---

## Files Changed

| File | Change |
|---|---|
| `scripts/embed-brain.js` | Generates embeddings for parsed brain chunks. |
| `src/brain-loader.js` | Loads embeddings, embeds runtime queries, ranks with cosine similarity, and falls back to lexical scoring. |
| `package.json` | Adds `npm run embed-brain`. |
| `.gitignore` | Keeps generated data out of source control through `data/`. |
| `test/brain-loader.test.js` | Covers cosine similarity and retrieval behavior. |

---

## How to Verify It's Working

- Run `npm run embed-brain` with a valid Google API key.
- Run `npm test`.
- Temporarily remove or rename `data/brain-embeddings.json` and confirm requests fall back to lexical scoring with a warning.

---

## Related Decisions

- Depends on: ADR-001
- Supersedes: None
- Related: None

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance. If the decision changes, write a new ADR that supersedes this one.*
