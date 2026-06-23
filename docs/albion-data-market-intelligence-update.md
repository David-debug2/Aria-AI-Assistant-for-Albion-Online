# Albion Data Market Intelligence Implementation Plan

## Overview

Aria should evolve from a REST-only Albion market lookup helper into a region-aware market intelligence layer.

The near-term goal is to make the existing Albion Online Data REST usage correct and complete. The medium-term goal is to normalize public Albion Data payloads into a local freshness-aware market snapshot. The long-term goal is to combine daily dumps, deduped NATS streams, and structured wiki/game-data parsing so market, crafting, gold, faction, and build advice can use fresher and more precise data.

The main boundary is explicit: Aria consumes public APIs, public NATS streams, database dumps, and wiki/game-data endpoints. Aria must not copy packet capture behavior from `ao-data/albiondata-client`.

## Source Findings

### Albion Online Data Developer/API Docs

The Albion Online Data docs define the public consumer surface:

- REST APIs exist for current prices, history, charts, and gold.
- Region-specific hosts are required:
  - West/Americas: `https://west.albion-online-data.com`
  - East/Asia: `https://east.albion-online-data.com`
  - Europe: `https://europe.albion-online-data.com`
- Public NATS streams expose live market, history, gold, and bandit event data.
- Deduped NATS topics are safer for consumers than raw ingest topics.
- Daily database exports can provide bulk startup data.
- REST usage must respect batching and rate limits.

Useful REST endpoint shapes:

```text
/api/v2/stats/prices/{item_ids}?locations=...&qualities=...
/api/v2/stats/history/{item_ids}?locations=...&qualities=...&time-scale=...
/api/v2/stats/history/{item_ids}?date=YYYY-MM-DD&end_date=YYYY-MM-DD
/api/v2/stats/charts/{item_ids}.json
/api/v2/stats/gold.json?count=2
/api/v2/stats/gold.json?date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

Documented history timescales:

- `time-scale=1` for hourly buckets
- `time-scale=6` for 6-hour buckets
- `time-scale=24` for daily buckets

Operational constraints:

- API URLs have a practical 4096-character limit.
- The docs encourage batching many item/location requests into one URL while respecting that limit.
- Rate limits are 180 requests per minute and 300 requests per 5 minutes.

### `ao-data/albiondata-client`

The client repo explains the producer side:

- It is a Go packet-capture client that watches local Albion Online UDP traffic.
- It uploads decoded public data to Albion Data ingest services.
- It distinguishes West/East/Europe from Albion server IP ranges and maps them to region-specific ingest URLs.
- It separates public and private upload paths. Aria should only consume public data.

Public data types worth modeling:

- Market orders: item id, location id, quality, enchantment, unit silver price, amount, auction type, and expiry.
- Market history: item id, location id, quality, timescale, item amount, silver amount, and timestamp.
- Gold prices: arrays of prices and Unix timestamps.
- Bandit events: `EventTime` and `Phase`.

Known public ingest topics include:

```text
marketorders.ingest
markethistories.ingest
goldprices.ingest
banditevent.ingest
```

For Aria consumption, prefer public deduped NATS topics from the developer docs:

```text
marketorders.deduped
markethistories.deduped
goldprices.deduped
```

Bandit event support should use the public event stream when available. Private upload data, such as skills and personal market notifications, should stay out of Aria.

### Wiki/API Parser Research

The reviewed wiki/API samples show that Aria should use separate parser modes instead of one generic parser.

| Source | Example Page | Useful | Parser Type |
| --- | --- | ---: | --- |
| Weapon tree parse | `Sword Fighter` | Yes | weapon tree parser |
| Item page parse | `Adept's Broadsword` | Yes | item/equipment parser |
| Ability page parse | `Heroic Strike` | Yes | ability parser |
| Mechanics page parse | `Crafting` | Yes | mechanics parser |
| Economy page parse | `Marketplace` | Yes | mechanics/economy parser |
| PvP page parse | `Faction Warfare` | Yes | mechanics/PvP parser |
| Categories | all categories | Yes | discovery only |
| Weapon category members | weapon category | Yes | seed discovery |
| Raw wikitext | `Sword Fighter` raw | Partly | fallback/inspection |
| Semantic MediaWiki ask | `[[Category:Weapon]]` | Yes | discovery only |

