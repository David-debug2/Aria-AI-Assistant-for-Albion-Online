# How to Document Any Update to Aria

**Who this is for:** The project owner and any future developer.
**When to use this:** Every single time something ships — a feature, a fix, a brain file edit, a dependency swap, anything. Open this file, identify what type of change you made, follow the steps for that type.

**The core rule:** Code and docs ship together. A change that isn't documented didn't happen — a future developer (or future you) will have no idea why it exists.

---

## Part 1 — Identify What You Just Changed

Before writing anything, figure out which category your change falls into. Most changes fit one primary category. Some fit two — do both.

| If you... | Category |
|---|---|
| Added a new feature users can see or use | **Feature** |
| Fixed something that was broken or wrong | **Fix** |
| Changed how existing code works (same result, better implementation) | **Refactor** |
| Swapped, added, or removed a dependency/package | **Dependency** |
| Made a significant choice between two or more real approaches | **Decision** |
| Updated game facts, prices, strategies in `albion-brain/` | **Brain File** |
| Added a new API endpoint or changed an existing one's shape | **API** |
| Closed out a full version (Alpha done, Beta done, etc.) | **Version Close** |
| Added something that doesn't fit any category above | **Other** |

> **Not sure?** If the change took more than 30 minutes or touched more than 2 files, treat it as a **Feature** or **Decision** and document it fully. When in doubt, over-document.

---

## Part 2 — The Steps for Each Category

---

### FEATURE
*You added something new that users or developers can now do.*

Examples from Aria's upgrade plan:
- Phase 0: Brain loader now returns chunks instead of whole files
- Phase 3: `/api/ask` now returns structured JSON instead of markdown
- Phase 7: Multi-provider fallback chain (OpenRouter → Cloudflare → Ollama → Gemini)
- Phase 9: Real weapon stats from OpenAlbion in build responses

**Step 1 — Add a line to `docs/CHANGELOG.md`**

Find the current open version section. Add one line under `### Added`:

```
### Added
- [Plain English description of what now exists and what it enables]
```

Write it so a player who doesn't code can understand it. Not "Modified loadBrainContext() to return top-K chunks" — instead: "Brain loader now sends only relevant sections to the AI instead of entire files (60–70% smaller prompts)."

If this feature was part of a named phase in the upgrade plan, note it:
```
### Added
- Brain loader now sends only relevant knowledge sections to the AI instead of entire files — Phase 0
```

**Step 2 — Decide if this feature needs an ADR**

Ask yourself: *Did I choose between two or more real technical approaches to build this?*

- Yes → Write an ADR (see the **Decision** category below), then come back here and link it in the CHANGELOG entry:
  ```
  - Brain loader now sends only relevant sections to the AI (see ADR-001)
  ```
- No → Skip the ADR. Not every feature needs one.

**Step 3 — Check if any existing docs are now out of date**

| Doc file | Update needed if... |
|---|---|
| `docs/PROJECT_OVERVIEW.md` | The feature changes how Aria works at a high level (request flow, new module, new data source) |
| `docs/CONTRIBUTING.md` | The setup process changed (new script to run, new env variable required) |
| `docs/README.md` (the docs index) | A new doc file was created that needs to be listed |
| `albion-brain/*.md` | The feature uses or affects game knowledge |
| `docs/aria-architecture-upgrade-plan.md` | A task checkbox can now be marked complete |

**Step 4 — Mark the task complete in the upgrade plan**

Open `docs/aria-architecture-upgrade-plan.md`. Find the task for what you just built. Check every acceptance criteria checkbox that now passes:

```markdown
- [x] `loadBrainContext()` returns the same shape so callers don't change
- [x] A representative query pulls only relevant sections, not entire files
```

**Step 5 — Run the completion check**

```
[ ] npm test passes
[ ] CHANGELOG.md has a new entry
[ ] Upgrade plan checkboxes are updated
[ ] Any affected doc files are updated
[ ] ADR written and linked (if a significant decision was made)
```

---

### FIX
*You corrected something that was broken, wrong, or behaving unexpectedly.*

Examples from Aria's upgrade plan:
- Phase 6: Ollama routing intent names never matched — fixed so the local model path actually fires
- Any future bug where a calculation was wrong, an API call failed silently, etc.

