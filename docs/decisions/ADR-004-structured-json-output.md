# ADR-004: Structured JSON Output

## Status

**Accepted**

---

## Date

2026-06-23

---

## What This Decision Is About

Alpha treated AI answers as markdown text. That made the frontend brittle, mixed display concerns with model behavior, and made malformed provider output hard to detect. Aria needed predictable response shapes for chat, builds, and market ranking.

---

## The Decision

Define shared response schemas in `src/schemas.js`, ask providers for JSON, validate model output against the expected schema, and return structured fields from `/api/ask`.

---

## Why This Option Was Chosen

- The frontend can render stable fields instead of parsing prose.
- Server validation catches malformed model output and returns a controlled 503.
- Different intents can map to different response types.
- The same schemas are reused by Gemini generation config and local validation.

---

## Alternatives That Were Considered

### Option: Keep markdown responses
- **What it is:** Continue returning one text answer and render it directly.
- **Pros:** Lowest implementation cost.
- **Why rejected:** It does not support robust UI rendering, typed tests, or reliable API contracts.

### Option: Parse markdown into sections after generation
- **What it is:** Ask the AI for formatted markdown and parse headings/lists server-side.
- **Pros:** Works with providers that do not support native schemas.
- **Why rejected:** Markdown parsing model output is fragile and fails silently when wording changes.

### Option: Separate schema per provider
- **What it is:** Maintain provider-specific response contracts.
- **Pros:** Could use each provider's strongest structured-output feature.
- **Why rejected:** It increases maintenance cost and makes frontend behavior provider-dependent.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| Some providers only loosely follow JSON instructions. | Server-side validation rejects malformed output before clients receive it. |
| Schemas can become too rigid. | Keep schemas focused on stable UI fields, not every possible answer detail. |
| Existing docs/examples can drift. | Root README and docs snapshots must show the structured response shape. |

---

## Files Changed

| File | Change |
|---|---|
| `src/schemas.js` | Added response schemas and validation helpers. |
| `src/ai-agent.js` | Requests JSON and validates provider output. |
| `src/server.js` | Returns structured response fields from `/api/ask`. |
| `public/js/app.js` | Renders structured chat/build/market fields. |
| `test/schemas.test.js` | Covers schema validation. |
| `test/ask-malformed-output.test.js` | Covers malformed model output handling. |

---

## How to Verify It's Working

- Run `npm test`.
- Call `/api/ask` and confirm the response includes `responseType`, intent-specific fields, `engine`, `intent`, and `filesLoaded`.
- Force invalid provider JSON in tests and confirm the server returns a temporary AI error instead of raw malformed output.

---

## Related Decisions

- Depends on: None
- Supersedes: None
- Related: ADR-005

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance. If the decision changes, write a new ADR that supersedes this one.*