Highest-value extractable data:

- weapon families and item IDs from `Template:Weapon tree`
- spell tables from `Template:Weapon tree spells`
- item recipes from `Template:Recipe`
- item stat tables from `Template:WeaponFullInfo`
- ability details from `Template:Ability`
- patch notes from `Template:Patchnote related`
- category discovery from `allcategories`, `categorymembers`, and Semantic MediaWiki `ask`

Recommended parser modes:

- Weapon Tree Parser: triggered by `Template:Weapon tree` and `Template:Weapon tree spells`; extracts weapon summaries, categories, family links, item tables, spell tables, and related patch notes.
- Item Parser: triggered by `Template:WeaponFullInfo`, `Template:Item infobox`, and `Template:Recipe`; extracts item IDs, tiers, weight, item value, recipes, ingredients, stats, and patch notes.
- Ability Parser: triggered by `Template:Ability`, `Template:Ability/Data`, and `Template:Ability Info`; extracts ability name, weapon/category, slot, energy, cast time, range, cooldown, effects, equipment list, and patch notes.
- Mechanics Parser: used for pages like `Crafting`, `Marketplace`, `Faction Warfare`, `Guild`, and `Player Island`; extracts title, categories, intro paragraphs, headings, useful tables, links, and patch notes.

Discovery strategy:

- Use `list=allcategories` to find categories such as `Ability`, `Armor`, `Crafting`, `Economy`, `Guild`, `Gathering Gear`, and weapon ability categories.
- Use `list=categorymembers&cmtitle=Category:Weapon` to seed weapon tree pages like `Axe Fighter`, `Bow Fighter`, and `Sword Fighter`.
- Use Semantic MediaWiki `action=ask&query=[[Category:Weapon]]` for page listing, but do not depend on it for rich structured properties until printouts are proven useful.
- Use raw wikitext for template inspection, but prefer rendered `action=parse` HTML for extraction because templates are expanded into tables.

## Current Aria Gaps

Current file: `src/market-api.js`

What already matches the Albion Online Data REST docs:

- Aria uses the three regional hosts:
  - `west` -> `https://west.albion-online-data.com`
  - `east` -> `https://east.albion-online-data.com`
  - `europe` -> `https://europe.albion-online-data.com`
- Aria uses the correct current price endpoint shape:

```text
/api/v2/stats/prices/{item_ids}?locations=...&qualities=...
```

- Aria resolves human item names through `item-resolver.js`.
- Aria caches market responses through `market-cache.js`.
- Aria filters out rows with no buy or sell price.

Gaps to close:

1. `getPriceHistory()` is hardcoded to `SERVERS.west`; it must accept the selected server.
2. The public `/api/history/:item` route clamps timescale to `6` through `48`, but the API documents only `1`, `6`, and `24`.
3. History requests do not expose `qualities`, even though the API supports quality filtering.
4. History requests do not support `date` and `end_date`.
5. Aria does not use the charts endpoint.
6. Aria does not expose gold price data.
7. Aria batches item IDs but does not split requests by URL length.
8. Aria has cache protection but no queue, retry, or 429-aware backoff.

## Architecture Decisions

- REST remains the baseline path. It is simple, already integrated, and enough for direct price, history, chart, and gold lookups.
- Server correctness is mandatory before new data layers. Region-aware history and documented timescales come before NATS, dumps, or snapshots.
- Shared normalizers come before storage. Market order, history, gold, and bandit payloads should have one internal shape before multiple data sources feed them.
- Local snapshot data should be freshness-aware. Every derived price should be able to report when it was last seen or refreshed.
- Deduped NATS topics are the default live stream input. Raw ingest topics are producer-side details and should not be used by Aria unless a future debugging tool needs them.
- Packet capture is out of scope. Aria should not inspect game network traffic or reproduce `albiondata-client` behavior.
- Wiki parsing should be mode-specific. Weapon, item, ability, and mechanics pages expose different structures and should not share one generic parser.

