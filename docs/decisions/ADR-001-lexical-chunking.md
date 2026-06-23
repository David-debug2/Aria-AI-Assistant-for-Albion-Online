# ADR-001: Section-Level Lexical Chunking for Brain Loader

## Status

**Accepted**

---

## Date

2026-06-23

---

## What This Decision Is About

Alpha loaded whole markdown brain files into the AI prompt even when a user question only needed one section. That wasted context, increased latency, and made every later retrieval improvement harder to measure. The project needed a low-risk way to send less text while preserving the existing `loadBrainContext()` contract.

---

## The Decision

Split every brain file into markdown-header sections at startup, score those sections with query and intent keyword overlap, and return only the top-ranked chunks within the context budget.

---

## Why This Option Was Chosen

- It reused the existing intent keyword configuration instead of adding a dependency.
- It kept the caller contract unchanged: `{ context, intent, filesLoaded }`.
- It could be measured immediately against the previous whole-file loading behavior.
- It created a fallback path for the later embedding retrieval phase.
- The corpus was small enough that an in-memory section list was simpler than infrastructure.

---

## Alternatives That Were Considered

### Option: Jump straight to embeddings
- **What it is:** Precompute embeddings for every brain section and retrieve semantically similar chunks at query time.
- **Pros:** Better semantic matching than plain keyword overlap.
- **Why rejected:** It required additional generated data and provider availability before there was a measured baseline. Lexical chunking was valuable even after embeddings because it stayed useful as a fallback.

### Option: Trim brain files and keep whole-file loading
- **What it is:** Reduce the markdown files until whole-file loading became cheaper.
- **Pros:** No runtime code change.
- **Why rejected:** It would remove useful game knowledge to compensate for loader behavior. The better fix was to load less irrelevant content, not make the knowledge base thinner.

### Option: Add a vector database first
- **What it is:** Store chunks in ChromaDB, Pinecone, Supabase Vector, or a similar vector store.
- **Pros:** Scales well for large corpora and multi-tenant knowledge.
- **Why rejected:** The 9 brain files are small. A flat in-memory list was enough for Beta and avoided operational complexity.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| Keyword scoring can miss semantic matches. | Phase 2 adds embedding retrieval while keeping lexical scoring as fallback. |
| Markdown section boundaries may omit parent context. | The parser keeps subsection content and tables inside their parent section. |
| A fixed top-K can include too much or too little. | `TOP_K_CHUNKS` and the context budget can be tuned from measured query samples. |

---

## Files Changed

| File | Change |
|---|---|
| `src/brain-loader.js` | Added markdown section parsing, chunk scoring, and budget-capped context assembly. |
| `docs/decisions/phase-0-checkpoint.md` | Recorded chunk counts and context reduction samples. |
| `test/brain-loader.test.js` | Added coverage for chunk parsing and retrieval behavior. |

---

## How to Verify It's Working

- Run `npm test`.
- Read `docs/decisions/phase-0-checkpoint.md` and confirm the sample queries show smaller context.
- Ask a focused question such as "how do I refine ore" and confirm loaded files/sections are relevant to crafting.

---

## Related Decisions

- Depends on: None
- Supersedes: None
- Related: ADR-003

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance. If the decision changes, write a new ADR that supersedes this one.*
