# Phase 0 Brain Retrieval Checkpoint

Manual verification captured after the section-level lexical chunking change.

## Chunk Counts

| File | Chunks | Average chunk size |
| --- | ---: | ---: |
| 1_basics_progression.md | 6 | 363 chars |
| 2_world_zones_mists.md | 9 | 242 chars |
| 3_pve_activities.md | 5 | 534 chars |
| 4_pvp_factions_zvz.md | 7 | 582 chars |
| 5_economy_market.md | 8 | 388 chars |
| 6_crafting_refining.md | 7 | 503 chars |
| 7_farming_islands.md | 7 | 577 chars |
| 8_weapons_armor.md | 5 | 1063 chars |
| 9_guild_management.md | 8 | 670 chars |

## Context Reduction Samples

Old length approximates the previous whole-file `MODULE_MAP` context length for the detected intent. New length is the chunked `loadBrainContext()` output.

| Query | Intent | Old chars | New chars | Reduction | Retrieved sections |
| --- | --- | ---: | ---: | ---: | --- |
| how do I refine ore | crafting | 11413 | 1298 | 89% | 6_crafting_refining.md: Gathering & Refining Loop; Refining Profits |
| best T5 PvP build | pvp | 12271 | 2776 | 77% | 4_pvp_factions_zvz.md: Hellgates, Guild PvP Progression, PvP Income Paths, PvP Mechanics; 8_weapons_armor.md: Best Beginner Builds (T5) |
| where should a beginner farm silver | farming | 11413 | 2721 | 76% | 7_farming_islands.md: Mists Farming, Open World Farming, Passive Income Farming Summary, New Player Farming Strategy; 3_pve_activities.md: Beginner PvE Rotation; 8_weapons_armor.md: Best Beginner Builds (T5) |
| how do market flips work | market | 7149 | 1624 | 77% | 5_economy_market.md: Market Mechanics, Market Trends & Cycles; 8_weapons_armor.md: Market Prices (Approximate T5) |
| guild territory war prep | guild | 13334 | 5264 | 61% | 4_pvp_factions_zvz.md: ZvZ, Guild PvP Progression; 9_guild_management.md: Guild Progression, Guild Treasury Management, Guild Recommendations, Territory Control |

