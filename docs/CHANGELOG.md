# Aria — Changelog

This file tracks every meaningful change to the Aria project, version by version.

**How to read this file:**
- Each version has a date, a plain-English summary, and a categorized list of changes
- `Added` = new features or files that didn't exist before
- `Changed` = existing things that were modified or improved
- `Fixed` = bugs or broken behavior that were corrected
- `Removed` = things that were deleted or turned off
- `Decided` = links to Architecture Decision Records (ADRs) explaining *why* a choice was made

---

## [Alpha] — Initial Release
**Date:** _(fill in your initial commit or launch date)_
**Theme:** "Make it work"

### What Alpha was
The first working version of Aria. The goal was to get a functional AI chat interface connected to live Albion Online market data, with basic crafting and guild tools. Nothing was optimized — the priority was proving the concept worked end to end.

### Added
- AI chat interface powered by Google Gemini (Flash and Pro) with Ollama as a local fallback
- Live market price lookup via Albion Data Project API (West, East, Europe servers)
- Item name resolver using fuzzy search (Fuse.js) over 10,000+ Albion items
- In-memory market price cache (5-minute TTL) to reduce API calls
- Crafting profit calculator for a small set of hardcoded recipes (T4–T6 swords and helmets)
- Guild strategy tools: territory advisor, ZvZ composition recommender, progression roadmap
- 9 brain files covering all major Albion topics (basics, zones, PvE, PvP, economy, crafting, farming, weapons, guilds)
- Web dashboard with Chat, Market, Crafting, and Guild tabs
- `scripts/fetch-items.js` to download and cache the Albion item database locally
- Basic test suite covering item resolver, market cache, crafting profit, guild strategist, and integration

### Known Limitations in Alpha
- Brain loader injects entire markdown files into the AI prompt (wasteful — loads ~15KB even if the answer needs 2 sentences)
- Crafting recipes are hardcoded — only 6 items supported
- Ollama routing was technically broken (intent names never matched the Ollama trigger list)
- Market analyzer asked the AI to do math instead of computing margins in JavaScript
- No fallback if Gemini is rate-limited or unavailable
- AI SDK used (`@google/generative-ai`) reached end-of-life August 31, 2025

---

## [Beta] — _(planned)_
**Date:** _(fill in when Beta begins)_
**Theme:** "Make it right"

> Beta tracks the changes described in `docs/aria-architecture-upgrade-plan.md`.
> Fill in each section as phases are completed.

### Phase 0 — Smarter Brain Loading _(planned)_
**Goal:** Stop sending entire brain files to the AI. Only send the sections that are actually relevant to the question.

#### Added
- Section-level chunking: each brain file is split into `{heading, content, sourceFile}` chunks at startup
- Keyword scoring: chunks are ranked by relevance to the query using the keyword list in `config.js`

#### Changed
- `brain-loader.js` now returns top-K scored chunks instead of whole files
- Context size reduced by an estimated 60–70% per query

#### Decided
- [ADR-001: Lexical chunking before embeddings](decisions/ADR-001-lexical-chunking.md)

---

### Phase 1 — SDK Migration _(planned)_
**Goal:** Replace the end-of-life Google AI SDK with the new one before it blocks further work.

#### Changed
- `@google/generative-ai` replaced with `@google/genai` in `package.json`
- `ai-agent.js` updated to use the new client call shape

#### Decided
- [ADR-002: Migrate to @google/genai](decisions/ADR-002-sdk-migration.md)

---

### Phase 2 — Embedding-Based Retrieval _(planned)_
**Goal:** Move from keyword matching to semantic similarity so the AI gets the most relevant brain content, not just keyword matches.

#### Added
- `scripts/embed-brain.js` — offline script to embed all brain chunks using a Gemini embedding model
- `data/brain-embeddings.json` — pre-computed vector store for brain chunks (gitignored, regenerable)
- `retrieveChunks()` function in `brain-loader.js` using cosine similarity

#### Changed
- `loadBrainContext()` uses embedding retrieval as primary path, keyword scoring as fallback

#### Decided
- [ADR-003: Embedding retrieval strategy](decisions/ADR-003-embedding-retrieval.md)

---

### Phase 3 — Structured AI Output _(planned)_
**Goal:** Make Aria return clean structured data instead of raw markdown text, so the frontend can render it properly.

#### Added
- `src/schemas.js` — response schema definitions for chat answers, build recommendations, flip rankings

