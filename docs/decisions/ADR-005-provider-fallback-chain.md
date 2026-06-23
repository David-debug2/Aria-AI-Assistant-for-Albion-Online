# ADR-005: Multi-Provider Fallback Chain

## Status

**Accepted**

---

## Date

2026-06-23

---

## What This Decision Is About

Aria should not fail just because one AI provider is rate-limited, unavailable, or missing quota. The project needed a default server-side provider order that uses free or local capacity first while keeping Gemini as a final floor when configured.

---

## The Decision

Use an ordered fallback chain of OpenRouter, Cloudflare Workers AI, Ollama, and Gemini Flash for server-configured AI calls, with retryable failures moving to the next provider.

---

## Why This Option Was Chosen

- The providers have independent quotas and failure modes.
- OpenRouter gives broad model access through one API.
- Cloudflare Workers AI adds another free-tier path when configured.
- Ollama keeps a local/offline option for narration-style calls.
- Gemini remains available as a reliable final configured provider.

---

## Alternatives That Were Considered

### Option: Gemini only
- **What it is:** Keep all server-side calls on Gemini.
- **Pros:** Simple and already integrated.
- **Why rejected:** One provider's quota or outage would take down all AI generation.

### Option: OpenRouter only
- **What it is:** Route all server-side AI calls through OpenRouter.
- **Pros:** Broad model catalog and one API shape.
- **Why rejected:** It still creates a single dependency and daily free-call limits can be exhausted.

### Option: User-selected provider for every internal module call
- **What it is:** Require provider settings for all AI usage, including internal module narration.
- **Pros:** Maximum user control.
- **Why rejected:** Internal server-side tasks need a working default path and should not depend on UI state.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| Different providers may produce different wording. | Structured JSON validation keeps the API shape stable. |
| Silent quota waste can burn free tiers. | OpenRouter has a local daily threshold before it is skipped. |
| Some providers may not be configured. | Missing configuration returns `null` and the chain advances. |

---

## Files Changed

| File | Change |
|---|---|
| `src/ai-agent.js` | Added provider functions, retryable error handling, quota tracking, and fallback chain orchestration. |
| `config/config.js` | Defines provider/model options for user-supplied provider routing. |
| `test/ai-agent.test.js` | Covers fallback behavior and provider routing. |

---

## How to Verify It's Working

- Run `npm test`.
- Configure only one provider and confirm server-side AI calls can use it.
- Simulate retryable provider failures in tests and confirm the chain advances to the next provider.

---

## Related Decisions

- Depends on: ADR-004
- Supersedes: None
- Related: ADR-002

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance. If the decision changes, write a new ADR that supersedes this one.*
