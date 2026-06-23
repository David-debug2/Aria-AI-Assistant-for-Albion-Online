# ⚔️ Aria - Albion Online Strategy AI

An AI-powered strategy advisor for **Albion Online** players. Aria combines Claude/Gemini AI with live market data, item resolution, and comprehensive game knowledge to provide real-time strategic advice on builds, economy, crafting, guild management, and PvP tactics.

## Features

### 🤖 AI Chat Interface
- Natural language questions about Albion Online
- Context-aware responses using deep game knowledge
- Integration with Claude or Ollama for offline mode
- Live market data injection for price-aware advice

### 💰 Live Market Data
- Real-time price lookups across 3 servers (West, East, Europe)
- Price history and trend analysis
- Flip opportunity detection
- Automatic 5-minute caching for performance

### 🔨 Crafting Profit Calculator
- Calculate profit/loss for crafting any item
- Ingredient cost estimation
- Crafting tax and enchantment cost calculations
- Profitability ranking and recommendations

### 🏰 Guild Strategy Advisor
- Territory warfare recommendations (residential/industrial/commercial)
- ZvZ fleet compositions (5v5, 15v15, 40v40)
- Guild progression roadmaps with milestone tracking
- Alliance strength analysis

### 🌐 Web Dashboard
- Responsive chat interface
- Market price tracker
- Crafting calculator UI
- Guild strategy tools
- Mobile-friendly design

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Albion Data Project API access (free, public)
- Claude API key (optional, for premium AI)
- Ollama (optional, for offline LLM mode)

### Quick Start

1. **Clone & Install**
   ```bash
   cd Aria
   npm install
   ```

2. **Fetch Item Data**
   ```bash
   npm run fetch-items
   npm run fetch-openalbion
   ```
   The first command downloads 10K+ items from the Albion community data repository.
   The second command downloads OpenAlbion stats, spells, consumable recipes, and Gameinfo gear recipes.
   Re-run both commands after Albion Online patches so local item, stat, spell, and recipe data stays current.

3. **Configure Environment** (`.env`)
   ```bash
   # AI Configuration
   AI_MODEL=gemini              # or 'ollama'
   GOOGLE_API_KEY=your_key_here # If using Gemini

   # Server
   PORT=3000
   HOST=localhost

   # Ollama (if using local LLM)
   OLLAMA_URL=http://localhost:11434
   ```

4. **Run Server**
   ```bash
   npm start
   # or
   node src/server.js
   ```

5. **Open Dashboard**
   Navigate to `http://localhost:3000` in your browser.

---

## API Reference

### AI Chat
**POST** `/api/ask`

Ask Aria anything about Albion Online.

```json
{
  "query": "What's the best T5 sword for PvP?",
  "itemQueries": ["T5 sword"],
  "server": "west"
}
```

**Response:**
```json
{
  "response": "For T5 PvP, the claymore with...",
  "intent": "build",
  "engine": "claude",
  "knowledgeFiles": ["8_weapons_armor.md"]
}
```

---

### Market Prices

**GET** `/api/price/:item?server=west&location=Caerleon`

Get current buy/sell prices for an item.

```bash
curl "http://localhost:3000/api/price/T5%20sword?server=west"
```

**Response:**
```json
{
  "data": [
    {
      "item_id": "T5_MAIN_SWORD",
      "buy_price_max": 1500000,
      "sell_price_min": 1600000,
      "quality": 1,
      "location": "Caerleon"
    }
  ]
}
```

**Batch Prices**
**POST** `/api/prices`

```json
{
  "items": ["T5 sword", "T5 helmet", "T6 armor"],
  "server": "west",
  "locations": ["Caerleon", "Bridgewatch"]
}
```

---

### Price History

**GET** `/api/history/:item?location=Caerleon&timescale=24`

Get price history for trend analysis.

- `timescale`: 6, 24, or 48 hours

```bash
curl "http://localhost:3000/api/history/T5%20sword?timescale=24"
```

---

### Crafting Profit Calculator