## Task List

### Phase 1: REST Correctness and API Parity

#### Task 1: Make history region-aware

**Description:** Update market history retrieval so it uses the selected Albion Data region instead of always calling West.

**Acceptance criteria:**

- [ ] `getPriceHistory()` accepts `server = 'west'` in its public signature.
- [ ] History requests use the same server resolution behavior as `getPrices()`.
- [ ] `/api/history/:item` accepts a `server` query param and passes it through.

**Verification:**

- [ ] Unit test confirms an East history request calls `https://east.albion-online-data.com`.
- [ ] Unit test confirms an Europe history request calls `https://europe.albion-online-data.com`.
- [ ] Existing market analyzer tests still pass.

**Dependencies:** None

**Files likely touched:**

- `src/market-api.js`
- `src/server.js`
- `test/market-api.test.js` or new market API test file

**Estimated scope:** S

#### Task 2: Correct history timescale and filters

**Description:** Align history options with the documented API by supporting only `1`, `6`, and `24`, and by adding optional quality and date-range filters.

**Acceptance criteria:**

- [ ] `/api/history/:item` accepts `timescale=1|6|24`.
- [ ] Unsupported timescales are rejected with a 400 or normalized through one documented policy.
- [ ] History supports optional `quality`, `date`, and `endDate` inputs.
- [ ] Outgoing REST query uses `qualities`, `date`, and `end_date` when provided.

**Verification:**

- [ ] Unit test covers each supported timescale.
- [ ] Unit test covers unsupported timescale handling.
- [ ] Unit test confirms `endDate` maps to `end_date`.

**Dependencies:** Task 1

**Files likely touched:**

- `src/market-api.js`
- `src/server.js`
- `README.md`

**Estimated scope:** S

#### Task 3: Build URL query generation with structured parameters

**Description:** Replace hand-built market query strings with structured query generation so optional filters remain predictable.

**Acceptance criteria:**

- [ ] Price and history URLs are built with `URLSearchParams`.
- [ ] Existing default price behavior remains unchanged.
- [ ] Empty optional values are not emitted into query strings.

**Verification:**

- [ ] Unit tests compare generated URLs for price and history calls.
- [ ] Existing price endpoint behavior remains compatible.

**Dependencies:** Task 2

**Files likely touched:**

- `src/market-api.js`
- market API tests

**Estimated scope:** XS

### Phase 2: Albion Data Schemas and Normalizers

#### Task 4: Define normalized public Albion Data payloads

**Description:** Add internal normalized shapes for market orders, market history, gold prices, and bandit events.

**Acceptance criteria:**

- [ ] Normalizer exists for market order payloads.
- [ ] Normalizer exists for market history payloads.
- [ ] Normalizer exists for gold price payloads.
- [ ] Normalizer exists for bandit event payloads.
- [ ] Bandit event C# ticks can be converted into JavaScript timestamps.

**Verification:**

- [ ] Fixture tests cover one valid payload for each data type.
- [ ] Invalid or incomplete payloads fail predictably without crashing callers.

**Dependencies:** None

**Files likely touched:**

- new `src/albion-data-normalizers.js` or equivalent
- new fixture tests

**Estimated scope:** M

#### Task 5: Document normalized payload contracts

**Description:** Record the internal field contracts so REST, dumps, NATS, and tests all target the same shapes.

**Acceptance criteria:**

- [ ] Normalized market order fields include item, location, quality, enchantment, price, amount, auction type, expiry, source, and freshness timestamp.
- [ ] Normalized market history fields include item, location, quality, timescale, item amount, silver amount, timestamp, source, and freshness timestamp.
- [ ] Normalized gold fields include price, timestamp, server, source, and freshness timestamp.
- [ ] Normalized bandit fields include phase, event timestamp, server when known, source, and freshness timestamp.

**Verification:**

- [ ] Tests or inline docs make field names unambiguous.
- [ ] No consumer has to know the original producer payload shape.

**Dependencies:** Task 4

**Files likely touched:**

- normalizer module
- normalizer tests
- this planning doc only if field names change during implementation

