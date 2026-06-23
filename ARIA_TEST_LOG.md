# Aria System Test Log

**Test Date:** 2026-06-23  
**Environment:** Local Node.js test runner on Windows / Asia-Manila timezone  
**Engine Build Status:** Static data layer, live data parsers, market modules, AI provider fallback chain

---

## 1. Test Execution Summary

| Command | Result | Tests | Passed | Failed | Skipped | Duration |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: |
| `npm test` | Pass | 69 | 69 | 0 | 0 | 10061.2536 ms |

No code changes were made as part of this test pass.

---

## 2. Coverage Areas Exercised

| Area | Result | Notes |
| :--- | :--- | :--- |
| AI provider fallback chain | Pass | Covered provider success, OpenRouter fallback, quota threshold skip, provider exhaustion, and non-retryable provider errors. |
| API key header validation | Pass | Covered supported provider/model pairs and rejection of unsupported provider or model headers. |
| `/api/ask` provider validation | Pass | Confirmed missing provider headers and unsupported model requests return `400`. |
| Malformed AI output handling | Pass | Confirmed malformed model JSON returns `503` instead of silently passing invalid output. |
| Brain loader and retrieval | Pass | Covered chunk parsing, table preservation, top chunk retrieval, embedding ranking, and missing embedding index reporting. |
| Crafting profit calculator | Pass | Covered invalid item handling, short queries, known recipe profit calculation, enchantment handling, recommendations, Gameinfo recipe loading, and silver fee inclusion. |
| Guild strategist module | Pass | Covered territory strategy, ZvZ composition, progression roadmap, and alliance analysis scenarios. |
| Integration flow | Pass | Covered item resolution into strategy generation, invalid input handling, and resolved item format consistency. |
| Item resolver | Pass | Covered fuzzy item lookup, invalid queries, multi-item resolution, and minimum query length behavior. |
| Market analyzer | Pass | Covered deterministic tax-adjusted margins, loss-making scenarios, computed JSON passed to LLM narration, and trend spread/profit calculation. |
| Market cache | Pass | Covered storage, retrieval, missing keys, TTL expiry, stats, and large payload handling. |
| OpenAlbion loader | Pass | Covered weapon stats, armor stats, spell slot grouping, and missing identifiers. |
| Response schemas | Pass | Covered example validation, schema selection/rejection, and malformed model JSON parser errors. |

---

## 3. Observed Non-Failing Warnings

| ID | Subsystem | Observation | Impact | Follow-up |
| :--- | :--- | :--- | :--- | :--- |
| AR-W01 | AI provider fallback chain | OpenRouter was unavailable during one path and fallback behavior was exercised: `openrouter unavailable; trying next provider: rate limited`. | None for this test run; expected fallback path passed. | Keep monitoring provider quota and fallback behavior in live usage. |
| AR-W02 | AI provider fallback chain | OpenRouter daily local quota threshold was reached: `45/45`; provider was skipped. | None for tests; confirms quota guard behavior. | Reset or raise quota if live testing requires OpenRouter calls. |
| AR-W03 | Gemini static context cache | Gemini cache creation returned `Cached content is too small`, with `total_token_count=397` below `min_total_token_count=1024`. | None for tests; system continued without cache. | Treat as informational unless cache usage becomes required for performance. |
| AR-W04 | Brain retrieval | Embedding retrieval fell back to lexical scoring because `GOOGLE_API_KEY` was not configured. | None for tests; lexical fallback passed. | Configure `GOOGLE_API_KEY` when validating embedding-backed retrieval specifically. |

---

## 4. Bug Tracker

| Bug ID | Subsystem / Page | Error Description & Symptoms | Steps to Reproduce | Impact | Suggested Implementation Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AR-E01 | N/A | No failing test defects observed in this run. | Run `npm test`. | None | No code fix required from this test pass. |

---

## 5. Manual Validation Still Recommended

| Area | Reason |
| :--- | :--- |
| Browser dashboard UI | Automated tests did not perform browser visual or interaction QA. |
| Live Albion Data Project endpoints | The suite exercises integration and data handling, but this run should not be treated as full live market endpoint certification. |
| Resource Return Rate math against hand-calculated Albion examples | Crafting profit tests passed, but a separate manual ground-truth RRR matrix is still useful for economic confidence. |
| Crafting station usage fee math against current production data | Tests confirm silver fee inclusion, but manual checks against live or newly imported data remain recommended. |
| Real provider-key chat flows | Provider fallback behavior passed, but full live LLM behavior depends on configured keys, quotas, and provider availability. |

