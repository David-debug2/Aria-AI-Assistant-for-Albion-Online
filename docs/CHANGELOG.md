# Aria Changelog

This file tracks every meaningful change to the Aria project, version by version.

## [v1.0.0-rc] - in progress
**Theme:** "Make it stable"

### Added
- SemVer release policy for Alpha, Beta, RC, GA, and post-launch updates in `docs/VERSIONING.md`.

### Changed

### Fixed

### Decided

---

## [Beta] - 2026-06-23
**Theme:** "Make it right"

Beta closed the architecture upgrade from `docs/aria-architecture-upgrade-plan.md`. It made Aria smaller-context, schema-driven, provider-flexible, and backed by real Albion data instead of approximate game stats.

### Added
- Phase 0: Brain files are parsed into section-level chunks and scored before being sent to the AI.
- Phase 1: Users can supply provider, model, and API key settings per browser session for OpenRouter, OpenAI, Anthropic, or Gemini.
- Phase 2: Brain retrieval can use precomputed embeddings from `data/brain-embeddings.json`, with lexical scoring as the fallback.
- Phase 3: AI responses use schema-backed JSON shapes for chat answers, build recommendations, and market flip rankings.
- Phase 4: Gemini static context caching was added for the system prompt and reference tables, with expiry refresh handling.
- Phase 5: Shared margin/tax helpers and deterministic market flip calculations were added.
- Phase 7: A server-side fallback chain was added: OpenRouter, Cloudflare Workers AI, Ollama, then Gemini Flash.
- Phase 9: `scripts/fetch-openalbion.js` fetches OpenAlbion stats, spells, consumable data, and Gameinfo gear recipes.
- Phase 9: `src/openalbion-loader.js` provides in-memory lookups for weapon stats, armor stats, and spells.
- Phase 9: Tests now cover brain loading, schemas, provider routing, market math, OpenAlbion loading, API key validation, and Gameinfo recipe costs.

### Changed
- Phase 0: `brain-loader.js` now returns top-ranked knowledge sections instead of whole brain files, cutting representative context sizes by 61-89%.
- Phase 1: `/api/ask` validates `X-Provider`, `X-Model`, and `X-Provider-Key` headers before calling AI providers.
- Phase 2: `loadBrainContext()` keeps the same caller contract while using embedding retrieval when available.
- Phase 3: `/api/ask` returns structured response fields instead of one markdown string.
- Phase 5: `market-analyzer.js` computes spread, tax, margin, and rankings in JavaScript before asking the AI to narrate.
- Phase 8: Build, PvP, and guild prompts now include explicit reasoning order for tactical answers.
- Phase 9: `crafting-profit.js` loads real consumable recipes from OpenAlbion and gear recipes from Gameinfo, with hardcoded recipes only as fallback.
- Phase 9: `/api/crafting-profit` includes `breakdown.silverFee` and per-ingredient cost details for generated recipe data.
- Phase 9: `build-advisor.js` injects real stat and spell data into build and counter-build prompts.
- Phase 9: `albion-brain/8_weapons_armor.md` and `albion-brain/6_crafting_refining.md` include real stat/reference data while staying within the brain budget.

### Fixed
- Phase 6: Narration-only calls now use the `summarize` intent so Ollama routing can actually fire.
- Phase 9: Missing generated data files now produce clear warnings that point to `npm run fetch-openalbion`.

### Decided
- Brain files are chunked by markdown section before embedding retrieval is attempted (see `decisions/ADR-001-lexical-chunking.md`).
- User API keys stay in browser session storage and are sent only per request (see `decisions/ADR-002-user-supplied-api-keys.md`).
- Embeddings use a flat generated JSON index with brute-force cosine similarity instead of a vector database (see `decisions/ADR-003-embedding-retrieval.md`).
- AI output is constrained with shared response schemas and validated before returning to clients (see `decisions/ADR-004-structured-json-output.md`).
- Free-tier providers are stacked as fallbacks instead of replacing Gemini with one provider (see `decisions/ADR-005-provider-fallback-chain.md`).
- OpenAlbion is used for stats/spells and Gameinfo is used for gear recipes (see `decisions/ADR-006-openalbion-gameinfo-data.md`).

---

## [Alpha] - Initial Release
**Theme:** "Make it work"

### What Alpha was
The first working version of Aria. The goal was to get a functional AI chat interface connected to live Albion Online market data, with basic crafting and guild tools. Nothing was optimized; the priority was proving the concept worked end to end.

### Added
- AI chat interface powered by Google Gemini with Ollama as a local fallback.
- Live market price lookup via Albion Data Project API across West, East, and Europe servers.
- Item name resolver using Fuse.js over 10,000+ Albion items.
- In-memory market price cache with a 5-minute TTL.
- Crafting profit calculator for a small set of hardcoded T4-T6 sword and helmet recipes.
- Guild strategy tools for territory advice, ZvZ composition, and progression roadmaps.
- 9 markdown brain files covering major Albion topics.
- Web dashboard with Chat, Market, Crafting, and Guild tabs.
- `scripts/fetch-items.js` to download the Albion item database locally.
- Basic test suite for item resolution, market cache, crafting profit, guild strategy, and integration flow.

### Known Limitations in Alpha
- Brain loader injected entire markdown files into the AI prompt.
- Crafting recipes were hardcoded and only supported a few items.
- Ollama routing existed but did not reliably trigger for the intended calls.
- Market analyzer asked the AI to do arithmetic instead of computing margins in JavaScript.
- No fallback chain existed when Gemini was rate-limited or unavailable.
- Weapon and armor stats in brain files were approximate.

---

## Future Versions - Ideas Backlog

- Redis cache for multi-instance deployments.
- Discord bot integration.
- Historical price trend charts in the dashboard.
- Per-guild custom knowledge files.
- Auction price prediction.
- Mobile-optimized UI.
- Multi-language support.