**POST** `/api/crafting-profit`

Calculate profit/loss for crafting an item.

```json
{
  "item": "T5 sword",
  "enchantmentLevel": 0,
  "server": "west",
  "location": "Caerleon"
}
```

**Response:**
```json
{
  "success": true,
  "item": "T5_MAIN_SWORD",
  "profit": 180000,
  "profitMargin": "12%",
  "profitsPerHour": 360000,
  "recommendation": "✅ Good profit opportunity!",
  "breakdown": {
    "ingredientCost": 1000000,
    "craftingTax": 80000,
    "enchantmentCost": 0,
    "totalCost": 1080000,
    "sellPrice": 1260000
  }
}
```

---

### Guild Territory Strategy

**POST** `/api/guild/territory-strategy`

Get territory control recommendations.

```json
{
  "members": 50,
  "treasury": 500000,
  "experience": "intermediate"
}
```

**Response:**
```json
{
  "recommendation": "industrial",
  "name": "Industrial Territory",
  "weeklyIncome": "100-200k",
  "defenseLevel": "Medium-High",
  "taxRate": "10%",
  "readiness": {
    "membersOk": true,
    "treasuryOk": true,
    "experienceOk": true
  }
}
```

---

### ZvZ Fleet Composition

**GET** `/api/guild/zvz-composition/:scale`

Get recommended squad compositions for battles.

- `scale`: "small" (5v5), "medium" (15v15), or "large" (40v40)

```bash
curl "http://localhost:3000/api/guild/zvz-composition/medium"
```

**Response:**
```json
{
  "scale": "15v15",
  "totalPlayers": 15,
  "roles": [
    { "role": "Tank", "weapon": "Mace/Shield", "quantity": 3 },
    { "role": "DPS", "weapon": "Sword/Bow", "quantity": 6 },
    { "role": "Healer", "weapon": "Holy/Nature", "quantity": 3 },
    { "role": "CC", "weapon": "Frost/Fire", "quantity": 3 }
  ],
  "tactics": ["Front engage...", "..."],
  "preparation": ["Stock 200 Healing Potions...", "..."]
}
```

---

### Guild Progression Roadmap

**POST** `/api/guild/progression-roadmap`

Get next steps for guild growth.

```json
{
  "members": 75,
  "experience": "beginner",
  "territories": 1
}
```

**Response:**
```json
{
  "current": {
    "stage": "Medium Guild",
    "goal": "Hold 1-2 territories",
    "timeline": "Week 4-8",
    "actions": ["Defend first war", "Establish rotation", "..."]
  },
  "next": {
    "stage": "Growing Guild",
    "goal": "Expand territory",
    "timeline": "Week 8-16"
  }
}
```

---

### Health Check

**GET** `/api/health`

Check server status and configuration.

```json
{
  "status": "ok",
  "uptime": 3600,
  "config": {
    "env": "development",
    "aiModel": "gemini"
  },
  "cache": {
    "size": 512,
    "hits": 1250,
    "misses": 340
  }
}
```

---

## Project Structure

```
Aria/
├── public/                      # Frontend (HTML/CSS/JS)
│   ├── index.html               # Main dashboard
│   ├── css/styles.css           # Styling
│   └── js/app.js                # Client-side logic
│
├── src/                         # Backend (Node.js)
│   ├── server.js                # Express server & routes
│   ├── ai-agent.js              # Claude/Ollama routing
│   ├── brain-loader.js          # Intent detection
│   ├── item-resolver.js         # Fuzzy item search
│   ├── market-api.js            # Albion Data API client
│   ├── market-cache.js          # In-memory cache
│   └── modules/
│       ├── crafting-profit.js   # Profit calculations
│       └── guild-strategist.js  # Guild advice
│
├── albion-brain/                # Knowledge base (9 markdown files)
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
│   └── config.js                # App configuration
│
├── data/
│   └── albion-items.json        # 10K+ items database
│
├── test/                        # Test suite
│   ├── item-resolver.test.js
│   ├── market-api.test.js
│   ├── crafting-profit.test.js
│   └── integration.test.js
│
├── scripts/
│   └── fetch-items.js           # Download item data
│
├── package.json
├── .env                         # Environment variables
└── README.md                    # This file
```