**Step 1 — Add a line to `docs/CHANGELOG.md`** under `### Fixed`:

```
### Fixed
- [What was wrong] — [what it affected] — [how it now behaves]
```

Example:
```
### Fixed
- Ollama routing never fired in Alpha because intent names didn't match — local model path now correctly triggered for summarization tasks
```

**Step 2 — Check if the fix reveals a gap in existing docs**

If the bug existed because something was undocumented or misleadingly documented, fix the doc too. Common places:
- A brain file had wrong numbers → update the brain file
- The CONTRIBUTING.md described the wrong setup step → fix it
- A code comment explained behavior incorrectly → update the comment

**Step 3 — Run the completion check**

```
[ ] npm test passes (and a new test covers the fixed case if none existed)
[ ] CHANGELOG.md has a new entry under Fixed
[ ] Any misleading docs are corrected
```

---

### REFACTOR
*You changed how code is written internally without changing what it does for users.*

Examples from Aria's upgrade plan:
- Phase 5: Math moved out of the AI prompt into JavaScript (`market-analyzer.js`)
- Phase 5: Shared `calc-helpers.js` extracted so two modules don't duplicate margin logic

**Step 1 — Add a line to `docs/CHANGELOG.md`** under `### Changed`:

```
### Changed
- [What module/file changed] — [what it does differently now] — [why it's better]
```

Example:
```
### Changed
- market-analyzer.js now computes profit margins in JavaScript before calling the AI — results are deterministic and responses are faster
```

**Step 2 — Check if PROJECT_OVERVIEW.md needs updating**

If the refactor moved responsibility from one module to another, or created a new shared module, update the module descriptions in `docs/PROJECT_OVERVIEW.md`.

**Step 3 — Run the completion check**

```
[ ] npm test passes (existing tests unchanged — that proves behavior didn't change)
[ ] CHANGELOG.md has a new entry under Changed
[ ] PROJECT_OVERVIEW.md updated if modules were added or restructured
```

---

### DEPENDENCY
*You added, removed, upgraded, or swapped a package in `package.json`.*

Examples from Aria's upgrade plan:
- Phase 1: Remove `@google/generative-ai`, add `@google/genai`
- Phase 7: Add OpenRouter and Cloudflare provider support

**Step 1 — Add a line to `docs/CHANGELOG.md`** under the most relevant category:
- New package that enables a feature → `### Added`
- Replacing a broken/deprecated package → `### Changed`
- Removing something no longer needed → `### Removed`

```
### Changed
- Replaced deprecated @google/generative-ai SDK with @google/genai (old SDK reached end-of-life August 2025)
```

**Step 2 — Update `docs/versions/ALPHA.md` (or current version snapshot) dependencies table**

The version snapshot has a dependencies table. If you're still in Beta (not yet closed), this isn't frozen yet — update it. If the version is closed, this goes in the new version's snapshot instead.

**Step 3 — Update CONTRIBUTING.md if setup changed**

If developers now need a new environment variable, a new script to run, or a different install step:

```markdown
# In CONTRIBUTING.md → Section 4: Setting up the project
# Add the new variable to the .env setup instructions
```

**Step 4 — Write an ADR if you chose this package over real alternatives**

Swapping `@google/generative-ai` for `@google/genai` is a forced migration — no ADR needed. But choosing OpenRouter over Cloudflare as the primary free-tier provider *is* a real choice — write an ADR.

**Step 5 — Run the completion check**

```
[ ] npm install runs cleanly
[ ] npm test passes
[ ] CHANGELOG.md updated
[ ] CONTRIBUTING.md updated if setup changed
[ ] ADR written if the package choice was a real decision between alternatives
```

---

### DECISION
*You chose between two or more real technical approaches. This is the most important category to document.*

Examples from Aria's upgrade plan:
- Phase 0: Lexical chunking vs. jumping straight to embeddings vs. trimming file sizes
- Phase 2: Brute-force cosine similarity vs. vector database (ChromaDB, Pinecone)
- Phase 7: Which provider order in the fallback chain and why

**Step 1 — Write an ADR**

1. Copy `docs/decisions/ADR-000-template.md`
2. Rename it: `ADR-00X-short-descriptive-title.md` (use the next number in sequence)
3. Fill in every section — especially **Alternatives Considered** and **Trade-offs**

