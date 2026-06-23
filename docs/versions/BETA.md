# Aria - Beta Version Snapshot

**Status:** Complete (current version closed on 2026-06-23)
**Theme:** "Make it right"

---

## What Beta Was

Beta was the architecture correction release. Alpha proved that Aria could answer Albion Online questions, fetch market data, and run basic calculators. Beta made that system more reliable: smaller AI context, structured AI output, user-supplied provider keys, deterministic math, multi-provider fallback, and real item data from OpenAlbion and Gameinfo.

Beta did not replace the whole app. It kept the plain Node/Express and browser-dashboard shape, but made the internal data and AI paths much more explicit.

---

## What a User Could Do in Beta

| Feature | What it did |
|---|---|
| **AI Chat with User Keys** | Ask Albion questions using a session-only provider key for OpenRouter, OpenAI, Anthropic, or Gemini. |
| **Smarter Knowledge Retrieval** | Receive answers backed by selected brain sections instead of whole markdown files. |
| **Structured Answers** | Get chat, build, and market answers returned as predictable JSON-backed UI sections. |
| **Market Prices and Trends** | Look up live prices, price history, and narrated flip opportunities with deterministic margin math. |
| **Crafting Calculator** | Calculate profit with generated consumable recipes, Gameinfo gear recipes, silver fees, and ingredient breakdowns. |
| **Build Advice with Real Stats** | Ask for builds and counters that can include real OpenAlbion stats and spell data. |
| **Guild Strategy** | Use the existing territory, ZvZ, and guild progression tools from Alpha. |

---

## How Beta Worked (For Non-Coders)

When a player asked a question in Beta:

1. The browser sent the question plus the selected provider, model, and session-only API key to `src/server.js`.
2. `server.js` validated the provider settings against the allowlist in `config/config.js`.
3. `src/brain-loader.js` detected the question intent and selected relevant brain sections. If `data/brain-embeddings.json` was available, it used semantic similarity; otherwise it fell back to keyword scoring.
4. If the question needed live prices, `src/market-api.js` fetched Albion Data Project data and `src/market-cache.js` cached recent responses.
5. `src/ai-agent.js` asked the selected provider for schema-shaped JSON. Server-configured internal calls could fall through OpenRouter, Cloudflare, Ollama, and Gemini.
6. The server validated the AI JSON with `src/schemas.js` before returning it.
7. The frontend rendered known fields instead of dumping raw markdown or raw JSON.

Generated data lived in `data/` and was not meant to be edited by hand. Brain files stayed human-editable, but Beta supplemented them with generated stats, spells, and recipes.

---

## What Beta Did NOT Have

| Missing | Why it mattered |
|---|---|
| Persistent user accounts | API keys were session-only; users had to re-enter keys after closing the tab. |
| Production credential storage | This was intentional: Beta avoided server-side custody of user keys. |
| Vector database | The brain corpus was still small enough for flat JSON embeddings and in-memory cosine search. |
| Automatic patch refresh | Developers still had to rerun `npm run fetch-openalbion` and `npm run embed-brain` after data changes. |
| Redis or external cache | Market cache and provider quota tracking remained in memory. |
| Full production hardening | HTTPS, rate limiting, monitoring, and deployment security remained 1.0 work. |
| Google SDK migration | The code still used `@google/generative-ai` in Beta; this remained future technical debt. |

---

## File Map (Beta)

