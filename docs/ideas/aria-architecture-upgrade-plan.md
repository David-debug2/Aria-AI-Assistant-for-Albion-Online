# Implementation Plan: Aria Architecture Efficiency Upgrade

## Overview

Aria currently spends most of its tokens on two structural habits: `brain-loader.js` injects entire markdown files (5-8KB each, three per query) instead of the few relevant sentences, and `market-analyzer.js` asks the LLM to do arithmetic that should happen in JavaScript. This plan fixes both, migrates off a dead SDK that's blocking the fix, repairs a local-model routing path that's currently unreachable, and adds a multi-provider free-tier fallback chain so Aria isn't dependent on a single vendor's rate limits. Each phase leaves the app in a working, testable state.

## Architecture Decisions

- **No vector database for now.** The 9 brain files total ~45KB (per `BRAIN.md`'s stated budget). Chunked into ~150-250 sections, a flat in-memory array scored with cosine similarity is sub-millisecond — standing up ChromaDB or Supabase Vector would be infrastructure for a problem this corpus doesn't have yet. Revisit only if brain content grows past a few hundred KB or per-guild custom knowledge gets added.
- **Migrate `@google/generative-ai` → `@google/genai` before anything else.** The old package reached end-of-life August 31, 2025 (no further bug fixes). The new client is also what exposes `ai.caches.create()` and clean `responseSchema` support, so this isn't optional groundwork — it's a dependency of Phases 3 and 4.
- **Lexical chunking ships before embeddings.** Phase 0 reuses the keyword list already in `config.js` to score header-delimited sections instead of whole files. It's a same-day change with no new dependencies and establishes a token-count baseline to measure the embedding upgrade against.
- **Math stays in JS, narration stays in the LLM.** `crafting-profit.js` already does this correctly. `market-analyzer.js` does not — that gap gets closed in Phase 5, which also unlocks Phase 6 (those calls become simple "summarize this JSON" tasks suited to a local model).
- **Free-tier providers are stacked, not swapped.** OpenRouter (50 req/day), Cloudflare Workers AI (10,000 Neurons/day, resets 00:00 UTC), and local Ollama each have independent limits. Chaining them as ordered fallbacks rather than picking one gives meaningfully more free daily capacity than any single provider, with Gemini Flash as the paid floor if all three are exhausted.

## Task List

### Phase 0: Section-Level Lexical Chunking

#### Task 1: Parse brain files into header-delimited sections
**Description:** Add a parser that splits each `albion-brain/*.md` file on `##`/`###` boundaries into `{heading, content, sourceFile}` chunks at load time.
**Acceptance criteria:**
- [ ] Each markdown file produces 3-10 chunks matching its existing header structure
- [ ] Tables and their preceding heading stay in the same chunk (no mid-table splits)

**Verification:**
- [ ] Manual check: log chunk count and average chunk size for all 9 files
**Dependencies:** None
**Files likely touched:** `src/brain-loader.js`
**Estimated scope:** S (1 file)

#### Task 2: Replace whole-file selection with top-K chunk scoring
**Description:** Reuse `config.js`'s `intentKeywords` to score each chunk (simple term-overlap count) instead of selecting whole files via `MODULE_MAP`. Return the top-K chunks (start with K=6) up to the existing `MAX_CONTEXT_CHARS` budget.
**Acceptance criteria:**
- [ ] `loadBrainContext()` returns the same shape (`{context, intent, filesLoaded}`) so callers in `ai-agent.js` don't change
- [ ] A representative query (e.g. "how do I refine ore") pulls only the relevant 1-2 sections, not entire files

**Verification:**
- [ ] `npm test` passes (no existing test asserts on file-level loading, but confirm none break)
- [ ] Manual check: compare `context.length` before/after for 5 sample queries; expect 60-70%+ reduction
**Dependencies:** Task 1
**Files likely touched:** `src/brain-loader.js`
**Estimated scope:** M (1 file, but the scoring logic needs care)

### Checkpoint: Phase 0
- [ ] All existing tests pass
- [ ] Logged token/char reduction documented for at least 5 representative queries
- [ ] Review with human before proceeding

---

### Phase 1: User-Supplied API Key System

Perfect. Public-facing + user-supplied keys is the most security-sensitive combination.

#### Phase 1A: Expand

Given Aria's context - public-facing, Node/Express backend, existing `ai-agent.js` with hardcoded Gemini - these are the directions worth considering:

**A. Frontend-Only Key Storage (Zero-Trust Backend)**
User enters a key in the UI, it lives in `sessionStorage` only, and it gets sent with every `/api/ask` request as a header. The backend never stores it. This is safest for users and simplest to build.

**B. OpenRouter as the Universal Gateway**
Instead of supporting five providers separately, support one gateway first: OpenRouter. One API key format, one API shape, and access to GPT, Gemini, Claude, Mistral, and Llama models through a single model dropdown. This massively reduces code complexity.

**C. Provider-Aware Backend with Per-Request Key Injection**
User selects provider + model + pastes a key in the UI. The frontend sends provider metadata and the key to the Express backend. The backend routes to the correct provider handler. This is more code but gives more flexibility.

**D. Encrypted Server-Side Session Key**
User enters a key once, backend encrypts it with a server secret and stores it in a session cookie. Subsequent requests do not resend the key. Cleaner UX, but higher backend complexity.

**E. 10x Version - Aria as a Multi-Tenant SaaS**
Users create accounts, store encrypted keys server-side per user profile, and pick a default provider. This is eventually useful but overkill for the current architecture.

**F. Simplest Possible - Environment Variable UI**
Admin-only settings page that writes to `.env`. Not per-user. Useful only if Aria is private or single-deployer. It does not fit the public-facing requirement.

#### Phase 1B: Converge and Stress-Test

| Direction | Security | Build Cost | UX | Fits Public-Facing? |
|---|---|---|---|---|
| A. Frontend-Only | Best | Low | Good | Yes |
| B. OpenRouter Gateway | Good | Lowest | Best | Yes |
| C. Provider-Aware Backend | Key in transit | Medium | Good | Yes |
| D. Encrypted Session | Good | High | Best | Yes |
| E. SaaS Multi-Tenant | Best | Very High | Best | Eventually |
| F. Env Var UI | Poor | Trivial | Poor | No |

**Hidden assumptions to surface:**

- Users must be comfortable pasting API keys into a third-party UI, so Aria must be explicit about where the key goes.
- Direction C sends the raw API key over HTTPS on every request. That is acceptable with TLS and unacceptable without it.
- Direction B is not just a shortcut. OpenRouter is the right abstraction for this use case because it already covers the multi-model routing need that Phase 7 was heading toward.

**Honest pushback on supporting all providers natively:** Building and maintaining separate SDK integrations for OpenAI, Gemini, Claude, Azure, and Copilot is several times more work than OpenRouter, with little user-visible benefit. The only strong reason to support native providers is that some users already have direct provider keys and do not want to create an OpenRouter account.

#### Phase 1C: Recommended Direction

Use a hybrid of **A + B**:

> User-supplied key, stored in `sessionStorage` only, routed through a thin provider-abstraction layer on the backend, with OpenRouter as the recommended/default path and native fallbacks for users who already have direct provider keys.

Build a settings panel in the existing sidebar UI. The user selects a provider, picks a model, and pastes an API key. The key is stored in `sessionStorage`; it is never written to a database and is cleared when the tab closes. Every request to `/api/ask` passes the key as an `X-Provider-Key` header alongside `X-Provider` and `X-Model`. The backend reads provider settings from the request, not from `.env`, and routes accordingly.

**Provider strategy:** OpenRouter covers GPT, Claude, Gemini, Mistral, and Llama under one key format, so it should be the default "works with everything" option. Add native handlers for OpenAI, Anthropic Claude, and Google Gemini for users who already have direct keys. Skip Azure and Copilot in the MVP because their OAuth, tenant, and pricing models add disproportionate complexity.

**Why `sessionStorage` over `localStorage`:** Keys do not survive tab close, reducing risk if a user shares a computer. The UI should show a clear notice: "Your API key is stored in your browser session only and is sent to the server only to forward your AI request."

#### Task 3: Add frontend provider settings
**Description:** Add a settings panel in the sidebar or chat view with provider dropdown, hardcoded model dropdown, API key input, and a key status indicator.
**Acceptance criteria:**
- [ ] Provider choices include OpenRouter, OpenAI, Anthropic Claude, and Google Gemini
- [ ] Model dropdown values are hardcoded per provider
- [ ] API key is stored in `sessionStorage`, not `localStorage`
- [ ] UI shows key set / no key state

**Verification:**
- [ ] Refresh keeps the key within the same tab session
- [ ] Closing and reopening the tab clears the key
**Dependencies:** None
**Files likely touched:** `public/index.html`, `public/js/app.js`, `public/css/styles.css`
**Estimated scope:** M (UI + state handling)

#### Task 4: Pass provider settings to `/api/ask`
**Description:** Update chat submission so `/api/ask` sends `X-Provider-Key`, `X-Provider`, and `X-Model` headers from the session settings.
**Acceptance criteria:**
- [ ] Chat requests include provider headers when a key is configured
- [ ] Chat requests fail early with a clear UI message if no key is configured for a user-facing provider
- [ ] API keys are never logged in the browser console

**Verification:**
- [ ] Browser devtools confirms headers are present on `/api/ask`
- [ ] Browser storage confirms the key only exists in session storage
**Dependencies:** Task 3
**Files likely touched:** `public/js/app.js`
**Estimated scope:** S (frontend request wiring)

#### Task 5: Add backend provider routing
**Description:** Update `server.js` and `ai-agent.js` so the selected provider, model, and per-request API key flow into the AI call. Add provider handlers for OpenRouter, OpenAI, Anthropic, and Gemini. Keep Ollama as a server-side-only option configured through `.env`, not through the public UI.
**Acceptance criteria:**
- [ ] Backend reads provider settings from request headers
- [ ] Backend validates provider and model against a hardcoded allowlist
- [ ] Backend never logs `X-Provider-Key`
- [ ] OpenRouter is the default recommended provider
- [ ] Ollama remains available only via server-side config and is not exposed as a public API-key option

**Verification:**
- [ ] Manual `/api/ask` smoke test succeeds with OpenRouter
- [ ] Manual `/api/ask` smoke test succeeds with at least one native provider key
- [ ] Invalid provider/model returns a 400 without calling an AI provider
**Dependencies:** Task 4
**Files likely touched:** `src/server.js`, `src/ai-agent.js`, possibly `config/config.js`
**Estimated scope:** M (routing + provider functions)

#### Task 6: Document the key handling model
**Description:** Add documentation explaining where keys are stored, how they are transmitted, what is not stored server-side, and why Azure/Copilot are excluded from MVP.
**Acceptance criteria:**
- [ ] `docs/ideas/user-supplied-api-keys.md` exists
- [ ] README or docs link points users/developers to the key-handling model
- [ ] Security language matches implementation behavior

**Verification:**
- [ ] Search confirms no docs claim keys are server-stored
**Dependencies:** Task 5
**Files likely touched:** `docs/ideas/user-supplied-api-keys.md`, `README.md` or `docs/README.md`
**Estimated scope:** S (docs)

### Checkpoint: Phase 1
- [ ] `/api/ask` smoke-tested manually with OpenRouter
- [ ] `/api/ask` rejects missing/invalid provider config cleanly
- [ ] No API key is persisted outside browser `sessionStorage`
- [ ] No API key appears in server logs, browser logs, or test snapshots
- [ ] Ollama remains server-side only
- [ ] Hardcoded model lists are documented
- [ ] Review with human before proceeding

---

### Phase 2: Embedding-Based Retrieval

#### Task 5: Build an offline embedding script for brain chunks
**Description:** A build-time script that embeds every chunk from Task 1 using a Gemini embedding model and writes `data/brain-embeddings.json` (chunk text + vector + source file).
**Acceptance criteria:**
- [ ] Script runs via `npm run embed-brain` and produces one vector per chunk
- [ ] Output file is gitignored (regenerable, not checked in) like `data/albion-items.json`

**Verification:**
- [ ] Script completes without errors against the live 9 brain files
**Dependencies:** Task 1, Task 4
**Files likely touched:** `scripts/embed-brain.js` (new), `package.json`, `.gitignore`
**Estimated scope:** M (new file + wiring)

#### Task 6: Add cosine-similarity retrieval
**Description:** A `retrieveChunks(queryEmbedding, k)` function that loads `brain-embeddings.json` once at startup and does brute-force cosine similarity against all chunks.
**Acceptance criteria:**
- [ ] Returns top-K chunks ranked by similarity score
- [ ] Handles the missing-file case the same way `item-resolver.js` handles a missing `albion-items.json` (clear error pointing at the generation script)

**Verification:**
- [ ] Unit test: known query embedding retrieves the expected chunk from a small fixture set
**Dependencies:** Task 5
**Files likely touched:** `src/brain-loader.js`
**Estimated scope:** M (1 file, math needs a test)

#### Task 7: Wire runtime query embedding into `loadBrainContext`
**Description:** Embed the incoming user query at request time, call `retrieveChunks`, and use embedding-based retrieval as the primary path with Phase 0's lexical scoring as a fallback if the embedding call fails.
**Acceptance criteria:**
- [ ] `loadBrainContext()` signature is unchanged for callers
- [ ] Fallback to lexical scoring is logged, not silent

**Verification:**
- [ ] `npm test` passes
- [ ] Manual check: same 5 sample queries from Phase 0, compare retrieved sections for relevance
**Dependencies:** Task 6
**Files likely touched:** `src/brain-loader.js`
**Estimated scope:** S (1 file)

### Checkpoint: Phase 2
- [ ] Token/char reduction re-measured against Phase 0 baseline
- [ ] Spot-check 10 queries across all 9 intent categories for retrieval relevance
- [ ] Review with human before proceeding

---

### Phase 3: Structured JSON Output

#### Task 8: Define response schemas
**Description:** A schema per response shape Aria currently returns as markdown prose (chat answer, build recommendation, flip ranking).
**Acceptance criteria:**
- [ ] Schemas live in one place (e.g. `src/schemas.js`) and are reused across call sites

**Verification:**
- [ ] Schemas validate against 2-3 hand-written example responses
**Dependencies:** Task 4
**Files likely touched:** `src/schemas.js` (new)
**Estimated scope:** S

#### Task 9: Apply `responseSchema`/`responseMimeType` to generation calls
**Description:** Pass the relevant schema into `config` on `generateContent` calls in `ai-agent.js`, parse the returned JSON, update `/api/ask`'s response shape in `server.js`.
**Acceptance criteria:**
- [ ] `/api/ask` returns structured JSON fields instead of a single markdown string
- [ ] Malformed model output is caught and surfaced as a 503, not a silent crash

**Verification:**
- [ ] `npm test` passes
- [ ] Manual check against `/api/ask`
**Dependencies:** Task 8
**Files likely touched:** `src/ai-agent.js`, `src/server.js`
**Estimated scope:** M

#### Task 10: Update frontend rendering
**Description:** `app.js`'s `handleChatSubmit` currently does `data.response` as a raw string. Update to render the new structured fields.
**Acceptance criteria:**
- [ ] Chat tab renders correctly with no raw JSON visible to the user

**Verification:**
- [ ] Manual check in browser
**Dependencies:** Task 9
**Files likely touched:** `public/js/app.js`
**Estimated scope:** M

### Checkpoint: Phase 3
- [ ] Full chat flow tested end to end in the browser
- [ ] Review with human before proceeding

---

### Phase 4: Explicit Context Caching

#### Task 11: Cache the static system prompt and reference tables
**Description:** Use `ai.caches.create()` to cache `SYSTEM_PROMPT` plus any static numeric reference data (tier costs, tax rates) that doesn't change per-query.
**Acceptance criteria:**
- [ ] Cache handle is created once at server startup, not per-request

**Verification:**
- [ ] Manual check: inspect API response `usageMetadata` for `cachedContentTokenCount > 0` on the second+ request
**Dependencies:** Task 4
**Files likely touched:** `src/ai-agent.js`
**Estimated scope:** S

#### Task 12: Handle cache expiry and refresh
**Description:** Caches have a TTL; add a refresh check so an expired cache handle doesn't cause request failures.
**Acceptance criteria:**
- [ ] Server recovers gracefully if the cache has expired (recreates it, doesn't 500)

**Verification:**
- [ ] Manual check: force an expired/invalid cache ID and confirm fallback works
**Dependencies:** Task 11
**Files likely touched:** `src/ai-agent.js`
**Estimated scope:** S

### Checkpoint: Phase 4
- [ ] Confirm via logged `usageMetadata` that cached tokens are being billed at the discounted rate across multiple requests
- [ ] Review with human before proceeding

---

### Phase 5: Move Flip Math Out of the LLM

#### Task 13: Extract a shared margin/tax calculation helper
**Description:** Pull the margin math pattern out of `crafting-profit.js` into a reusable helper so `market-analyzer.js` doesn't duplicate logic.
**Acceptance criteria:**
- [ ] `crafting-profit.js` is refactored to use the shared helper with no behavior change (existing tests still pass)

**Verification:**
- [ ] `npm test` (existing `crafting-profit.test.js`) passes unmodified
**Dependencies:** None
**Files likely touched:** `src/modules/calc-helpers.js` (new), `src/modules/crafting-profit.js`
**Estimated scope:** S

#### Task 14: Refactor `findBestFlips` and `analyzeTrend` to compute in JS
**Description:** Compute spread, margin, and tax-adjusted profit for each watchlist item in JS; pass only the ranked, computed JSON to the LLM with a narrowed prompt ("narrate this ranked list," not "calculate profit").
**Acceptance criteria:**
- [ ] LLM prompt no longer asks the model to do arithmetic
- [ ] Output profit figures are deterministic (same input price data always yields the same ranking)

**Verification:**
- [ ] Manual check: verify computed margins match a hand-calculated example
**Dependencies:** Task 13
**Files likely touched:** `src/modules/market-analyzer.js`
**Estimated scope:** M

#### Task 15: Add test coverage
**Description:** Mirror `test/crafting-profit.test.js`'s structure for the new computed-margin logic in `market-analyzer.js`.
**Acceptance criteria:**
- [ ] Tests cover at least one profitable and one loss-making scenario

**Verification:**
- [ ] `npm test` passes
**Dependencies:** Task 14
**Files likely touched:** `test/market-analyzer.test.js` (new)
**Estimated scope:** S

### Checkpoint: Phase 5
- [ ] `npm test` green across the full suite
- [ ] Review with human before proceeding

---

### Phase 6: Fix Dead Ollama Routing

**Phase goal:** Turn the new Phase 5 "compute in JS, narrate JSON" call sites into the first real users of the local-model path. This phase should not broaden Ollama routing globally; it should only route narration-only prompts that already have deterministic computed data.

**Current connection:** Task 14 already changes `market-analyzer.js` so `findBestFlips()` and `analyzeTrend()` compute margins in JS and pass ranked/summary JSON to `ask()`. Those call sites currently still force the normal `market` intent, which keeps `chooseEngine()` on Gemini Flash. Phase 6 changes that specific handoff to `forceIntent: 'summarize'`, updates the matching tests, and then verifies the existing Ollama-to-Gemini fallback path.

#### Task 16: Route computed market narration through `summarize`
**Description:** `chooseEngine()` checks `OLLAMA_INTENTS = {summarize, format, list}`, but `detectIntent()` in `brain-loader.js` only returns gameplay/domain intents such as `market`. The local Ollama branch therefore remains unreachable unless a caller intentionally forces one of the Ollama intents. Change the Phase 5 computed narration calls in `market-analyzer.js` from forced `market` intent to forced `summarize` intent.
**Acceptance criteria:**
- [x] `findBestFlips()` calls `ask(..., liveData, 'summarize')` after computing `rankedOpportunities`
- [x] `analyzeTrend()` calls `ask(..., liveData, 'summarize')` after computing `trendSummary`
- [x] The narration prompts still forbid arithmetic changes and still pass the computed JSON through `liveData`
- [x] Topic-detection calls (`ask()` without forced intent) remain unaffected

**Verification:**
- [x] `test/market-analyzer.test.js` expects `askArgs[2] === 'summarize'` for both computed narration call paths
- [x] `npm test` passes
**Dependencies:** Task 14 (provides deterministic computed JSON for local-model narration)
**Files likely touched:** `src/modules/market-analyzer.js`, `test/market-analyzer.test.js`
**Estimated scope:** S

#### Task 17: Add focused routing and fallback coverage in `ai-agent`
**Description:** Add direct coverage for the intent-to-engine behavior so this path does not silently die again. The tests should prove that `forceIntent: 'summarize'` produces an Ollama attempt, that ordinary domain intents continue to use their existing Gemini routing, and that the Gemini Flash fallback still works when Ollama is unreachable.
**Acceptance criteria:**
- [x] A forced `summarize` request reaches the Ollama branch
- [x] Topic-detection calls (`ask()` without forced intent) are unaffected
- [x] The response metadata still reports the final serving engine and intent
- [x] A failed Ollama call returns a valid Gemini Flash response
- [x] The returned `engine` is `gemini-flash (ollama fallback)`
- [x] The returned `intent` remains `summarize`

**Verification:**
- [x] Unit/integration test stubs Ollama success and confirms `engine: 'ollama'`
- [x] Unit/integration test confirms an unforced market-style query does not route to Ollama
- [x] Unit/integration test stubs `askOllama()` to return `null` and confirms Gemini Flash fallback metadata
- [ ] Optional manual check: stop Ollama, issue a forced `summarize` request, confirm fallback response
**Dependencies:** Task 16
**Files likely touched:** `test/ai-agent.test.js`
**Estimated scope:** S

### Checkpoint: Phase 6
- [x] `npm test` green across the full suite
- [x] Confirm via tests or logs that both the Ollama path and its fallback are exercised
- [x] Confirm Phase 7 dependency notes still point at the `summarize` narration path established here
- [ ] Review with human before proceeding

---

### Phase 7: Multi-Provider Free-Tier Fallback Chain

#### Task 18: Write `askOpenRouter()` and `askCloudflare()` provider functions
**Description:** Add two new provider call functions in `ai-agent.js` against OpenRouter's and Cloudflare Workers AI's OpenAI-compatible endpoints, matching the existing `askOllama()`/`askGemini()` call shape (accept a prompt, return text or `null` on failure) so they slot into the same fallback pattern without restructuring callers.
**Acceptance criteria:**
- [ ] Both functions accept the same prompt structure used elsewhere in `ai-agent.js`
- [ ] Both return `null` on expected failure (rate limit, provider unavailable) rather than throwing, matching `askOllama()`'s existing contract
- [ ] API keys/tokens are read from environment variables (`OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), not hardcoded

**Verification:**
- [ ] Manual check: call each function directly with a test prompt and confirm a valid response from each service
**Dependencies:** Task 16 (reuses the `forceIntent: 'summarize'` narration path established there)
**Files likely touched:** `src/ai-agent.js`, `.env.example` (new vars documented)
**Estimated scope:** M

#### Task 19: Build the ordered fallback chain with status-code-aware error handling
**Description:** Replace the single `askOllama`-then-`askGemini` fallback with an ordered chain (OpenRouter → Cloudflare → Ollama → Gemini Flash) that distinguishes retryable errors (429 rate limit, 5xx unavailable) from non-retryable ones (400 malformed request), so a bad prompt doesn't get silently retried across every provider before failing.
**Acceptance criteria:**
- [ ] A 429 from the first provider in the chain triggers fallback to the next within the same request
- [ ] A 400-class error stops the chain immediately and surfaces the error instead of retrying
- [ ] The `engine` field in the response reflects whichever provider actually served the request

**Verification:**
- [ ] Unit test simulating a 429 from OpenRouter confirms the request falls through to Cloudflare
- [ ] Unit test simulating a 400 confirms no fallback occurs and the error is surfaced
**Dependencies:** Task 18
**Files likely touched:** `src/ai-agent.js`
**Estimated scope:** M

#### Task 20: Track OpenRouter's daily quota locally to pre-empt 429s
**Description:** OpenRouter's free tier counts failed attempts toward the 50/day cap, so retrying against it after it's already near the limit wastes quota that can't be recovered. Add a local in-memory counter (same pattern as `market-cache.js`) that increments on every OpenRouter call and skips straight to Cloudflare once a configurable threshold (e.g. 45) is reached, without making the API call at all.
**Acceptance criteria:**
- [ ] Counter resets on a daily boundary
- [ ] Once the threshold is hit, OpenRouter is skipped with no network call made, and this is logged

**Verification:**
- [ ] Unit test: simulate 45 prior calls, confirm the 46th routes directly to Cloudflare
**Dependencies:** Task 19
**Files likely touched:** `src/ai-agent.js` (or a new `src/quota-tracker.js` if the counter logic grows)
**Estimated scope:** S

#### Task 21: Add test coverage for the fallback chain
**Description:** Cover the chain's behavior with mocked fetch responses: first provider succeeds, first provider fails and falls back, all providers exhausted.
**Acceptance criteria:**
- [ ] Tests cover all three scenarios above
- [ ] Tests confirm the quota tracker from Task 20 is respected

**Verification:**
- [ ] `npm test` passes
**Dependencies:** Task 20
**Files likely touched:** `test/ai-agent.test.js` (new)
**Estimated scope:** S

### Checkpoint: Phase 7
- [ ] Confirm via logs that all four paths (OpenRouter, Cloudflare, Ollama, Gemini Flash) are individually reachable
- [ ] Quota tracker verified not to over- or under-count across a simulated burst of requests
- [ ] `npm test` green
- [ ] Review with human before proceeding

---

### Phase 8: Targeted CoT Scaffolding

#### Task 22: Add per-intent reasoning instructions for genuinely freeform calls
**Description:** Add explicit step-by-step instructions (frontline → backline → gear swap, etc.) to `SYSTEM_PROMPT` only for `build`/`pvp`/`guild`-intent `ask()` calls. Skip `getZvZComposition` in `guild-strategist.js` — it's pure deterministic table lookup with no LLM involved, so CoT prompting has nothing to act on there.
**Acceptance criteria:**
- [ ] CoT instructions are conditional on intent, not global (don't bloat every prompt)

**Verification:**
- [ ] Manual check: compare a sample PvP counter-build answer before/after for reasoning structure
**Dependencies:** Task 9
**Files likely touched:** `src/ai-agent.js`
**Estimated scope:** S

#### Task 23: Apply the same scaffolding to `build-advisor.js`
**Description:** `getBuild` and `counterBuild` are the other freeform tactical call sites; give them the same explicit ordering instructions.
**Acceptance criteria:**
- [ ] `counterBuild` output visibly separates "countering mechanic" reasoning from the final gear list

**Verification:**
- [ ] Manual check: sample 3 counter-build queries for reasoning quality
**Dependencies:** Task 22
**Files likely touched:** `src/modules/build-advisor.js`
**Estimated scope:** S

### Checkpoint: Phase 8 (Final)
- [ ] All acceptance criteria across phases met
- [ ] Full `npm test` suite green
- [ ] Ready for review

---

### Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `@google/genai` migration introduces breaking call-shape changes mid-feature work | Medium | Do Phase 1 first and in isolation, before any caching/schema work depends on it |
| Embedding generation cost/latency at request time (Phase 2) | Low | Brain corpus is tiny; embedding the query alone (not the corpus) per request is cheap. Pre-embed the corpus offline (Task 5) |
| Stale cached system prompt (Phase 4) after editing `SYSTEM_PROMPT` or brain content | Medium | Tie cache TTL to a short window and recreate on server restart; don't cache user-specific data |
| `responseSchema` output (Phase 3) breaks existing frontend parsing during the transition | Medium | Land Task 9 and Task 10 in the same PR/session — don't ship a backend schema change without the matching frontend update |
| Local Ollama model (Phase 6) produces lower-quality narration than Gemini Flash | Low | Fallback to Gemini Flash already exists in code; monitor output quality before expanding which call sites force `'summarize'` |
| In-memory OpenRouter quota counter (Phase 7) resets or drifts if Aria runs as multiple processes/instances | Medium | Fine for a single-process deployment; if Aria scales horizontally, move the counter into the existing cache layer or a shared store so instances share one count |
| Cloudflare Neuron cost varies significantly by model (cheap models like `llama-3.2-1b` vs. expensive ones like `llama-2-7b-chat-fp16`) | Low | Pin the provider function to a specific small, cheap model rather than letting it vary, so the 10,000 Neuron/day budget is predictable |
| Stacking 4 fallback providers (Phase 7) makes failures harder to debug ("which one actually answered?") | Low | Task 19's `engine` field in the response and structured logging at each chain step keep this traceable |

## Open Questions

- Which Gemini embedding model to standardize on for Task 5/Task 7 (affects both cost and whether re-embedding is needed if the model changes)
- Whether brain file edits should auto-trigger re-embedding (`npm run embed-brain` as a pre-commit hook) or stay a manual step
- Whether the `'summarize'` forced-intent path in Phase 6/7 should also cover the crafting-profit recommendation text, not just market-analyzer
- Whether the OpenRouter quota counter (Task 20) needs to persist across server restarts, or whether an in-memory reset on deploy is acceptable

---

### Phase 9: OpenAlbion Data Enrichment

**Context:** `8_weapons_armor.md` currently describes item stats only as relative percentages and rough approximations — no real Item Power values, no actual DPS figures, no armor resistance numbers. OpenAlbion exposes seven structured endpoints covering weapons, armors, accessories, consumables, their stats per quality/enchantment level, consumable crafting recipes, and spells per item. All responses use the same `identifier` field format (`T4_MAIN_SWORD`, `T4_ARMOR_CLOTH_SET1`) that `item-resolver.js` and `CRAFTING_RECIPES` in `crafting-profit.js` already use — so fetched data slots in without a translation layer.

**Endpoint map confirmed from live docs:**
- `GET https://api.openalbion.com/api/v3/weapons` → list with `id`, `name`, `tier`, `item_power`
- `GET https://api.openalbion.com/api/v3/weapon-stats/weapon/{weapon_id}` → per-weapon stats (Item Power, Physical damage, Resilience penetration, Max Hit Points, HP Regen, DPS) × 5 quality levels × N enchantment levels
- `GET https://api.openalbion.com/api/v3/armors` → list with `id`, `name`, `tier`, `item_power`, `identifier`
- `GET https://api.openalbion.com/api/v3/armor-stats/armor/{armor_id}` → per-armor stats (Item Power, Armor, Magical Resistance, Max Hit Points) × 5 quality levels
- `GET https://api.openalbion.com/api/v3/accessories` → list with `id`, `name`, `tier`, `identifier`
- `GET https://api.openalbion.com/api/v3/accessory-stats/accessory/{accessory_id}` → per-accessory stats (Item Power, Max Energy, Energy Regeneration)
- `GET https://api.openalbion.com/api/v3/consumables` → list with `id`, `name`, `tier`, `identifier`, `info`
- `GET https://api.openalbion.com/api/v3/consumable-stats/consumable/{consumable_id}` → per-consumable stats (Item Power, Nutrition, Weight, Crafting Speed, Crafting Quality)
- `GET https://api.openalbion.com/api/v3/consumable-craftings/consumable/{consumable_id}` → full recipe with `requirements[]` each having `name`, `value`, `identifier`
- `GET https://api.openalbion.com/api/v3/spells/weapon/{weapon_id}` → spells by slot (First/Fifth/Passive) with Energy Cost, Cast Time, Range, Cooldown, description
- `GET /api/v3/spells/armor/{id}` → spells by armor slot
- `GET https://api.openalbion.com/api/v3/categories` → weapon/armor/accessory/consumable category tree with subcategory IDs

**Gap acknowledged:** No weapon or armor crafting recipe endpoint exists on OpenAlbion. Consumable recipes are fully covered. Weapon/armor recipe expansion (`CRAFTING_RECIPES` currently has only 6 hardcoded entries) requires the `ao-bin-dumps` repo already pulled by `scripts/fetch-items.js` — that source is tracked as a follow-on, not this phase.

---

#### Task 24: Write `scripts/fetch-openalbion.js` — list fetch with throttling
**Description:** A build-time script (mirroring `scripts/fetch-items.js`) that fetches five list endpoints — `/weapons`, `/armors`, `/accessories`, `/consumables`, and the spell catalog via `/spells/weapon/{id}` and `/spells/armor/{id}` (using IDs from the weapon/armor lists) — in sequence, writes their raw lists to `data/openalbion-lists.json`, and enforces a configurable inter-request delay (default 300ms) between every HTTP call to avoid hammering a community-run API. Spells are per-item (no standalone `/spells` list endpoint exists), so this task collects the weapon and armor ID lists first, then queues the spell list fetches using those IDs — the actual throttled stat+spell fetching is expanded in Task 25 and Task 26, but the ID collection and script skeleton for all five data types is established here. No auth required per the docs; no API key to manage. The script exits with a non-zero code and a clear message if any list fetch fails, same pattern as `fetch-items.js`.
**Acceptance criteria:**
- [ ] `npm run fetch-openalbion` produces `data/openalbion-lists.json` with five arrays: `weapons[]`, `armors[]`, `accessories[]`, `consumables[]`, and a `spell_sources[]` array of `{weapon_id, armor_id}` pairs queued for the Task 26 spell fetch
- [ ] Each item in each array carries its `id` (needed for the stats and spell fetches in Tasks 25–26) and its `identifier` (needed for mapping to `item-resolver.js` format)
- [ ] Script logs progress per request so it's visible when running (e.g. `Fetching weapons... 342 items`, `Queued 342 weapon IDs for spell fetch`)
- [ ] A 300ms minimum delay is enforced between every fetch call (not just between list calls, but carried into Tasks 25 and 26)

**Verification:**
- [ ] Run script, confirm output file exists and is valid JSON with all five keys present
- [ ] Check that `identifier` fields match the format used in `CRAFTING_RECIPES` (e.g. `T4_MAIN_SWORD` pattern)
- [ ] Confirm `spell_sources[]` contains at least one weapon ID and one armor ID ready for Task 26
**Dependencies:** None
**Files likely touched:** `scripts/fetch-openalbion.js` (new), `package.json` (new `fetch-openalbion` script entry)
**Estimated scope:** M

---

#### Task 25: Extend the script — stats and recipe fetch with concurrency cap
**Description:** Extend `fetch-openalbion.js` to iterate every item ID from each list and fetch its stats endpoint, plus fetch consumable-crafting recipes for all consumable IDs. Because stats endpoints are per-item (N+1 pattern), this produces hundreds of HTTP calls. Cap concurrency at 3 parallel requests at any moment using a simple semaphore — no external concurrency library needed, just a counter and a queue — while still enforcing the 300ms inter-request delay per slot. Write output to three separate files: `data/openalbion-weapon-stats.json`, `data/openalbion-armor-stats.json`, `data/openalbion-consumable-recipes.json`. Skip failed individual item fetches with a warning rather than aborting the entire run, so a single bad ID doesn't kill the dataset.

The exact data to retain per item (strip the icon URLs, keep only stat fields relevant to Aria's use cases):
- Weapons: `name`, `tier`, `identifier` (from list fetch — not returned by stats endpoint), `enchantment`, `quality`, then from `stats[]`: Item Power, Physical damage, Resilience penetration, Max Hit Points, HP Regen, DPS
- Armors: `name`, `tier`, `identifier`, `enchantment`, `quality`, then: Item Power, Armor, Magical Resistance, Max Hit Points
- Consumable recipes: `name`, `tier`, `identifier`, `enchantment`, `per_craft`, `requirements[]` (name, value, identifier)

**Acceptance criteria:**
- [ ] Three output files written, each valid JSON
- [ ] No more than 3 simultaneous in-flight requests at any point (verifiable by adding a log line per request start/end)
- [ ] Individual 404/5xx responses for a single item ID are logged as warnings, not thrown — script completes even if some items fail
- [ ] Icon URLs are excluded from all output files (they'd bloat the JSON without benefit to Aria)
- [ ] Script total runtime logged on completion (gives a baseline for future runs)

**Verification:**
- [ ] Run full script end to end, check all three output files exist and contain expected fields
- [ ] Manually spot-check one weapon entry (e.g. Adept's Battleaxe, id=2) against the live API response
- [ ] Confirm no icon URLs appear in any output file
**Dependencies:** Task 24
**Files likely touched:** `scripts/fetch-openalbion.js`
**Estimated scope:** L (the concurrency + throttle logic needs care; most of the work is here)

---

#### Task 26: Fetch spells per weapon and armor
**Description:** Extend the script further to call `/api/v3/spells/weapon/{id}` and `/api/v3/spells/armor/{id}` for each item, writing output to `data/openalbion-spells.json`. Spell data includes slot name, spell name, Energy Cost, Cast Time, Range, Cooldown, and description text — this is what `8_weapons_armor.md` is most missing and what `build-advisor.js`'s `getBuild`/`counterBuild` calls need to give specific rotation advice. Apply the same throttling and concurrency cap from Task 25. Retain only the fields the AI can reason from (slot, name, attributes, description) — strip the `preview` GIF URLs and `icon` URLs.

**Acceptance criteria:**
- [ ] `data/openalbion-spells.json` written with weapon spells and armor spells as separate top-level keys
- [ ] Each spell entry includes: `weapon_id` (or `armor_id`), `slot`, `name`, and `attributes[]` (Energy Cost, Cast Time, Range, Cooldown), and the plain-text `description`
- [ ] Preview/icon URLs excluded

**Verification:**
- [ ] Spot-check spells for one weapon (e.g. Battleaxe: "Rending Strike" in First Slot, Energy Cost 6, Range 3m, Cooldown 2s) against what the live API returns
**Dependencies:** Task 25
**Files likely touched:** `scripts/fetch-openalbion.js`
**Estimated scope:** M

---

#### Task 27: Add all four output files to `.gitignore` and document the scripts
**Description:** The four output files (`openalbion-lists.json`, `openalbion-weapon-stats.json`, `openalbion-armor-stats.json`, `openalbion-consumable-recipes.json`, `openalbion-spells.json`) are regenerable on demand and should never be checked in — same pattern as `data/albion-items.json`. Update `.gitignore` and document the new script in `README.md`'s Setup section alongside the existing `node scripts/fetch-items.js` step.
**Acceptance criteria:**
- [ ] All five new data files gitignored
- [ ] `README.md` Setup section updated with `npm run fetch-openalbion` as a second data-fetch step after `npm run fetch-items`
- [ ] `README.md` notes clearly that both data fetches must be re-run after Albion Online patches

**Verification:**
- [ ] `git status` after running the script shows no untracked data files
**Dependencies:** Task 26
**Files likely touched:** `.gitignore`, `README.md`
**Estimated scope:** XS

---

#### Task 28: Map consumable recipe data into `crafting-profit.js`
**Description:** Replace (or extend) the hardcoded `CRAFTING_RECIPES` object in `crafting-profit.js` with a loader that reads `data/openalbion-consumable-recipes.json` at startup and builds the same `{ingredients: [{id, quantity}], craftingTime, tax}` shape that `calculateCraftingProfit()` already expects. The `identifier` field in each recipe requirement maps directly to the ingredient `id` field — no translation needed. Keep the 6 existing hardcoded gear recipes as a fallback for items not covered by OpenAlbion (since weapon/armor crafting recipes aren't in that API), so the function continues to work for T4-T6 sword/helmet calculations without change.
**Acceptance criteria:**
- [ ] `calculateCraftingProfit('T4 octopus salad')` (or equivalent consumable name) returns a valid profit calculation using real ingredient quantities from the fetched data
- [ ] Existing `npm test` suite for `crafting-profit.test.js` passes without modification — the hardcoded gear recipes still work
- [ ] Missing data file (OpenAlbion fetch not yet run) prints a clear error pointing to `npm run fetch-openalbion`, same pattern as `item-resolver.js`

**Verification:**
- [ ] `npm test` green
- [ ] Manual check: calculate profit for one consumable, verify ingredient list matches the live API response for that item
**Dependencies:** Task 26
**Files likely touched:** `src/modules/crafting-profit.js`
**Estimated scope:** M

---

#### Task 29: Write `src/openalbion-loader.js` — in-memory index for stats and spells
**Description:** A startup loader (mirroring `item-resolver.js`'s lazy-load pattern) that reads the four fetched data files once into memory and exposes three lookup functions used by other modules:
- `getWeaponStats(identifier, quality, enchantment)` → returns the stat array for that weapon at the given quality/enchantment combination, or `null` if not found
- `getArmorStats(identifier, quality, enchantment)` → same for armor
- `getSpells(identifier)` → returns the full spell list grouped by slot for a weapon or armor identifier

Index built on `identifier` field (e.g. `T4_2H_AXE`) so lookups are O(1) via a Map, not O(N) array scans. Handles missing data file gracefully with a clear error message pointing at the fetch script.

**Acceptance criteria:**
- [ ] All three lookup functions return correct data for a known identifier (e.g. `T4_2H_AXE` for Battleaxe)
- [ ] Returns `null`, not throws, when an identifier isn't found
- [ ] Data is indexed at module load time, not on every call

**Verification:**
- [ ] Unit test: `getWeaponStats('T4_2H_AXE', 'Normal', 0)` returns `{DPS: '79/s', 'Physical damage': '71', ...}`
- [ ] Unit test: `getSpells('T4_2H_AXE')` returns a non-empty array with at least a First Slot spell
**Dependencies:** Task 26
**Files likely touched:** `src/openalbion-loader.js` (new), `test/openalbion-loader.test.js` (new)
**Estimated scope:** M

---

#### Task 30: Enrich `build-advisor.js` with real stats and spell data
**Description:** Update `getBuild()` and `counterBuild()` in `build-advisor.js` to call `getWeaponStats()`, `getArmorStats()`, and `getSpells()` from the loader, then inject the returned structured data into the `ask()` call as `liveData` (same pattern as `market-api.js` injecting live prices into the chat agent). This gives the LLM actual numbers to reason from — real DPS values, real spell cooldowns and ranges — instead of the approximate descriptions currently in `8_weapons_armor.md`. The prompt itself stays natural language; only the injected data changes.
**Acceptance criteria:**
- [ ] `getBuild('DPS', 'hellgate', '1500000')` prompt includes real stat data for relevant T5/T6 weapons
- [ ] `counterBuild('T6 Battleaxe @2')` prompt includes both the attacker's actual stats and candidate counter-build stats
- [ ] If the loader returns `null` for an identifier (item not in fetched data), the function falls back gracefully to no injected stats — no crash

**Verification:**
- [ ] Manual check: ask Aria for a PvP build and verify the response cites specific DPS or cooldown values, not just "high damage"
**Dependencies:** Task 29, Task 16 (CoT scaffolding from Phase 8 adds further value here)
**Files likely touched:** `src/modules/build-advisor.js`
**Estimated scope:** M

---

#### Task 31: Rewrite `8_weapons_armor.md` with real stat tables
**Description:** Replace the approximate relative-percentage descriptions in `8_weapons_armor.md` with real stat tables pulled from the fetched data for the most commonly referenced tiers (T4, T5, T6 at Normal quality, @0 enchantment — the baseline the AI reasons from most often). Add a spell reference section per weapon class (what First Slot, Fifth Slot, and Passive spells each weapon type has, with real cooldown/range/energy cost values). Keep the strategic narrative sections (playstyle descriptions, build recommendations) — only the numbers change.

Sections to update:
- Weapon Trees: add a real stats row per tier for each weapon type (Item Power, Physical/Magical damage, DPS)
- Armor Breakdown: add real Armor, Magical Resistance, Max Hit Points values per tier per armor class (Plate/Leather/Cloth)
- New section: Spell Reference — one table per weapon class showing slot, spell name, key attributes
- Full Set Examples: update silver price estimates only if they're still approximate (the brain file's own note says these are approximate — real market prices stay in `market-api.js`, not here)

**Acceptance criteria:**
- [ ] T4/T5/T6 weapon stat tables contain real values sourced from `openalbion-weapon-stats.json`
- [ ] T4/T5/T6 armor stat tables contain real values sourced from `openalbion-armor-stats.json`
- [ ] Spell reference tables present for at least the main weapon classes (Axes, Swords, Bows, Holy Staff, Nature Staff, Fire Staff, Frost Staff)
- [ ] Total file size still within 64KB brain-file budget (per `BRAIN.md`)

**Verification:**
- [ ] Manual check: open `8_weapons_armor.md` and confirm at least one real DPS value (e.g. "79/s" for T4 Battleaxe Normal quality) appears
- [ ] `wc -c albion-brain/8_weapons_armor.md` is under 65,536 bytes
**Dependencies:** Task 29
**Files likely touched:** `albion-brain/8_weapons_armor.md`
**Estimated scope:** L (most of this is content work, not code)

---

#### Task 32: Add consumable stats to `6_crafting_refining.md`
**Description:** Add a real consumable stats section to `6_crafting_refining.md` using `openalbion-consumable-stats.json` data: actual Nutrition values, Crafting Speed bonuses, and Crafting Quality bonuses per food tier and enchantment level. This is what the crafting brain file is most obviously missing — the current "Potions (100): 5k → 15k +200%" entry is a rough market estimate, not a stat. The AI needs the stat data to answer questions like "which food gives the best crafting speed bonus for my station level."

**Acceptance criteria:**
- [ ] Consumable stat table added covering T4-T6 foods at @0 and @1 enchantment (the most common range players use)
- [ ] File stays within 64KB budget

**Verification:**
- [ ] `wc -c albion-brain/6_crafting_refining.md` under 65,536 bytes
- [ ] At least one real Nutrition value and one Crafting Speed value confirmed against the fetched consumable stats data
**Dependencies:** Task 29
**Files likely touched:** `albion-brain/6_crafting_refining.md`
**Estimated scope:** M (content work)

---

#### Task 33: Extend `fetch-openalbion.js` to also call Gameinfo API for gear recipes
**Description:** Add a new fetch pass inside `scripts/fetch-openalbion.js` that iterates every weapon and armor `identifier` already collected from OpenAlbion's list endpoints (Task 24) and calls `https://gameinfo.albiononline.com/api/gameinfo/items/{identifier}/data` for each one. Extract and store `craftingRequirements.craftResourceList` (ingredients + quantities), `craftingRequirements.time` (craft duration), `craftingRequirements.silver` (fixed silver fee per craft), and `craftingRequirements.craftingFocus` (focus cost). Write output to `data/gameinfo-gear-recipes.json`. Apply the same 300ms throttle and 3-request concurrency cap already enforced in Task 25 — no separate throttling logic needed, just extend the same semaphore. Skip items where `craftingRequirements` is absent (non-craftable items like drops) with a silent skip, not a warning — absent recipes are expected and common, not errors.

**Why Gameinfo and not ao-bin-dumps XML for this:** The `ao-bin-dumps` repo's full XML dump does contain recipe data, but it requires parsing a large composite XML file and maintaining a mapping layer. The Gameinfo API returns clean per-item JSON with the exact field names needed, using the same identifiers already in the codebase. Gameinfo is the right source for recipes; ao-bin-dumps remains the right source for item names/IDs.

**Known limitation to document in code comments:** The Gameinfo API's stat values for armor are inaccurate for some items (confirmed in Albion Online forum, August 2021 — Magical Resistance off by significant margins for T8 pieces). Recipes from this endpoint are reliable; stats are not. Stats come from OpenAlbion only.

**Acceptance criteria:**
- [ ] `data/gameinfo-gear-recipes.json` written with one entry per craftable weapon/armor, each containing: `identifier`, `ingredients[]` (uniqueName + count), `silverCost`, `craftingFocus`, `craftingTime`
- [ ] Non-craftable items (no `craftingRequirements` field in response) silently skipped — not counted as errors
- [ ] Items where the API returns a non-200 are logged as warnings and skipped — script does not abort
- [ ] File added to `.gitignore`

**Verification:**
- [ ] Spot-check `T4_MAIN_SWORD`: confirm `ingredients` contains refined metal planks (or equivalent T4 refined material) at the correct count, matching in-game recipe
- [ ] Spot-check `T5_HEAD_LEATHER`: confirm ingredients and quantities are correct
- [ ] Confirm `silverCost` field is present and numeric (even if 0 for items with no flat silver fee)
**Dependencies:** Task 24 (weapon/armor identifier lists), Task 25 (reuses the concurrency/throttle pattern)
**Files likely touched:** `scripts/fetch-openalbion.js`, `.gitignore`
**Estimated scope:** M

---

#### Task 34: Extend `crafting-profit.js` to load and use Gameinfo gear recipes
**Description:** Extend the recipe loader added in Task 28 (which already loads consumable recipes from OpenAlbion) to also load `data/gameinfo-gear-recipes.json` at startup and merge it into the same in-memory recipe map. The 6 existing hardcoded entries in `CRAFTING_RECIPES` are superseded by Gameinfo data for any item that appears in both — Gameinfo data takes precedence since it's sourced from the live API, not hand-maintained. Keep the hardcoded entries as a last-resort fallback only for items absent from both fetched datasets.

The cost formula for Gameinfo-sourced recipes adds one new term not present in the hardcoded recipes: `silverCost` (the flat silver fee per craft from `craftingRequirements.silver`). Update `calculateCraftingProfit()` to include this in `totalCost` and surface it in the `breakdown` object as a new `silverFee` field alongside the existing `ingredientCost`, `craftingTax`, and `enchantmentCost` fields.

**Acceptance criteria:**
- [ ] `calculateCraftingProfit('T5 sword')` uses real ingredient list from Gameinfo, not the hardcoded 6-entry fallback
- [ ] `calculateCraftingProfit('T5 sword')` breakdown includes `silverFee` field (may be 0 for items with no flat fee — must be present regardless)
- [ ] Total cost formula: `ingredientCost + silverFee + craftingTax + enchantmentCost`
- [ ] `calculateCraftingProfit('T4 octopus salad')` still works via OpenAlbion consumable recipes (Task 28) — the two loaders don't conflict
- [ ] Missing Gameinfo file (fetch not yet run) prints a clear error pointing to `npm run fetch-openalbion`, same pattern as Task 28

**Verification:**
- [ ] `npm test` (existing `crafting-profit.test.js`) passes unmodified — hardcoded fallback recipes still work if fetched data is absent
- [ ] Manual check: `calculateCraftingProfit('T5 sword')` returns a valid result with a real ingredient list
- [ ] Manual check: `breakdown.silverFee` is present in the returned object
**Dependencies:** Task 33, Task 28
**Files likely touched:** `src/modules/crafting-profit.js`
**Estimated scope:** M

---

#### Task 35: Add ingredient cost breakdown to the crafting profit API response
**Description:** The `/api/crafting-profit` endpoint in `server.js` currently surfaces `breakdown.ingredients` as an array of `{id, name, quantity, unitPrice, total}` objects — but only for the 6 hardcoded recipes. Now that Gameinfo sources real ingredient lists for all weapons and armor, make sure the per-ingredient breakdown is populated for Gameinfo-sourced recipes too. Also add `silverFee` to the response shape so the frontend can display it. Update `app.js`'s `handleCraftingSubmit` renderer to show the silver fee line in the cost breakdown card if it is non-zero.

**Acceptance criteria:**
- [ ] `/api/crafting-profit` response `breakdown.ingredients[]` is populated for T4–T8 weapons and armor (not just the 6 hardcoded items)
- [ ] `breakdown.silverFee` appears in the API response
- [ ] Frontend crafting tab shows "Silver Fee: X" line only when `silverFee > 0` (zero-fee items don't show a blank line)

**Verification:**
- [ ] Manual check in browser: calculate profit for a T5 sword, confirm ingredient list shows real material names and quantities
- [ ] Manual check: a T4 bag (known to have a silver fee per Gameinfo example) shows the silver fee line in the UI
**Dependencies:** Task 34
**Files likely touched:** `src/server.js`, `public/js/app.js`
**Estimated scope:** S

---

#### Task 36: Add test coverage for Gameinfo recipe loading and cost formula
**Description:** Extend `test/crafting-profit.test.js` with test cases that cover the Gameinfo recipe path specifically: correct ingredient list loading, the `silverFee` field in the breakdown, and the updated total cost formula. Use a fixture file (a small hand-written `gameinfo-gear-recipes.json` with 2–3 entries) so tests don't depend on the live API or a locally fetched data file.

**Acceptance criteria:**
- [ ] Test confirms `silverFee` appears in breakdown for a recipe that has a non-zero silver cost
- [ ] Test confirms `totalCost = ingredientCost + silverFee + craftingTax` is correct
- [ ] Fixture file used — tests pass without the actual fetched data file present

**Verification:**
- [ ] `npm test` green
**Dependencies:** Task 34
**Files likely touched:** `test/crafting-profit.test.js`, `test/fixtures/gameinfo-gear-recipes.fixture.json` (new)
**Estimated scope:** S

### Checkpoint: Phase 9
- [ ] `npm run fetch-openalbion` runs clean end to end — all six data files produced (five OpenAlbion + one Gameinfo)
- [ ] `npm test` green (Tasks 28, 29, and 36 all have test coverage)
- [ ] Manual spot-check: Aria answers "what's the DPS on a T5 battleaxe?" with a real number, not an approximation
- [ ] Manual spot-check: Aria answers "what ingredients do I need to craft a T4 octopus salad?" with the correct real recipe
- [ ] Manual spot-check: `calculateCraftingProfit('T5 sword')` returns real ingredient list, real quantities, and a `silverFee` field
- [ ] Manual spot-check: `getBuild('tank', 'dungeon', '2000000')` response cites specific spell names and cooldowns
- [ ] Frontend crafting tab shows per-ingredient breakdown for weapons and armor, not just the 6 hardcoded items
- [ ] `8_weapons_armor.md` and `6_crafting_refining.md` both under 64KB
- [ ] All output data files confirmed gitignored
- [ ] Review with human before proceeding