---

## Configuration

### `config.js`

Edit `config/config.js` to customize:

```javascript
module.exports = {
  server: { port: 3000, host: 'localhost' },
  ai: {
    primaryModel: 'gemini',     // or 'ollama'
    contextBudget: 64000,       // Max chars for AI context
    timeout: 30000,             // Request timeout (ms)
  },
  market: {
    cacheTTL: 300000,           // Cache duration (5 min)
    servers: ['West', 'East', 'Europe'],
    retryAttempts: 3,
  },
  brain: {
    filePath: './albion-brain',
    maxContextSize: 64000,
  },
  env: 'development'
};
```

---

## Knowledge Base

### Brain Files Format

The 9 markdown files in `albion-brain/` contain game knowledge. Each file covers a topic:

1. **Basics** - Tiers, progression, resources
2. **Zones** - Map, safety, portals
3. **PvE** - Dungeons, bosses, strategies
4. **PvP** - Hellgates, faction wars, ZvZ
5. **Economy** - Market, flipping, trends
6. **Crafting** - Recipes, profits, taxes
7. **Farming** - Islands, crops, mists
8. **Weapons** - Item builds, enchantments
9. **Guilds** - Territory, warfare, progression

### Guidelines for Brain Files

- Keep summaries concise (AI context budget: 64KB)
- Use tables for data (prices, stats)
- Include decision trees for advice
- Cross-reference between files
- Use concrete numbers (tier progression, damage values)
- Format: Clear section headers, bullet points

---

## Testing

Run the test suite:

```bash
npm test
```

Coverage:
- Item resolver (fuzzy search accuracy)
- Market API (caching, failure handling)
- Crafting profit calculations
- AI routing logic
- Integration tests (end-to-end queries)

---

## Performance Tips

### Optimize Queries
- Use specific item names ("T5 sword" vs "sword")
- Narrow down server/location when checking prices
- Cache results on the frontend for frequently checked items

### Scaling
- The market cache is in-memory; consider Redis for production
- Brain files are loaded into AI context; keep them under 64KB total
- Item resolver uses Fuse.js; indexing is fast for 10K items

### Monitoring
- Check `/api/health` for cache hit rates
- Monitor server uptime and request latency
- Log API errors for debugging

---

## Troubleshooting

### "Item data not found"
```bash
node scripts/fetch-items.js  # Re-download items
```

### AI service timeout
- Check internet connection
- Verify API key in `.env`
- Try Ollama mode for local LLM

### Market API unavailable
- Verify Albion Data Project is online
- Check server connectivity
- Cache will serve stale data (5 min old)

### Brain files not loaded
- Verify file paths in `config/config.js`
- Check file format (markdown, UTF-8)
- Restart server to reload

---

## Deployment

### Docker
Create `Dockerfile`:
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install && node scripts/fetch-items.js
EXPOSE 3000
CMD ["npm", "start"]
```

Build & run:
```bash
docker build -t aria .
docker run -e AI_MODEL=ollama -p 3000:3000 aria
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure real API keys
- [ ] Use Redis for cache (not in-memory)
- [ ] Set up error logging (Sentry, etc.)
- [ ] Configure HTTPS
- [ ] Set rate limiting
- [ ] Add monitoring/alerting

---

## Contributing

Ideas for improvements:
- More comprehensive crafting recipes
- Historical price tracking
- Discord bot integration
- Mobile app
- Player statistics dashboard
- Auction price prediction ML model
- Multi-language support

---

## License

MIT - Free to use and modify.

---

## Support

- **Bug Reports**: Check `/src/server.js` logs
- **Questions**: Review the knowledge base (`albion-brain/`)
- **API Issues**: Check `/api/health` endpoint

---

**Aria** — Strategic advantage for Albion Online players. ⚔️