```
Aria/
|-- public/                         # Browser dashboard
|   |-- index.html                  # Main UI and provider settings shell
|   |-- css/styles.css              # Dashboard and provider settings styles
|   `-- js/app.js                   # UI behavior, session key storage, API calls
|
|-- src/                            # Server-side application code
|   |-- server.js                   # Express routes and API validation
|   |-- ai-agent.js                 # AI orchestration, schemas, caching, providers
|   |-- brain-loader.js             # Intent detection, chunking, embeddings, fallback retrieval
|   |-- schemas.js                  # Structured response schemas and validation
|   |-- openalbion-loader.js        # Generated stat/spell lookup indexes
|   |-- item-resolver.js            # Fuzzy item name resolution
|   |-- market-api.js               # Albion Data Project API client
|   |-- market-cache.js             # In-memory market response cache
|   `-- modules/
|       |-- build-advisor.js        # Build/counter prompts with stat injection
|       |-- calc-helpers.js         # Shared tax, margin, and rounding helpers
|       |-- crafting-profit.js      # Recipe loading and profit calculations
|       |-- guild-strategist.js     # Guild and ZvZ deterministic advice
|       `-- market-analyzer.js      # Deterministic flip/trend calculations
|
|-- scripts/
|   |-- fetch-items.js              # Generates item resolver data
|   |-- embed-brain.js              # Generates brain chunk embeddings
|   `-- fetch-openalbion.js         # Generates OpenAlbion/Gameinfo data
|
|-- data/                           # Generated local data, ignored by git
|   |-- albion-items.json
|   |-- brain-embeddings.json
|   |-- openalbion-lists.json
|   |-- openalbion-weapon-stats.json
|   |-- openalbion-armor-stats.json
|   |-- openalbion-consumable-stats.json
|   |-- openalbion-consumable-recipes.json
|   |-- openalbion-spells.json
|   `-- gameinfo-gear-recipes.json
|
|-- albion-brain/                   # Human-editable Albion knowledge corpus
|   |-- 1_basics_progression.md
|   |-- 2_world_zones_mists.md
|   |-- 3_pve_activities.md
|   |-- 4_pvp_factions_zvz.md
|   |-- 5_economy_market.md
|   |-- 6_crafting_refining.md
|   |-- 7_farming_islands.md
|   |-- 8_weapons_armor.md
|   `-- 9_guild_management.md
|
|-- test/                           # Node test suite
|-- config/config.js                # Server, AI, provider, market, and brain config
|-- docs/                           # Documentation, decisions, and version snapshots
|-- package.json
`-- README.md
```

---

## Key Technical Decisions Made in Beta

| Decision | What was chosen | Why |
|---|---|---|
| Brain chunking | Markdown sections scored before prompt assembly | Reduced context without changing callers; see `docs/decisions/ADR-001-lexical-chunking.md` |
| User API keys | Browser `sessionStorage` plus per-request headers | Avoided server-side key custody; see `docs/decisions/ADR-002-user-supplied-api-keys.md` |
| Embedding retrieval | Generated flat JSON index and cosine similarity | Semantic retrieval without a vector database; see `docs/decisions/ADR-003-embedding-retrieval.md` |
| AI output | Shared response schemas and validation | Stable frontend/API contracts; see `docs/decisions/ADR-004-structured-json-output.md` |
| Provider fallback | OpenRouter, Cloudflare, Ollama, Gemini Flash | Independent quota/failure paths; see `docs/decisions/ADR-005-provider-fallback-chain.md` |
| Game data sources | OpenAlbion for stats/spells, Gameinfo for gear recipes | Real values without hand-maintained tables; see `docs/decisions/ADR-006-openalbion-gameinfo-data.md` |

---

## Dependencies in Beta

| Package | Version | What it did |
|---|---|---|
| `express` | 5.2.1 | Web server and API routing |
| `@google/generative-ai` | 0.24.1 | Gemini generation, response schemas, embeddings, and cache manager |
| `fuse.js` | 7.4.2 | Fuzzy item search |
| `node-fetch` | 3.3.2 | HTTP fallback for API calls when global fetch is unavailable |
| `dotenv` | 17.4.2 | Loads `.env` configuration |
| `ollama` | dynamic import | Optional local AI provider path |

---

## How to Run Beta (Preserved for Reference)

```bash
# 1. Install dependencies
npm install

# 2. Generate local data
npm run fetch-items
npm run fetch-openalbion

# 3. Generate semantic brain retrieval data when using embeddings
npm run embed-brain

# 4. Create .env as needed
# GOOGLE_API_KEY=your_key_here
# OPENROUTER_API_KEY=optional_server_key
# CLOUDFLARE_API_TOKEN=optional_server_token
# CLOUDFLARE_ACCOUNT_ID=optional_account_id
# PORT=3000
# HOST=localhost

# 5. Start the server
npm start

# 6. Open http://localhost:3000 and enter provider settings in the UI
```

---

## Beta Test Coverage

```bash
npm test
```

Tests covered:

- Brain chunk parsing, lexical retrieval, embedding helpers, and fallback paths
- Provider header validation
- AI fallback chain behavior
- Malformed model JSON handling
- Response schema validation
- Market cache behavior
- Market analyzer deterministic calculations
- Crafting recipe loading, silver fee handling, and profit calculations
- OpenAlbion stat/spell loader lookups
- Item resolver, guild strategist, and integration flow

What was NOT fully tested:

- Live third-party API availability and exact production provider responses
- Full browser visual QA
- Long-running production cache expiry under real traffic
- OpenAlbion/Gameinfo correctness after future Albion patches

---

*This snapshot is frozen. Beta is no longer the active version. See `docs/CHANGELOG.md` for what changed after Beta.*
