# Aria — Alpha Version Snapshot

**Status:** Complete (superseded by Beta)
**Theme:** "Make it work"

---

## What Alpha Was

Alpha was the first fully functional version of Aria. The goal was simple: prove the concept works end to end. A player should be able to open a browser, type a question about Albion Online, and get a useful, data-aware answer.

Everything in Alpha was built to ship, not to scale. Some shortcuts were intentional (hardcoded recipes, whole-file brain loading) because they were the fastest way to validate the product. Those shortcuts are fixed in Beta.

---

## What a User Could Do in Alpha

| Feature | What it did |
|---|---|
| **AI Chat** | Ask any Albion strategy question in plain English |
| **Market Prices** | Look up live buy/sell prices for any item across 3 servers |
| **Crafting Calculator** | Calculate profit/loss for crafting a sword or helmet (T4–T6 only) |
| **Guild Strategy** | Get territory type recommendations, ZvZ compositions, progression roadmaps |

---

## How Alpha Worked (For Non-Coders)

Think of Aria like a knowledgeable friend you can text questions to. Here's what happens behind the scenes when you ask "What's the best T5 sword for PvP?":

1. **Your message arrives** at the server (`src/server.js`)
2. **The brain loader** (`src/brain-loader.js`) reads your question, figures out you're asking about weapons and PvP, and pulls out the relevant knowledge files from `albion-brain/`
3. **Live prices** are optionally fetched from the Albion Data Project API if you included item names
4. **Everything gets bundled** into a single prompt and sent to Google Gemini (or Ollama if you're running locally)
5. **Gemini's answer** comes back and is displayed in the chat

The "brain files" are just plain text files written in a format called Markdown (like a simple document). They contain Aria's game knowledge — prices, strategies, mechanics. They're designed to be edited by humans, not just coders.

---

## What Alpha Did NOT Have

These are known gaps — not bugs, but intentional scope limits for the first version:

| Missing | Why it mattered |
|---|---|
| Smart brain loading | The whole knowledge file was sent to the AI even if only 2 sentences were relevant — slow and wasteful |
| Real crafting recipes | Only 6 items were supported (hardcoded). Everything else returned "no recipe found" |
| AI math | The market analyzer asked the AI to calculate profit margins — AI math is slow and inconsistent |
| Provider fallback | If Gemini was rate-limited, Aria had no backup |
| Working Ollama routing | The local model path existed in code but could never actually be triggered |
| Real item stats | Weapon and armor stats in the brain files were approximate descriptions, not real numbers |

---

## File Map (Alpha)

```
Aria/
├── public/                    # What users see in the browser
│   ├── index.html             # The dashboard page
│   ├── css/styles.css         # Visual styling (dark theme)
│   └── js/app.js              # Makes buttons work, handles API calls
│
├── src/                       # The brain of the app (server-side)
│   ├── server.js              # Receives requests, sends responses
│   ├── ai-agent.js            # Chooses which AI to use and builds the prompt
│   ├── brain-loader.js        # Picks which knowledge files to include
│   ├── item-resolver.js       # Converts "T5 sword" into an item ID
│   ├── market-api.js          # Fetches live prices from Albion Data Project
│   ├── market-cache.js        # Stores recent price data for 5 minutes
│   └── modules/
│       ├── crafting-profit.js # Calculates crafting profit/loss
│       ├── guild-strategist.js# Territory and ZvZ advice
│       ├── build-advisor.js   # Gear build recommendations
│       └── market-analyzer.js # Flip and trend analysis
│
├── albion-brain/              # The knowledge base (9 topic files)
│   ├── 1_basics_progression.md
│   ├── 2_world_zones_mists.md
│   ├── 3_pve_activities.md
│   ├── 4_pvp_factions_zvz.md
│   ├── 5_economy_market.md
│   ├── 6_crafting_refining.md
│   ├── 7_farming_islands.md
│   ├── 8_weapons_armor.md
│   └── 9_guild_management.md
│
├── config/
│   └── config.js              # App settings (port, AI model, cache TTL)
│
├── scripts/
│   └── fetch-items.js         # Downloads the Albion item database
│
├── data/
│   └── albion-items.json      # 10,000+ item names and IDs (generated)
│
└── test/                      # Automated checks that things work
    ├── item-resolver.test.js
    ├── market-cache.test.js
    ├── crafting-profit.test.js
    ├── guild-strategist.test.js
    └── integration.test.js
```

---

## Key Technical Decisions Made in Alpha

| Decision | What was chosen | Why |
|---|---|---|
| AI provider | Google Gemini (Flash + Pro) | Free tier available, strong reasoning, easy SDK |
| Local AI fallback | Ollama | Allows offline use without API keys |
| Item search | Fuse.js fuzzy search | Fast, no server needed, good enough for 10K items |
| Market data | Albion Data Project (community API) | Free, public, covers all servers |
| Caching | In-memory Map | Simple, no extra infrastructure needed for v1 |
| Knowledge format | Markdown files | Human-editable, no database needed, fits AI context window |
| Frontend | Plain HTML/CSS/JS | No build step, fast to ship, easy to modify |

Full decision rationale for each is recorded in `docs/decisions/`.

---

## Dependencies in Alpha

| Package | Version | What it did |
|---|---|---|
| `express` | 5.2.1 | Web server framework |
| `@google/generative-ai` | 0.24.1 | Google Gemini SDK *(deprecated, replaced in Beta)* |
| `fuse.js` | 7.4.2 | Fuzzy item name search |
| `node-fetch` | 3.3.2 | HTTP requests to market API |
| `dotenv` | 17.4.2 | Loads `.env` config file |
| `ollama` | *(dynamic import)* | Local AI model support |

---

## How to Run Alpha (Preserved for Reference)

```bash
# 1. Install dependencies
npm install

# 2. Download the item database
node scripts/fetch-items.js

# 3. Create your .env file with:
#    GOOGLE_API_KEY=your_key_here
#    AI_MODEL=gemini
#    PORT=3000

# 4. Start the server
npm start

# 5. Open http://localhost:3000
```

---

## Alpha Test Coverage

```bash
npm test
```

Tests covered:
- Item resolver (fuzzy search accuracy, edge cases)
- Market cache (TTL expiration, hit/miss tracking)
- Crafting profit (known recipes, enchantment levels, recommendations)
- Guild strategist (territory recommendations, ZvZ compositions)
- Integration (end-to-end resolver → strategy flow)

What was NOT tested:
- AI response quality (manual only)
- Live market API responses (mocked or skipped)
- Ollama availability

---

*This snapshot is frozen. Alpha is no longer the active version. See `CHANGELOG.md` for what changed in Beta and beyond.*
