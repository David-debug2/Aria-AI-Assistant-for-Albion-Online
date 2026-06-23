# ADR-000: [Short Title of Decision]

> **How to use this template:**
> Copy this file, rename it `ADR-00X-short-title.md` (use the next available number),
> fill in every section, and delete these instruction blocks.
> Link to it from `CHANGELOG.md` under the relevant version.

---

## Status

> Pick one: `Proposed` | `Accepted` | `Superseded by ADR-XXX` | `Deprecated`

**Accepted**

---

## Date

> When was this decision made or finalized?

YYYY-MM-DD

---

## What This Decision Is About

> Write 2–4 sentences in plain English. Pretend you're explaining it to someone
> who has never seen the code. What problem existed? What choice had to be made?
>
> Example: "Aria was sending entire knowledge files to the AI on every request,
> even when the question only needed one section. We had to decide how to make
> the brain loader smarter without over-engineering it."

_(Write your context here)_

---

## The Decision

> One clear sentence: what did you decide to do?
>
> Example: "We will split brain files into header-delimited sections at startup
> and score each section against the user's query using keyword overlap,
> returning only the top-K most relevant sections."

_(Write the decision here)_

---

## Why This Option Was Chosen

> 2–5 bullet points explaining the reasoning. Focus on *why this was the right
> call for Aria right now*, not just what the benefits are in general.

- _(Reason 1)_
- _(Reason 2)_
- _(Reason 3)_

---

## Alternatives That Were Considered

> For each alternative: what was it, what were its pros, and why was it rejected?
> Be honest — rejected options are valuable history.

### Option: _(Alternative name)_
- **What it is:** _(One sentence description)_
- **Pros:** _(What would have been good about it)_
- **Why rejected:** _(The specific reason it didn't fit Aria's situation)_

### Option: _(Another alternative)_
- **What it is:** _(One sentence description)_
- **Pros:** _(What would have been good about it)_
- **Why rejected:** _(The specific reason it didn't fit Aria's situation)_

---

## Trade-offs and Risks

> What do you give up with this decision? What could go wrong?
> Being honest here helps future developers understand the limits.

| Trade-off / Risk | How it's managed |
|---|---|
| _(e.g. higher startup time)_ | _(e.g. chunks are built once at load, not per request)_ |
| _(e.g. keyword scoring is imprecise)_ | _(e.g. embedding upgrade planned for Phase 2)_ |

---

## Files Changed

> List every file that was added, modified, or deleted because of this decision.

| File | Change |
|---|---|
| `src/brain-loader.js` | Modified — added chunking and scoring logic |
| `src/schemas.js` | Added — new file |

---

## How to Verify It's Working

> Give a concrete check someone can do — without reading the code — to confirm
> this decision was implemented correctly.

- _(e.g. Run `npm test` — all tests should pass)_
- _(e.g. Ask Aria "how do I refine ore?" and check the server logs — context should be under 5KB)_

---

## Related Decisions

> Links to ADRs that this one depends on, supersedes, or is connected to.

- Depends on: _(ADR-XXX if applicable)_
- Supersedes: _(ADR-XXX if applicable, otherwise "None")_
- Related: _(ADR-XXX if applicable)_

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance.
If the decision changes, write a new ADR that supersedes this one.*
