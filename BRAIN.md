# Aria Brain Files - Content Guidelines

This document explains the structure and purpose of the 9 knowledge files that power Aria's strategic advice.

## Overview

The brain files (`albion-brain/*.md`) are markdown documents that contain game knowledge about Albion Online. They are loaded into the AI's context when processing queries, allowing it to provide accurate, game-specific advice.

### File Organization

| File | Topic | Purpose |
|------|-------|---------|
| 1_basics_progression.md | Core systems | Tier progression, enchantments, resource fundamentals |
| 2_world_zones_mists.md | World map | Zone types, safety levels, territory system |
| 3_pve_activities.md | PvE content | Dungeons, expeditions, PvE strategies |
| 4_pvp_factions_zvz.md | PvP systems | Hellgates, faction wars, large-scale ZvZ warfare |
| 5_economy_market.md | Economy | Trading, flipping, market mechanics, profit strategies |
| 6_crafting_refining.md | Crafting | Recipes, profit calculations, taxes, material costs |
| 7_farming_islands.md | Farming | Island management, fishing, passive income |
| 8_weapons_armor.md | Gear | Weapon trees, armor types, builds, enchantments |
| 9_guild_management.md | Guilds | Territory control, ZvZ tactics, guild progression |

---

## File Structure Best Practices

### Format
- Use markdown headers: `#` (H1 for title), `##` (H2 for sections), `###` (H3 for subsections)
- Use bullet points for lists
- Use tables for numerical data
- Keep paragraphs concise (1-3 sentences)

### Content Guidelines

**DO:**
- ✅ Include concrete numbers (damage values, prices, timescales)
- ✅ Use decision trees (e.g., "If new player → recommend T4 gear → solo dungeons")
- ✅ Cross-reference between files (e.g., "See weapons_armor.md for build examples")
- ✅ Provide actionable advice (e.g., "Best for X" instead of just "What is X?")
- ✅ Use headers to organize sections logically
- ✅ Include tables for comparing options

**DON'T:**
- ❌ Include long narrative paragraphs (keep summaries brief)
- ❌ Duplicate information from other files (link instead)
- ❌ Include personal opinions without data ("I think X is best")
- ❌ Use outdated patch notes without marking them
- ❌ Exceed 64KB total for all 9 files combined (AI context limit)
- ❌ Include real-time data that changes daily (prices, rankings)

### Example Section Structure

```markdown
## Activity Type

### Key Facts
- Requirement: What's needed
- Duration: How long it takes
- Reward: What you get
- Difficulty: Relative challenge

### Strategy
1. First step
2. Second step
3. Third step

### Income Comparison
| Method | Time | Reward | Risk |
|--------|------|--------|------|
| Option A | 30 min | 100k | Low |
| Option B | 1 hour | 200k | High |
```

---

## Content Maintenance

### When to Update

Update brain files when:
- New patch changes game mechanics significantly
- Market prices shift dramatically (yearly seasonal changes)
- New raid tiers or dungeons are added
- Community meta shifts significantly

**Don't update for:**
- Daily/weekly price fluctuations (these are live in the market API)
- Individual player kills or achievements
- Temporary balance changes that may revert

### Versioning

Mark updates in a section comment:
```markdown
## Market Trends (Updated: 2026-06-20)
```

This helps track when information was last verified.

---

## Quality Checklist

Before committing brain file changes:

- [ ] All numbers are accurate and current
- [ ] No duplicate content (check other files first)
- [ ] Headers use proper hierarchy (#, ##, ###)
- [ ] Tables are readable and well-aligned
- [ ] Cross-references include file names
- [ ] Total size of all 9 files < 64KB
- [ ] No outdated patch notes without timestamp
- [ ] At least one decision tree or example
- [ ] Actionable advice provided (not just facts)
- [ ] Mobile-friendly (no huge tables or complex formatting)

---

## Integration with AI

### How Brain Files Are Used

1. **Query Processing**: When a player asks a question, Aria detects the intent
2. **Context Loading**: Relevant brain files are loaded based on intent
3. **AI Generation**: Claude/Gemini uses the brain content + live data to answer
4. **Response**: Player gets game-specific, data-driven advice

### Intent Categories

The brain loader recognizes these intents and loads related files:

| Intent | Keywords | Files Loaded |
|--------|----------|--------------|
| farming | farm, crop, herb, gather | 7_farming_islands.md |
| crafting | craft, recipe, refine, enchant | 6_crafting_refining.md |
| market | price, flip, profit, margin | 5_economy_market.md |
| pvp | gank, hellgate, faction, zvz | 4_pvp_factions_zvz.md |
| pve | dungeon, boss, mob, expedition | 3_pve_activities.md |
| guild | territory, alliance, war | 9_guild_management.md |
| build | gear, weapon, armor, loadout | 8_weapons_armor.md |
| zone | zone, map, mist, black zone | 2_world_zones_mists.md |
| beginner | new, start, tutorial, help | 1_basics_progression.md |

---

## Example: Creating a New Brain Section

### Task: Add "Best Gold Farming Routes" to 7_farming_islands.md

**Wrong approach:**
```markdown
### Gold Farming

Gold farming is a method to earn currency. You can farm in many zones.
The best zones are those with high drops. People usually farm at certain times.
```
❌ Vague, no data, not actionable

**Right approach:**
```markdown
### Best Gold Farming Routes

| Zone | Yield/Hour | Risk | Time (hours) | Total Yield |
|------|-----------|------|--------|--------|
| Lymhurst (Red) | 150k | Medium | 2-3 | 350k |
| Bridgewatch (Yellow) | 80k | Low | 2-3 | 200k |
| Black Zone (Solo) | 200k | High | 1-2 | 300k |

**Best Route Strategy:**
1. Check zone activity: Are other players farming?
2. Time your runs: Dawn/dusk = fewer gankers
3. Bring backup gear: One death = lost loot
4. Rotate zones: Prevents predictable patterns

**Recommendation:** New farmers start in yellow zones (Bridgewatch).
Experienced players farm red zones in groups.
```
✅ Data-driven, actionable, includes decision logic

---

## Tools & Resources

### Markdown Linting
Check your markdown:
```bash
npm run lint-brain  # (future feature)
```

### Content Validation
- Use `npm test` to verify file size limits
- AI context budget: 64KB max for all 9 files
- Check `/api/health` for actual brain file sizes loaded

### External References

**Albion Online Resources:**
- Official Wiki: https://wiki.albiononline.com/
- Albion Data Project: https://www.albion-online-data.com/
- Community Guides: Reddit r/albiononline

---

## FAQ

**Q: Should I add detailed build guides?**
A: Yes, but keep them concise. Link to external wikis if needed. Focus on strategic choices (Why use this build?) rather than exact stat values.

**Q: How often should I update prices in the brain files?**
A: Don't. Prices are live in the market API. Brain files should reference price ranges or seasonal trends, not exact values.

**Q: Can I add images or videos?**
A: Not in markdown files (brain storage), but you could add them to the dashboard frontend separately.

**Q: What if I find an error in the brain files?**
A: Open an issue or PR with the correction. Include the source (patch notes, community consensus, etc.).

**Q: How do I test that my changes work?**
A: 1. Query Aria with a related question. 2. Check that the response uses your new information. 3. Verify accuracy.

---

## Contributing New Content

### Process

1. **Research**: Gather accurate game info
2. **Edit**: Update relevant brain file
3. **Validate**: Check against quality checklist
4. **Test**: Ask Aria a related question
5. **Submit**: Create PR with context

### Example PR Description

```
Add guild treasury management tips to 9_guild_management.md

- Clarifies the difference between war funds and emergency reserves
- Adds budget examples for small/medium/large guilds
- Includes seasonal spending patterns

Verified against: Patch 1.12, community feedback
```

---

## Performance Notes

### Context Budget

All 9 brain files combined must fit in the AI's context window:
- Total limit: 64,000 characters
- Current usage: ~45KB (plenty of room for expansion)
- Per-query loading: Only relevant files are used

### Optimization

If brain files exceed 64KB:
1. Remove redundant content (move to external wiki link)
2. Condense examples (keep 1-2 per section)
3. Reduce table sizes (focus on top options)
4. Archive outdated sections in comments

---

**Aria Brain Files** — The knowledge engine powering strategic advice. 🧠