The most important sections:
- **What This Decision Is About** — 2–3 sentences, plain English, no jargon
- **Alternatives Considered** — be honest about what you rejected and exactly why it didn't fit Aria right now
- **Trade-offs and Risks** — what you gave up by choosing this approach

> **Rule:** If you can't fill in at least two real alternatives that you genuinely considered, the decision probably doesn't need an ADR. An ADR is for choices, not implementation details.

**Step 2 — Add a line to `docs/CHANGELOG.md`** under `### Decided`:

```
### Decided
- [Short description of the decision] (see ADR-00X)
```

Example:
```
### Decided
- Brain files are chunked by header sections rather than loaded whole or stored in a vector database (see ADR-001)
```

**Step 3 — Update `docs/README.md`** (the docs index) to list the new ADR:

```markdown
## Architecture decisions (docs/decisions/)
- `ADR-001-lexical-chunking.md` — why brain files are chunked instead of sent whole
- `ADR-002-sdk-migration.md` — why @google/generative-ai was replaced   ← add new lines
```

**Step 4 — Run the completion check**

```
[ ] ADR file created with all sections filled
[ ] ADR is numbered sequentially (no gaps, no reuse)
[ ] CHANGELOG.md has a Decided entry linking to the ADR
[ ] docs/README.md lists the new ADR
```

---

### BRAIN FILE
*You edited one or more files in `albion-brain/` — game knowledge, prices, strategies, mechanics.*

Examples:
- Phase 9: `8_weapons_armor.md` updated with real stat tables from OpenAlbion
- Phase 9: `6_crafting_refining.md` updated with real consumable Nutrition and Crafting Speed values
- Any future patch update: zone changes, new tier, price rebalance

**Step 1 — Add a line to `docs/CHANGELOG.md`**

```
### Changed
- [File name]: [what was updated and why — patch number or data source if applicable]
```

Example:
```
### Changed
- 8_weapons_armor.md: Replaced approximate stat descriptions with real Item Power, DPS, and spell data from OpenAlbion API (Phase 9)
- 6_crafting_refining.md: Added real Nutrition and Crafting Speed values for T4–T6 consumables at @0 and @1 enchantment
```

**Step 2 — Note the source of the new information**

Always record where the updated numbers came from. This tells future editors whether to trust the data and where to re-verify it after a patch. Add a note at the top of the brain file section you updated:

```markdown
## Weapon Stats (Updated: 2026-06-23 — source: OpenAlbion API v3)
```

**Step 3 — Verify the 64KB budget is not exceeded**

All 9 brain files combined must stay under 64,000 characters total. Check after any significant addition:

```bash
wc -c albion-brain/*.md
```

If you're approaching the limit, check `BRAIN.md` for guidance on what to trim.

**Step 4 — Run the completion check**

```
[ ] CHANGELOG.md updated with what changed and the source
[ ] Brain file has a date/source note on the updated section
[ ] Total brain file size confirmed under 64KB (wc -c albion-brain/*.md)
[ ] npm test passes (brain files don't have tests, but confirm nothing broke)
```

---

### API
*You added a new API endpoint, changed an existing endpoint's request/response shape, or removed one.*

Examples from Aria's upgrade plan:
- Phase 3: `/api/ask` response shape changes from a markdown string to structured JSON fields
- Phase 9: `/api/crafting-profit` response adds `silverFee` field and full ingredient breakdowns

**Step 1 — Add a line to `docs/CHANGELOG.md`**

```
### Added / Changed / Removed
- [Endpoint]: [what changed about its request or response]
```

Example:
```
### Changed
- /api/ask: Response now returns structured JSON fields (response, intent, engine, knowledgeFiles) instead of a single markdown string — Phase 3
- /api/crafting-profit: Response breakdown now includes silverFee field and per-ingredient cost list — Phase 9
```

**Step 2 — Update the API reference in `README.md`**

The root `README.md` has an API Reference section with request/response examples for each endpoint. Update the example JSON to match the new shape.

```markdown
**Response:**
```json
{
  "response": "For T5 PvP...",    ← update this if fields changed
  "intent": "build",
  "engine": "gemini-flash",
  "knowledgeFiles": ["8_weapons_armor.md"]
}
```
```

**Step 3 — Run the completion check**

