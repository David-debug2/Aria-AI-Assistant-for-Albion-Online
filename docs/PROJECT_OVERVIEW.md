# Aria Project Overview

## What is Aria?

Aria is an AI-driven Albion Online strategy assistant. It combines:

- a knowledge corpus of Albion gameplay and economy rules (`albion-brain/`)
- live market data from Albion Data Project APIs
- item resolution from official Albion item data
- AI generation via Gemini or local Ollama
- a browser dashboard for chat, market tracking, crafting, and guild advice

Aria is designed to help players answer questions like:

- "What is the best T5 sword for PvP?"
- "Should I craft this item for profit?"
- "What is the best territory strategy for my guild?"
- "What build should I use for ZvZ or dungeon play?"

## Repo Structure

### Root files

- `README.md` — Quick start, commands, and project overview
- `package.json` — Node scripts, dependencies, and project metadata
- `BRAIN.md` — Brain authoring guidelines for the AI knowledge corpus
- `docs/` — Project documentation and architecture upgrade plan

### `config/`

- `config.js` — Application configuration values and environment defaults

### `src/`

- `server.js` — Express server and HTTP API routes
- `ai-agent.js` — Main AI orchestration, engine selection, and prompt construction
- `brain-loader.js` — Intent detection and brain file context loading
- `market-api.js` — Live Albion market price and history lookup
- `item-resolver.js` — Search and fuzzy resolution for Albion item names and IDs
- `market-cache.js` — In-memory caching for market responses

### `src/modules/`

- `build-advisor.js` — Build recommendations and counter-build guidance
- `crafting-profit.js` — Crafting profit calculator and cost breakdown logic
- `guild-strategist.js` — Guild territory, ZvZ composition, and progression advice
- `market-analyzer.js` — Market trend analysis and flip detection logic

### `public/`

- `index.html` — Frontend entry point
- `css/styles.css` — Styles for the dashboard UI
- `js/app.js` — Browser-side UI behavior for chat and calculation features

### `scripts/`

- `fetch-items.js` — Data fetcher for Albion items used by the item resolver

### `data/`

- `albion-items.json` — Generated Albion item database for fuzzy item resolution

### `albion-brain/`

Contains the knowledge corpus used to answer player questions. Files are grouped by topic:

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

### Request flow

1. Client sends a request to `src/server.js`
2. `server.js` validates input and forwards chat queries to `src/ai-agent.js`
3. `ai-agent.js` calls `src/brain-loader.js` to determine intent and load relevant brain context
4. If present, `src/market-api.js` provides live market price or history data
5. `ai-agent.js` constructs the final prompt and sends it to Gemini or Ollama
6. The generated response is returned back to the client

### Knowledge & AI context

- `albion-brain/` stores the static game knowledge used by the AI
- `BRAIN.md` explains how those files should be authored and maintained
- `brain-loader.js` uses intent detection to choose which brain files to include in each query

### Live market support

- `market-api.js` resolves item names via `item-resolver.js`
- It then queries Albion Data Project endpoints for prices and history
- Responses are cached in `market-cache.js` for performance

### Crafting and guild features

- `crafting-profit.js` computes profit/loss estimates for item crafting
- `build-advisor.js` provides build and counter-build guidance
- `guild-strategist.js` offers territory strategy and ZvZ composition recommendations

## Key Developer Workflows

### Install dependencies

```bash
npm install
```

### Fetch item data

```bash
node scripts/fetch-items.js
```

This script generates `data/albion-items.json`, which is required for item name resolution.

### Run the app

```bash
npm start
```

Then open `http://localhost:3000`.

### Run tests

```bash
npm test
```

### Review brain content

- Use `BRAIN.md` before editing `albion-brain/*.md`
- Keep the corpus focused, concise, and under the project token budget

## Where to find the upgrade plan

The current architecture upgrade plan is stored in:

- `docs/aria-architecture-upgrade-plan.md`

That document describes planned changes for the brain loader, AI routing, SDK migration, caching, provider fallbacks, and OpenAlbion data enrichment.

## Notes for new developers

- The app is intentionally modular: AI orchestration lives in `src/ai-agent.js`, while domain-specific logic is in `src/modules/`
- The knowledge corpus is separate from runtime code so the AI can stay up-to-date without code changes
- Live market data is optional but adds concrete, price-aware answers to the AI responses
- The `docs/` folder is the primary place for architecture documentation and planned changes

## Suggested onboarding path

1. Read `README.md` for setup and quick start
2. Read `docs/PROJECT_OVERVIEW.md` for repo structure and architecture
3. Read `BRAIN.md` if you need to edit game knowledge
4. Read `docs/aria-architecture-upgrade-plan.md` for the current roadmap
5. Explore `src/server.js` and `src/ai-agent.js` to understand request flow