**Estimated scope:** S

### Checkpoint: REST and Schema Foundation

- [ ] `npm test` passes.
- [ ] `/api/history/:item` is region-correct.
- [ ] History timescale behavior matches the Albion Online Data docs.
- [ ] Normalized public Albion Data payloads are covered by tests.
- [ ] Root `README.md` documents any changed history API shape.

### Phase 3: Gold, Charts, Batching, and Rate-Limit Handling

#### Task 6: Add gold price REST support

**Description:** Add a REST client function and HTTP endpoint for Albion gold prices.

**Acceptance criteria:**

- [ ] `getGoldPrices(server, options)` calls the selected regional host.
- [ ] Supports `count`, `date`, and `endDate` options.
- [ ] Server exposes `/api/gold`.
- [ ] Responses include cache metadata consistent with existing market calls.

**Verification:**

- [ ] Unit test confirms URL generation for count-based gold lookup.
- [ ] Unit test confirms URL generation for date-range gold lookup.
- [ ] Endpoint test confirms `/api/gold?server=east&count=2` passes the selected server.

**Dependencies:** Task 3

**Files likely touched:**

- `src/market-api.js`
- `src/server.js`
- market API and route tests
- `README.md`

**Estimated scope:** S

#### Task 7: Add charts REST support

**Description:** Add a chart data client and endpoint for frontend trend visualizations.

**Acceptance criteria:**

- [ ] `getCharts(itemQueries, server, options)` resolves item names like `getPrices()`.
- [ ] Supports selected server, locations, qualities, and documented date filters when applicable.
- [ ] Server exposes `/api/charts/:item` or a documented batch equivalent.

**Verification:**

- [ ] Unit test confirms item names are resolved before chart URL generation.
- [ ] Unit test confirms selected server host is used.
- [ ] Manual or endpoint test confirms chart response shape is passed through safely.

**Dependencies:** Task 3

**Files likely touched:**

- `src/market-api.js`
- `src/server.js`
- tests
- `README.md`

**Estimated scope:** M

#### Task 8: Add URL-length-safe request batching

**Description:** Split large current-price requests before they exceed the documented URL limit.

**Acceptance criteria:**

- [ ] Batched price requests keep every outgoing URL under the configured limit.
- [ ] Multiple batch responses are flattened into the existing response shape.
- [ ] Cache keys remain deterministic for equivalent item/location inputs.

**Verification:**

- [ ] Unit test generates enough item IDs to require multiple requests.
- [ ] Unit test confirms no generated URL exceeds the configured limit.
- [ ] Existing `getPrices()` callers continue to receive `{ data, fromCache }` style responses.

**Dependencies:** Task 3

**Files likely touched:**

- `src/market-api.js`
- market API tests

**Estimated scope:** M

#### Task 9: Add rate-limit and transient-error backoff

**Description:** Add deterministic retry handling for 429 and transient 5xx responses without hiding permanent failures.

**Acceptance criteria:**

- [ ] 429 responses retry with bounded backoff.
- [ ] Transient 5xx responses retry with bounded backoff.
- [ ] Permanent 4xx responses fail without retry.
- [ ] Final error messages remain user-safe and do not expose internal stack traces.

**Verification:**

- [ ] Stubbed fetch test confirms 429 retry behavior.
- [ ] Stubbed fetch test confirms permanent 400 does not retry.
- [ ] Stubbed fetch test confirms retry exhaustion returns the expected error shape.

**Dependencies:** Task 8

**Files likely touched:**

- `src/market-api.js`
- market API tests

**Estimated scope:** M

### Phase 4: Local Market Snapshot

#### Task 10: Build in-memory market snapshot store

**Description:** Create a local store for normalized active market orders keyed by item, location, quality, enchantment, and auction type.

**Acceptance criteria:**

- [ ] Snapshot accepts normalized market order payloads.
- [ ] Snapshot can return best sell and best buy entries for an item/location set.
- [ ] Each entry tracks `lastSeenAt`.
- [ ] Stale entries can be removed or ignored through a configurable age threshold.

**Verification:**