```
[ ] CHANGELOG.md updated
[ ] README.md API Reference section updated with correct request/response examples
[ ] npm test passes
[ ] Manual check: curl the endpoint and confirm the new shape is correct
```

---

### VERSION CLOSE
*You've finished a major version (Alpha is done, Beta is done, etc.) and are ready to open the next one.*

This is the highest-effort doc task. Do it carefully — once a version snapshot is frozen, it's permanent.

**Step 1 — Complete all pending doc tasks for the closing version**

Before closing, every change in this version should already be documented. Run through the CHANGELOG for this version and confirm:
- Every feature has a CHANGELOG entry
- Every significant decision has an ADR
- Every API change is reflected in README.md

**Step 2 — Set a close date in `docs/CHANGELOG.md`**

Find the version section header and add the date:

```markdown
## [Beta] — 2026-09-15
**Theme:** "Make it right"
```

**Step 3 — Create a version snapshot in `docs/versions/`**

Create a new file: `docs/versions/BETA.md` (or whatever the version name is).

Use `docs/versions/ALPHA.md` as your template. Fill in every section for this version:

1. **Theme** — one sentence: what was this version trying to accomplish?
2. **What a user could do** — feature table (non-technical, present tense during the version)
3. **How it worked** — plain-English walkthrough of the architecture as it was at close
4. **What it did NOT have** — honest list of known gaps going into the next version
5. **File map** — full directory tree with one-line descriptions (as it was at close)
6. **Key technical decisions** — table of decisions made, each linking to its ADR
7. **Dependencies** — full table of packages at close, with what each one did
8. **How to run it** — the exact setup commands that worked at close (preserved for history)
9. **Test coverage** — what was covered and what wasn't

> **Important:** Write the snapshot as a past-tense record, not a living document. "Beta had X" not "Beta has X." Once published, this file is never edited again.

**Step 4 — Open the next version in `docs/CHANGELOG.md`**

Add a new section at the top of the file:

```markdown
## [1.0] — _(in progress)_
**Theme:** "Make it stable"

### Added
### Changed
### Fixed
### Decided
```

**Step 5 — Update `docs/README.md`** to list the new version snapshot:

```markdown
## Version snapshots (docs/versions/)
- `ALPHA.md` — frozen record of what Alpha was
- `BETA.md` — frozen record of what Beta was    ← add this
```

**Step 6 — Run the completion check**

```
[ ] Closing version has a completion date in CHANGELOG.md
[ ] All changes in the closing version are documented in CHANGELOG
[ ] All significant decisions in the closing version have ADRs
[ ] Version snapshot created in docs/versions/ and frozen
[ ] New version section opened at the top of CHANGELOG.md
[ ] docs/README.md updated to list the new snapshot
[ ] npm test passes
```

---

### OTHER
*The change doesn't fit any category above.*

This happens. Use this process:

1. Describe the change in one sentence. If you can't, break it into smaller changes and categorize each one separately.
2. Ask: does this change affect what users can do? → CHANGELOG under `### Changed`
3. Ask: did this involve a significant technical choice? → ADR
4. Ask: does this change how developers set up or work on the project? → CONTRIBUTING.md
5. When in doubt, add a CHANGELOG entry. One line is always better than nothing.

---

## Part 3 — The Universal Completion Checklist

Run this after **every** change, regardless of category. It takes 2 minutes.

```
BEFORE YOU COMMIT
─────────────────
[ ] npm test passes

CHANGELOG
─────────
[ ] docs/CHANGELOG.md has at least one new entry for this change
[ ] The entry is in the correct category (Added / Changed / Fixed / Removed / Decided)
[ ] The entry is plain English — a non-coder can understand it

DECISIONS
─────────
[ ] If I chose between real alternatives → ADR written and linked from CHANGELOG
[ ] ADR is numbered sequentially in docs/decisions/
[ ] docs/README.md lists the new ADR (if one was written)

UPGRADE PLAN
────────────
[ ] If this change completes a task in the upgrade plan → checkboxes marked in
    docs/aria-architecture-upgrade-plan.md

AFFECTED DOCS
─────────────
[ ] docs/PROJECT_OVERVIEW.md — updated if architecture or module responsibilities changed
[ ] docs/CONTRIBUTING.md — updated if setup steps or dev conventions changed
[ ] Root README.md — updated if API endpoints changed
[ ] albion-brain/*.md — updated if game knowledge is now wrong or outdated
[ ] docs/README.md — updated if a new doc file was created

BRAIN FILES (only if you touched albion-brain/)
───────────────────────────────────────────────
[ ] Date/source note added to updated section
[ ] Total size still under 64KB: run wc -c albion-brain/*.md
```

