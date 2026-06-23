# Aria Project Overview

## What is Aria?

Aria is an AI-driven Albion Online strategy assistant. It combines:

- a human-editable Albion knowledge corpus in `albion-brain/`
- generated item, stat, spell, recipe, and embedding data in `data/`
- live market data from Albion Data Project APIs
- deterministic JavaScript calculations for market and crafting math
- AI generation through user-supplied provider keys or server-configured fallback providers
- a browser dashboard for chat, market tracking, crafting, and guild advice

Aria is designed to answer questions like:

- "What is the best T5 sword for PvP?"
- "Should I craft this item for profit?"
- "What ingredients do I need for this item?"
- "What build should I use for ZvZ or dungeon play?"
- "What is the best territory strategy for my guild?"

## Repo Structure

### Root files

- `README.md` - quick start, commands, and API reference.
- `package.json` - scripts, dependencies, and project metadata.
- `BRAIN.md` - authoring guidelines for the AI knowledge corpus.
- `.env.example` - example environment values.
- `docs/` - documentation, version snapshots, and ADRs.

### `config/`

- `config.js` - server defaults, AI provider/model allowlists, market settings, and brain retrieval settings.

### `src/`

- `server.js` - Express app, HTTP routes, API validation, and error handling.
- `ai-agent.js` - AI orchestration, provider routing, fallback chain, response schemas, and Gemini static cache support.
- `brain-loader.js` - intent detection, markdown chunking, embedding retrieval, lexical fallback, and context assembly.
- `schemas.js` - response schemas and validation helpers for AI output.
- `openalbion-loader.js` - in-memory lookup indexes for generated OpenAlbion stats and spells.
- `item-resolver.js` - fuzzy search for Albion item names and IDs.
- `market-api.js` - Albion Data Project price/history client.
- `market-cache.js` - in-memory market API response cache.

### `src/modules/`

- `build-advisor.js` - build and counter-build prompts enriched with OpenAlbion data.
- `calc-helpers.js` - shared margin, tax, percentage, and currency helpers.
- `crafting-profit.js` - recipe loading, ingredient costing, taxes, silver fees, and profit calculations.
- `guild-strategist.js` - deterministic guild territory, ZvZ, and progression advice.
- `market-analyzer.js` - deterministic flip opportunity and trend calculations before AI narration.

### `public/`

- `index.html` - frontend entry point and dashboard markup.
- `css/styles.css` - dashboard styling.
- `js/app.js` - browser behavior, session-only provider key storage, and API calls.

### `scripts/`

- `fetch-items.js` - generates `data/albion-items.json`.
- `embed-brain.js` - generates `data/brain-embeddings.json`.
- `fetch-openalbion.js` - generates OpenAlbion and Gameinfo data files.

### `data/`

Generated local data used at runtime:

- `albion-items.json`
- `brain-embeddings.json`
- `openalbion-lists.json`
- `openalbion-weapon-stats.json`
- `openalbion-armor-stats.json`
- `openalbion-consumable-stats.json`
- `openalbion-consumable-recipes.json`
- `openalbion-spells.json`
- `gameinfo-gear-recipes.json`

These files are regenerable and ignored by git.

### `albion-brain/`

The human-editable knowledge corpus:

- `1_basics_progression.md`
- `2_world_zones_mists.md`
- `3_pve_activities.md`
- `4_pvp_factions_zvz.md`
- `5_economy_market.md`
- `6_crafting_refining.md`
- `7_farming_islands.md`
- `8_weapons_armor.md`
- `9_guild_management.md`

## Core Architecture

### Chat request flow

1. The browser stores provider settings in `sessionStorage`.
2. The client sends `/api/ask` with `X-Provider`, `X-Model`, and `X-Provider-Key`.
3. `server.js` validates the provider/model against `config/config.js`.
4. `ai-agent.js` asks `brain-loader.js` for relevant knowledge context.
5. `brain-loader.js` uses embedding retrieval when generated embeddings are available and lexical chunk scoring as fallback.
6. Optional market data is fetched through `market-api.js`.
7. The AI provider returns JSON matching the expected response type.
8. `schemas.js` validates the response before the server sends it to the browser.

### Knowledge and retrieval

- `albion-brain/` contains stable player-facing knowledge.
- `brain-loader.js` parses those files into markdown sections.
- `scripts/embed-brain.js` can generate semantic vectors for those sections.
- Missing embeddings do not stop the app; lexical chunk scoring remains the fallback.

### Generated game data

- `scripts/fetch-openalbion.js` fetches real stats, spells, consumables, and recipes.
- `openalbion-loader.js` indexes stats and spells in memory.
- `crafting-profit.js` loads generated consumable and gear recipes.
- Brain files keep concise reference tables and strategy notes; generated data handles large raw data.

### Live market support

- `market-api.js` resolves item names through `item-resolver.js`.
- It queries Albion Data Project endpoints for prices and history.
- `market-cache.js` caches recent market responses for performance.
- `market-analyzer.js` computes flip and trend math before asking the AI for narration.

## Key Developer Workflows

### Install dependencies

```bash
npm install
```

### Generate data

```bash
npm run fetch-items
npm run fetch-openalbion
npm run embed-brain
```

Re-run `fetch-items` and `fetch-openalbion` after Albion patches. Re-run `embed-brain` after meaningful brain file edits.

### Run the app

```bash
npm start
```

Then open `http://localhost:3000`.

### Run tests

```bash
npm test
```

## Documentation Map

- `docs/CHANGELOG.md` records what changed by version.
- `docs/versions/ALPHA.md` and `docs/versions/BETA.md` are frozen version snapshots.
- `docs/decisions/` records why major technical choices were made.
- `docs/HOW-TO-UPDATE-DOCS.md` explains what to update when shipping changes.

## Notes for New Developers

- The app is intentionally modular: AI orchestration is in `src/ai-agent.js`, while domain logic lives in `src/modules/`.
- User API keys are not stored server-side; they are sent per request from browser session storage.
- Generated data should be refreshed with scripts, not manually edited.
- Brain files are still the source of concise human-authored Albion strategy knowledge.
- Beta left one known technical debt item: the code still uses `@google/generative-ai`.
