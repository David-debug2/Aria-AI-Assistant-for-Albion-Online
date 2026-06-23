# Contributing to Aria

Welcome. This guide is written for **everyone** — whether you're an experienced developer, a complete beginner, or someone who just plays Albion Online and wants to help improve the game knowledge without touching any code.

---

## Table of Contents

1. [What kind of contributor are you?](#1-what-kind-of-contributor-are-you)
2. [How the project is organized](#2-how-the-project-is-organized)
3. [For non-coders: editing game knowledge](#3-for-non-coders-editing-game-knowledge)
4. [For new developers: setting up the project](#4-for-new-developers-setting-up-the-project)
5. [For developers: making code changes](#5-for-developers-making-code-changes)
6. [How to document what you changed](#6-how-to-document-what-you-changed)
7. [The golden rules](#7-the-golden-rules)

---

## 1. What kind of contributor are you?

**I play Albion Online and want to fix outdated or wrong game info**
→ Go to [Section 3](#3-for-non-coders-editing-game-knowledge). You don't need to write code.

**I'm new to this project and want to understand it before changing anything**
→ Go to [Section 2](#2-how-the-project-is-organized), then [Section 4](#4-for-new-developers-setting-up-the-project).

**I'm a developer who wants to add a feature or fix a bug**
→ Go to [Section 4](#4-for-new-developers-setting-up-the-project) and [Section 5](#5-for-developers-making-code-changes).

---

## 2. How the project is organized

Aria has two distinct parts that rarely need to be changed at the same time:

### Part 1: The Knowledge (albion-brain/)
This is a collection of 9 plain text files written in Markdown (a simple document format). Each file covers one topic about Albion Online — economy, crafting, PvP, etc. These files are what the AI reads to answer questions. **You can edit these without writing a single line of code.**

### Part 2: The Application (src/, public/, scripts/)
This is the code that runs the server, fetches market data, calculates crafting profits, and talks to the AI. You need basic JavaScript knowledge to work here.

### The separation is intentional
If Albion Online releases a patch that changes how ore refining works, a player who knows the game can fix `albion-brain/6_crafting_refining.md` directly — no developer needed. This keeps the knowledge up-to-date without a code deployment.

---

## 3. For non-coders: editing game knowledge

### What you can edit
All files inside the `albion-brain/` folder. Here's what each one covers:

| File | Topic |
|---|---|
| `1_basics_progression.md` | Tiers, character progression, gear basics |
| `2_world_zones_mists.md` | Map zones (safe, red, black), The Mists |
| `3_pve_activities.md` | Dungeons, bosses, expeditions |
| `4_pvp_factions_zvz.md` | PvP, Hellgates, faction wars, ZvZ |
| `5_economy_market.md` | Trading, flipping, silver-making |
| `6_crafting_refining.md` | Crafting recipes, refining, taxes |
| `7_farming_islands.md` | Personal islands, crops, fishing |
| `8_weapons_armor.md` | Weapon types, armor classes, builds |
| `9_guild_management.md` | Guilds, territory control, alliance |

### How to edit them

1. Open the file in any text editor (even Notepad works)
2. Find the section that's wrong or outdated
3. Fix the numbers, add a row to a table, update a strategy tip
4. Save the file

That's it. The AI will use your updated information the next time the server restarts.

### What "Markdown" looks like (and why it's easy)

Markdown is just text with a few simple symbols:

```
# Big heading
## Medium heading
### Small heading

- Bullet point
- Another bullet point

| Column 1 | Column 2 |     ← This is a table
|----------|----------|
| Row data | Row data |
```

You don't need to learn anything special. Just look at the existing content and copy the same style.

### Rules for editing brain files

**DO:**
- ✅ Use real numbers (exact silver values, tier numbers, percentages)
- ✅ Keep sections short — 3–8 bullet points or a small table
- ✅ Add a note with the date if you're updating for a specific patch: `_(Updated: 2026-06-01 for Patch X.Y)_`
- ✅ Check `BRAIN.md` in the root folder for full authoring guidelines

**DON'T:**
- ❌ Add daily/weekly price fluctuations — live prices come from the market API, not brain files
- ❌ Write long paragraphs — the AI works better with structured, bullet-pointed information
- ❌ Make the total size of all 9 files exceed 64KB (check `BRAIN.md` for current usage)

---

## 4. For new developers: setting up the project

### Prerequisites (what you need installed)
- **Node.js 18 or higher** — the runtime that runs JavaScript on a server ([download here](https://nodejs.org))
- **npm** — comes bundled with Node.js automatically
- A **text editor** — VS Code is recommended ([download here](https://code.visualstudio.com))
- A **Google API key** (optional but needed for the AI to work) — get one at [Google AI Studio](https://aistudio.google.com)

### Setup steps

```bash
# 1. Get the code onto your computer
git clone <your-repo-url>
cd Aria

# 2. Install all dependencies (third-party packages)
npm install

# 3. Download the Albion item database (10,000+ items)
node scripts/fetch-items.js

# 4. Create your personal config file
# Copy .env.example to .env (or create .env manually)
# Add your Google API key:
#   GOOGLE_API_KEY=your_key_here
#   AI_MODEL=gemini
#   PORT=3000

# 5. Start the server
npm start

# 6. Open your browser and go to:
#    http://localhost:3000
```

### Verify it's working

- The chat tab should load and show a welcome message from Aria
- Type "What's the best T5 sword for PvP?" and you should get an answer
- If you see an error about the API key, check your `.env` file

### Run the tests

```bash
npm test
```

All tests should pass on a fresh setup. If any fail, check that `data/albion-items.json` exists (step 3 above).

### Suggested reading order (for new devs)
1. `README.md` — quick overview and API reference
2. `docs/versions/ALPHA.md` — what the first version was and why
3. `docs/CHANGELOG.md` — what has changed since Alpha
4. `src/server.js` — start here to understand how requests flow
5. `src/ai-agent.js` — how the AI is called and which model is chosen
6. `src/brain-loader.js` — how knowledge context is selected

---

## 5. For developers: making code changes

### Before you start

- Read `docs/CHANGELOG.md` to understand the current state of the project
- Read `docs/aria-architecture-upgrade-plan.md` if you're working on a planned feature — your work may already be scoped there
- Check `docs/decisions/` for any ADRs related to the area you're changing — don't re-decide what's already been decided

### Branch and commit conventions

```bash
# Create a branch named after what you're doing
git checkout -b feature/embedding-retrieval
git checkout -b fix/ollama-routing
git checkout -b docs/update-weapons-brain

# Commit messages: short and imperative
git commit -m "Add section-level chunking to brain-loader"
git commit -m "Fix Ollama intent routing never firing"
git commit -m "Update T5 sword prices in weapons brain file"
```

### Before submitting changes

- [ ] Run `npm test` — all tests must pass
- [ ] If you added a new feature, add a test for it
- [ ] If you made an architectural decision, write an ADR (see `docs/decisions/ADR-000-template.md`)
- [ ] Update `docs/CHANGELOG.md` with what you changed
- [ ] If you changed a brain file, verify total corpus size is under 64KB

### Where to put different kinds of code

| What you're building | Where it goes |
|---|---|
| New API endpoint | `src/server.js` |
| New AI behavior or model routing | `src/ai-agent.js` |
| New knowledge topic | New file in `albion-brain/` |
| New calculation (profit, margin, etc.) | `src/modules/` |
| New data fetching script | `scripts/` |
| New test | `test/` — mirror the filename of the module being tested |

---

## 6. How to document what you changed

This project uses three types of documentation. Each serves a different purpose:

### Type 1: CHANGELOG.md
**What it's for:** Tracking what changed between versions, for everyone (devs and non-coders alike).
**When to update it:** Every time you add, change, fix, or remove something meaningful.
**How to write it:** One plain-English line per change. "Added T6 recipe support to crafting calculator" — not "Modified the CRAFTING_RECIPES object in crafting-profit.js."

### Type 2: ADRs (Architecture Decision Records)
**What they're for:** Recording *why* a significant technical decision was made — what alternatives were considered and rejected, what trade-offs were accepted.
**When to write one:** When you make a decision that would be expensive to reverse, or when a future developer might wonder "why was it done this way?"
**How to write one:** Copy `docs/decisions/ADR-000-template.md`, fill it in, number it sequentially (ADR-001, ADR-002, etc.), and link it from the CHANGELOG.

### Type 3: Inline code comments
**What they're for:** Explaining *why* a specific piece of code does something non-obvious.
**When to write one:** When the code alone doesn't explain the reason — edge cases, workarounds, known limitations.
**What NOT to write:** Don't restate what the code does. `// increment counter` under `counter++` is useless. `// sliding window reset to prevent burst attacks at window edges` is valuable.

---

## 7. The golden rules

1. **Update the CHANGELOG when you ship something.** Future developers (and future you) will thank you.

2. **Write ADRs for decisions that would take more than 10 minutes to explain verbally.** A 10-minute write-up prevents a 2-hour debate later.

3. **Don't edit brain files for daily price fluctuations.** Live prices come from the market API. Brain files carry strategic knowledge that's stable for months.

4. **Keep brain files under the 64KB total budget.** The AI has a context limit. If all 9 files together exceed 64KB, the oldest sections get cut off silently.

5. **Never delete an ADR.** If a decision changes, write a new ADR that says "supersedes ADR-00X." The history is the value.

6. **Tests are required for new logic.** Not for everything — but any new calculation, lookup function, or routing decision needs a test. Look at the existing test files for examples.

7. **Plain English first.** Whether it's a commit message, a CHANGELOG entry, or a brain file edit — write it so a player, not just a programmer, can understand it.

---

*Questions? Read `README.md` for setup help, `BRAIN.md` for brain file guidelines, and `docs/aria-architecture-upgrade-plan.md` for where the project is headed.*