#### Changed
- `ai-agent.js` passes `responseSchema` to Gemini calls
- `/api/ask` returns structured JSON fields instead of a single markdown string
- `public/js/app.js` updated to render structured fields

---

### Phase 4 — Context Caching _(planned)_
**Goal:** Cache the system prompt and static reference tables so they aren't re-sent on every request (reduces cost and latency).

#### Added
- Startup cache creation for `SYSTEM_PROMPT` and static numeric data
- Cache expiry handling and auto-refresh logic in `ai-agent.js`

---

### Phase 5 — Move Math Out of the AI _(planned)_
**Goal:** The AI should narrate conclusions, not calculate numbers. Margins and profit figures should be computed in JavaScript.

#### Added
- `src/modules/calc-helpers.js` — shared margin/tax calculation helper
- `test/market-analyzer.test.js` — test coverage for computed margins

#### Changed
- `market-analyzer.js` now computes spread, margin, and tax-adjusted profit in JS before calling the AI

---

### Phase 6 — Fix Ollama Routing _(planned)_
**Goal:** The Ollama local model path has never actually fired in Alpha. Fix the intent names so it works.

#### Fixed
- `chooseEngine()` in `ai-agent.js` now correctly routes narration-only calls to Ollama via `forceIntent: 'summarize'`

---

### Phase 7 — Multi-Provider Fallback Chain _(planned)_
**Goal:** Don't depend on a single AI provider. Stack free-tier providers so Aria keeps working even when rate limits are hit.

#### Added
- `askOpenRouter()` provider function
- `askCloudflare()` provider function
- Ordered fallback chain: OpenRouter → Cloudflare → Ollama → Gemini Flash
- Daily quota tracker for OpenRouter (prevents wasting limited free calls)
- `test/ai-agent.test.js` — test coverage for the fallback chain

#### Decided
- [ADR-004: Multi-provider fallback chain](decisions/ADR-004-provider-fallback.md)

---

### Phase 8 — Reasoning Instructions _(planned)_
**Goal:** Give the AI step-by-step thinking instructions for complex tactical questions (builds, PvP counter-play, guild strategy).

#### Changed
- `SYSTEM_PROMPT` updated with per-intent reasoning instructions for `build`, `pvp`, and `guild` intents
- `build-advisor.js` updated with explicit ordering instructions for `getBuild` and `counterBuild`

---

### Phase 9 — Real Game Data from OpenAlbion _(planned)_
**Goal:** Replace approximate stats in brain files with real numbers from the OpenAlbion and Gameinfo APIs.

#### Added
- `scripts/fetch-openalbion.js` — fetches weapons, armors, accessories, consumables, spells, and gear recipes
- `data/openalbion-lists.json`, `openalbion-weapon-stats.json`, `openalbion-armor-stats.json`, `openalbion-consumable-recipes.json`, `openalbion-spells.json`, `gameinfo-gear-recipes.json` (all gitignored)
- `src/openalbion-loader.js` — in-memory index with `getWeaponStats()`, `getArmorStats()`, `getSpells()` lookups
- `test/openalbion-loader.test.js` and fixture files

#### Changed
- `crafting-profit.js` now loads real consumable recipes from OpenAlbion and gear recipes from Gameinfo
- `build-advisor.js` injects real stat and spell data into AI prompts
- `8_weapons_armor.md` updated with real stat tables and spell reference sections
- `6_crafting_refining.md` updated with real consumable stat data
- `/api/crafting-profit` response now includes `silverFee` field and full ingredient breakdowns

#### Decided
- [ADR-005: OpenAlbion + Gameinfo as stat sources](decisions/ADR-005-openalbion-data.md)

---

## Future Versions — Ideas Backlog

These are not committed — just tracked so they don't get forgotten.

- Redis cache (replace in-memory cache for multi-instance deployments)
- Discord bot integration
- Historical price trend charts in the dashboard
- Per-guild custom knowledge (guild-specific brain files)
- Auction price prediction (ML model)
- Mobile-optimized UI
- Multi-language support

---

## How to Update This File

When you complete a feature or fix:

1. Find the right version section (current in-progress version goes at the top)
2. Add your change under the correct category (`Added`, `Changed`, `Fixed`, etc.)
3. If you made an architectural decision, write an ADR and link it here
4. Keep descriptions short — one line per change, plain English
5. Don't delete old version sections — they're permanent history

**Rule of thumb:** If a new developer reading this file can understand *what changed and why* without reading the code, you've written it well.