---

## Part 4 — Quick Reference by Phase

Use this table to know exactly which doc tasks each upgrade plan phase triggers.

| Phase | CHANGELOG | ADR needed? | Other docs to update |
|---|---|---|---|
| **Phase 0** — Brain chunking | ✅ Added | ✅ Yes (ADR-001 already written) | `PROJECT_OVERVIEW.md` (brain-loader behavior changed) |
| **Phase 1** — SDK migration | ✅ Changed | ✅ Yes (choosing new SDK) | `CONTRIBUTING.md` (new package), version snapshot dependencies table |
| **Phase 2** — Embedding retrieval | ✅ Added | ✅ Yes (cosine sim vs. vector DB) | `PROJECT_OVERVIEW.md` (new script + data file), `CONTRIBUTING.md` (new `npm run embed-brain` step) |
| **Phase 3** — Structured JSON output | ✅ Changed | ✅ Yes (schema design choices) | Root `README.md` (API response shape changed for `/api/ask`) |
| **Phase 4** — Context caching | ✅ Added | No (forced by SDK capability) | None |
| **Phase 5** — Math out of LLM | ✅ Changed | No (clear improvement, no real alternatives) | `PROJECT_OVERVIEW.md` (new `calc-helpers.js` module) |
| **Phase 6** — Fix Ollama routing | ✅ Fixed | No (it was a bug, not a choice) | None |
| **Phase 7** — Provider fallback chain | ✅ Added | ✅ Yes (provider order and quota strategy) | `CONTRIBUTING.md` (new env variables: `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`) |
| **Phase 8** — CoT scaffolding | ✅ Changed | No (clear improvement) | None |
| **Phase 9** — OpenAlbion data | ✅ Added (multiple) | ✅ Yes (OpenAlbion + Gameinfo source choice) | `CONTRIBUTING.md` (new `npm run fetch-openalbion` step), `PROJECT_OVERVIEW.md` (new loader module + scripts), brain files `8_weapons_armor.md` and `6_crafting_refining.md`, root `README.md` (new `/api/crafting-profit` response shape) |
| **Beta close** | ✅ Add date | — | Create `docs/versions/BETA.md`, update `docs/README.md` |

---

## Part 5 — Rules for Future Changes Beyond the Upgrade Plan

The upgrade plan ends at Phase 9. Aria will keep evolving after that. These rules keep the docs healthy long-term.

**Rule 1: One CHANGELOG entry per shipped thing, not per commit.**
Group related commits into one entry. "Added OpenRouter provider, quota tracker, and fallback chain" is one feature — one entry, not three.

**Rule 2: ADRs are for choices, not implementations.**
If there was only one reasonable way to do something, skip the ADR. If you genuinely weighed two approaches and chose one, write the ADR.

**Rule 3: Never edit a closed version snapshot.**
Once `ALPHA.md` or `BETA.md` is frozen, it never changes. If you discover something was wrong about that era, note it in the current CHANGELOG — don't rewrite history.

**Rule 4: Update brain files for any Albion Online patch that changes game mechanics.**
The brain files are the AI's knowledge. Outdated knowledge gives players wrong answers. After any significant Albion Online patch, review all 9 brain files and update what changed. Always add a date/source note.

**Rule 5: If you're not sure whether to write an ADR, write it.**
A short unnecessary ADR costs 10 minutes. A missing ADR on an important decision can cost hours of confusion months later.

**Rule 6: The docs index (`docs/README.md`) must always be accurate.**
Every time you add a new file to `docs/`, add it to the index. Every time you move or rename a file, update the index. A doc that isn't listed is a doc that doesn't get found.

**Rule 7: Keep CONTRIBUTING.md honest.**
If a new developer follows CONTRIBUTING.md and can't set up the project, the doc is wrong. Update it immediately after any change to setup steps, environment variables, or required scripts.