- [ ] Unit test inserts multiple buy and sell orders and returns best prices.
- [ ] Unit test confirms stale entries are ignored or removed.
- [ ] Unit test confirms different quality/enchantment values do not collide.

**Dependencies:** Task 4

**Files likely touched:**

- new market snapshot module
- snapshot tests

**Estimated scope:** M

#### Task 11: Add snapshot-backed market lookup path

**Description:** Allow market reads to prefer fresh local snapshot data while retaining REST fallback for missing or stale data.

**Acceptance criteria:**

- [ ] Price lookup can return fresh snapshot data when available.
- [ ] REST fallback remains available when snapshot data is missing.
- [ ] Responses expose freshness metadata when sourced from snapshot data.

**Verification:**

- [ ] Unit test covers snapshot hit.
- [ ] Unit test covers REST fallback.
- [ ] Existing REST-only tests still pass.

**Dependencies:** Task 10

**Files likely touched:**

- market snapshot module
- `src/market-api.js` or a market service module
- tests

**Estimated scope:** M

### Checkpoint: REST Coverage and Snapshot Baseline

- [ ] `npm test` passes.
- [ ] Gold and charts endpoints are documented.
- [ ] Large batched price requests are URL-safe.
- [ ] 429 and transient-error handling is covered by tests.
- [ ] Snapshot lookups work without requiring NATS or database dumps.

### Phase 5: Daily Dump Warm Start

#### Task 12: Add daily dump importer

**Description:** Load Albion Online Data daily database exports per region into the local snapshot store.

**Acceptance criteria:**

- [ ] Importer supports West, East, and Europe dump sources.
- [ ] Imported rows are normalized before entering the snapshot.
- [ ] Import can be run at startup or by script without requiring NATS.
- [ ] Import failures leave REST fallback available.

**Verification:**

- [ ] Fixture import test loads representative rows into the snapshot.
- [ ] Test confirms malformed rows are skipped or reported without aborting the entire import.
- [ ] Manual dry run documents import duration and row count.

**Dependencies:** Tasks 4 and 10

**Files likely touched:**

- dump importer module or script
- snapshot module
- tests
- `README.md` or `CONTRIBUTING.md` if setup changes

**Estimated scope:** M

#### Task 13: Add dump freshness reporting

**Description:** Surface how old the warm-start data is so market advice can distinguish current stream data from startup data.

**Acceptance criteria:**

- [ ] Imported snapshot entries include source and freshness timestamp.
- [ ] Health or debug output can report last successful dump import per region.
- [ ] Market responses can warn when data is older than the configured freshness threshold.

**Verification:**

- [ ] Unit test confirms imported entries retain source metadata.
- [ ] Unit test confirms stale warm-start data emits a freshness warning.

**Dependencies:** Task 12

**Files likely touched:**

- dump importer
- snapshot module
- `src/server.js` health/debug route if used
- tests

**Estimated scope:** S

### Phase 6: NATS Live Updates

#### Task 14: Add public deduped NATS subscriber

**Description:** Subscribe to public deduped market, history, and gold topics and feed normalized messages into local stores.

**Acceptance criteria:**

- [ ] Subscriber uses deduped public topics by default.
- [ ] Market order messages update the snapshot store.
- [ ] Market history and gold messages are normalized and cached or stored for future use.
- [ ] Subscriber can be disabled by config for local development.

**Verification:**

- [ ] Unit test or integration stub confirms each topic routes to the correct normalizer.
- [ ] Local startup works when NATS is disabled.
- [ ] Subscriber errors do not crash REST-only mode.

**Dependencies:** Tasks 4, 10, and 12

**Files likely touched:**

- new NATS subscriber module
- config
- snapshot/store modules
- tests

**Estimated scope:** M

#### Task 15: Add live data freshness monitoring

**Description:** Track when each region and topic last received live data.

**Acceptance criteria:**

- [ ] Last message timestamp is tracked per server/topic.
- [ ] Health output reports live stream freshness.
- [ ] Feature code can determine whether live data is fresh enough to trust.

**Verification:**

- [ ] Unit test confirms timestamps update per topic.
- [ ] Health route test confirms freshness metadata appears without exposing secrets.

