# ADR-006: OpenAlbion and Gameinfo Data Sources

## Status

**Accepted**

---

## Date

2026-06-23

---

## What This Decision Is About

Alpha's brain files described weapon, armor, and crafting details with approximate values. Aria needed real item stats, spells, consumable data, and gear recipes without hand-maintaining large tables.

---

## The Decision

Use OpenAlbion for item lists, stats, spells, consumable stats, and consumable recipes; use Albion Gameinfo item endpoints for gear crafting recipes; store all fetched output as regenerable local JSON files.

---

## Why This Option Was Chosen

- OpenAlbion provides clean stat and spell data suited to build advice.
- Gameinfo exposes gear crafting requirements in a direct per-item JSON shape.
- Generated local JSON keeps runtime lookups fast and avoids live API calls during user requests.
- OpenAlbion and Gameinfo data can be refreshed after Albion patches.
- Hardcoded recipes remain as a fallback when generated data is absent.

---

## Alternatives That Were Considered

### Option: Keep hand-maintained brain tables
- **What it is:** Continue editing weapon stats and recipes manually in markdown/code.
- **Pros:** No data fetch pipeline.
- **Why rejected:** Manual numbers drift after patches and do not scale to many items.

### Option: Use ao-bin-dumps XML for all data
- **What it is:** Parse Albion's extracted game data dumps directly.
- **Pros:** Deep and comprehensive source.
- **Why rejected:** It requires a larger parser and mapping layer than Beta needs. Gameinfo already returns the gear recipe fields Aria consumes.

### Option: Query OpenAlbion/Gameinfo live per request
- **What it is:** Fetch stats and recipes during each user request.
- **Pros:** Always freshest data.
- **Why rejected:** It adds latency and external API failure risk to normal chat/crafting flows.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| Generated files can become stale after a game patch. | Re-run `npm run fetch-openalbion` after Albion patches. |
| Generated files are large. | They are gitignored and loaded locally when present. |
| Gameinfo stat fields may be inaccurate for some gear. | Stats come from OpenAlbion; Gameinfo is used only for recipes. |
| External APIs can fail during fetches. | The fetch script logs item-level warnings and continues where possible. |

---

## Files Changed

| File | Change |
|---|---|
| `scripts/fetch-openalbion.js` | Fetches OpenAlbion and Gameinfo data into local JSON files. |
| `src/openalbion-loader.js` | Adds in-memory indexes for stats and spells. |
| `src/modules/crafting-profit.js` | Loads generated consumable and gear recipes. |
| `src/modules/build-advisor.js` | Injects stat and spell data into build prompts. |
| `src/server.js` | Returns the enriched crafting profit breakdown. |
| `public/js/app.js` | Renders silver fee and ingredient details. |
| `albion-brain/8_weapons_armor.md` | Adds real stat and spell reference content. |
| `albion-brain/6_crafting_refining.md` | Adds real consumable reference content. |
| `test/openalbion-loader.test.js` | Covers loader lookups. |
| `test/crafting-profit.test.js` | Covers Gameinfo recipe cost handling. |

---

## How to Verify It's Working

- Run `npm run fetch-openalbion`.
- Run `npm test`.
- Confirm `getWeaponStats('T4_2H_AXE', 'Normal', 0)` returns a real stat row.
- Calculate crafting profit for a Gameinfo-backed gear item and confirm `breakdown.silverFee` is present.

---

## Related Decisions

- Depends on: ADR-003
- Supersedes: None
- Related: None

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance. If the decision changes, write a new ADR that supersedes this one.*