**Dependencies:** Task 14

**Files likely touched:**

- NATS subscriber module
- health route or market diagnostics
- tests

**Estimated scope:** S

### Checkpoint: Warm Start and Live Updates

- [ ] `npm test` passes.
- [ ] App can run in REST-only mode.
- [ ] App can warm-start from dumps.
- [ ] App can consume deduped NATS messages when enabled.
- [ ] Health output distinguishes REST-only, dump, and live-stream freshness.

### Phase 7: Freshness-Aware Feature Upgrades

#### Task 16: Upgrade flip detection to use snapshot data

**Description:** Replace the small static flip watchlist with snapshot-backed scanning across many items and cities.

**Acceptance criteria:**

- [ ] Flip candidates can be generated from snapshot data.
- [ ] Ranking includes spread, tax-adjusted profit, volume/amount, route risk, and freshness.
- [ ] Existing deterministic margin math remains in JavaScript.

**Verification:**

- [ ] Unit test ranks profitable and loss-making snapshot scenarios.
- [ ] Unit test confirms stale data lowers confidence or is excluded according to the chosen policy.
- [ ] Existing market analyzer tests still pass.

**Dependencies:** Task 11

**Files likely touched:**

- `src/modules/market-analyzer.js`
- market snapshot module
- tests

**Estimated scope:** M

#### Task 17: Upgrade crafting profit to report freshness

**Description:** Use snapshot-backed prices for ingredient and output lookups when available, and include freshness warnings in crafting responses.

**Acceptance criteria:**

- [ ] Ingredient prices can come from fresh snapshot data.
- [ ] Output sell/buy price can come from fresh snapshot data.
- [ ] Response includes freshness warnings when any critical price is stale.
- [ ] REST fallback remains available.

**Verification:**

- [ ] Unit test covers all-fresh crafting data.
- [ ] Unit test covers stale ingredient warning.
- [ ] Existing crafting profit tests still pass.

**Dependencies:** Task 11

**Files likely touched:**

- `src/modules/crafting-profit.js`
- market service/snapshot module
- tests

**Estimated scope:** M

#### Task 18: Add gold and bandit advice hooks

**Description:** Make gold and bandit event data available to AI/guild advice without embedding source-specific payloads in prompts.

**Acceptance criteria:**

- [ ] Gold trend summaries can be generated from normalized gold data.
- [ ] Bandit event phase and timestamp can be consumed by guild/faction advice.
- [ ] AI prompts receive compact summarized data, not raw event streams.

**Verification:**

- [ ] Unit test covers gold trend summary generation.
- [ ] Unit test covers C# tick conversion for bandit events.
- [ ] Manual prompt inspection confirms summaries are compact.

**Dependencies:** Tasks 4, 6, and 14

**Files likely touched:**

- market/gold summary module
- `src/modules/guild-strategist.js` or related advice module
- tests

**Estimated scope:** M

### Phase 8: Wiki Parser Pipeline

#### Task 19: Add discovery pipeline for wiki pages

**Description:** Build page discovery using categories, category members, and Semantic MediaWiki listing queries.

**Acceptance criteria:**

- [ ] Discovery can list relevant weapon, ability, item, and mechanics pages.
- [ ] Semantic MediaWiki `ask` is used only for listing unless rich printouts are verified.
- [ ] Discovery output is deterministic and cacheable.

**Verification:**

- [ ] Fixture test covers allcategories response.
- [ ] Fixture test covers weapon category members.
- [ ] Fixture test covers Semantic MediaWiki listing response with empty printouts.

**Dependencies:** None

**Files likely touched:**

- new wiki fetch/discovery script or module
- fixtures and tests

**Estimated scope:** M

#### Task 20: Add Weapon Tree and Item parsers

**Description:** Implement the two highest-value parser modes first: weapon tree and item/equipment pages.

**Acceptance criteria:**

- [ ] Weapon Tree Parser extracts weapon summary, categories, item rows, spell rows, and patch notes.
- [ ] Item Parser extracts item ID, tier, recipe data, ingredients, stats, and patch notes.
- [ ] Rendered `action=parse` HTML is preferred for extraction.
- [ ] Raw wikitext remains a fallback/inspection input only.

**Verification:**

- [ ] Fixture test parses `Sword Fighter`.
- [ ] Fixture test parses `Adept's Broadsword`.
- [ ] Parsed item IDs match render URL IDs such as `T4_MAIN_SWORD`.

**Dependencies:** Task 19

**Files likely touched:**

- wiki parser module
- parser tests and fixtures

**Estimated scope:** M

#### Task 21: Add Ability and Mechanics parsers

**Description:** Add the remaining parser modes for ability pages and general mechanics pages.

**Acceptance criteria:**

- [ ] Ability Parser extracts name, weapon/category, slot, energy, cast time, range, cooldown, effects, equipment list, and patch notes.
- [ ] Mechanics Parser extracts title, categories, intro paragraphs, headings, useful tables, important links, and patch notes.
- [ ] Parser mode selection is based on page templates or page type.

**Verification:**

- [ ] Fixture test parses `Heroic Strike`.
- [ ] Fixture test parses `Crafting`.
- [ ] Fixture test parses `Marketplace` or `Faction Warfare`.

**Dependencies:** Task 20

**Files likely touched:**

- wiki parser module
- parser tests and fixtures

**Estimated scope:** M

### Checkpoint: Feature Integration and Wiki Pipeline

- [ ] `npm test` passes.
- [ ] Flip and crafting advice include freshness-aware market data.
- [ ] Gold and bandit summaries are available for advice modules.
- [ ] Wiki parser pipeline handles weapon, item, ability, and mechanics fixtures.
- [ ] Generated or parsed data has documented refresh steps.

## Checkpoints

Use these review gates to keep implementation safe:

1. REST and Schema Foundation after Tasks 1-5.
2. REST Coverage and Snapshot Baseline after Tasks 6-11.
3. Warm Start and Live Updates after Tasks 12-15.
4. Feature Integration and Wiki Pipeline after Tasks 16-21.

Each checkpoint requires:

- [ ] `npm test` passes.
- [ ] Any public API change is reflected in root `README.md`.
- [ ] Any new setup step is reflected in `CONTRIBUTING.md`.
- [ ] Any new architecture decision that involved real alternatives is captured in an ADR.
- [ ] Any completed task in `docs/aria-architecture-upgrade-plan.md`, if applicable, is marked complete.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| History remains region-wrong while new features are added | High | Complete Phase 1 before snapshot, dump, or NATS work. |
| API rate limits are hit during broad scans | High | Add URL batching and bounded backoff before snapshot-backed broad scanning. |
| Snapshot data becomes stale and misleads advice | High | Track `lastSeenAt`, source, and freshness warnings from the first snapshot task. |
| NATS stream outages break the app | Medium | Keep REST-only mode working and make NATS configurable. |
| Daily dump format differs from live stream payloads | Medium | Normalize all dump rows through the same public payload contracts. |
| Wiki templates vary by page type | Medium | Use mode-specific parsers and fixture tests instead of one generic parser. |
| Packet-capture scope creeps into Aria | High | Keep the boundary explicit: consume public data only. |
| Large parser or NATS tasks become too broad | Medium | Keep each phase independently testable and split tasks further if a task grows beyond 3-5 files. |

## Acceptance Checklist

- [ ] The existing Albion Online Data REST findings are preserved.
- [ ] The `ao-data/albiondata-client` producer-side findings are preserved.
- [ ] The current Aria `market-api.js` comparison is preserved.
- [ ] The wiki/API parser findings are preserved.
- [ ] The document has explicit architecture decisions.
- [ ] Every task has description, acceptance criteria, verification, dependencies, likely files, and scope estimate.
- [ ] Checkpoints appear after every 2-3 phases.
- [ ] The plan keeps the repository working after each checkpoint.
- [ ] No task requires packet capture.
- [ ] Public API/interface changes are documented before implementation starts.
- [ ] Test scenarios cover REST correctness, normalizers, batching, retries, snapshot freshness, live updates, and parser fixtures.
