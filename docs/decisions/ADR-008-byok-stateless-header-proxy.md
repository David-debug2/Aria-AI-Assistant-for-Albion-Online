# ADR-008: BYOK Stateless Header Proxy

## Status

**Proposed**

---

## Date

2026-06-24

---

## What This Decision Is About

Aria needs public users to bring their own LLM API keys without turning the server into a long-term secret store. The project also needs to protect itself from abuse without logging or retaining raw keys.

---

## The Decision

Use stateless per-request BYOK headers, route directly to the selected provider, and rate limit by a SHA-256 fingerprint of the supplied key instead of storing raw keys.

---

## Why This Option Was Chosen

- Raw keys are held only in memory for the duration of one request.
- Provider selection remains explicit and user-controlled.
- Fingerprint rate limiting gives abuse protection without storing secrets.
- It fits the current Express server and session-based provider UI without adding accounts or a database.

---

## Alternatives That Were Considered

### Option: Store encrypted keys server-side
- **What it is:** Save user keys in an encrypted database or vault and reference them by user/session.
- **Pros:** Better convenience for returning users.
- **Why rejected:** It makes Aria a secret custodian before the project has a user/account system that justifies that burden.

### Option: Client-side LLM calls
- **What it is:** Have the browser call providers directly with the user's key.
- **Pros:** The server never sees the key.
- **Why rejected:** It exposes Aria's prompts, context assembly, and Albion brain to the browser.

### Option: Use only server-configured providers
- **What it is:** Drop BYOK and make the project owner pay for all AI calls.
- **Pros:** Simpler user experience.
- **Why rejected:** It creates ongoing server-side API cost and quota risk.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| Raw keys still traverse Aria's backend. | Require HTTPS for public use, scrub headers before logs, and never persist raw keys. |
| Users must manage their own provider keys. | Keep setup docs plain and provider errors user-safe. |
| In-memory fingerprint limits reset on restart. | Accept for MVP; move to a shared store only if usage demands it. |
| Two header contracts would confuse clients. | Use one public BYOK header contract long-term and update docs/tests with any migration. |

---

## Files Changed

| File | Change |
|---|---|
| `src/ai-agent.js` | Planned: provider registry and direct BYOK routing. |
| `src/server.js` | Planned: BYOK header validation, scrubbing, and request context wiring. |
| `config/config.js` | Planned: BYOK provider/model allowlist and rate limit settings. |
| `public/index.html` | Planned: BYOK settings UI changes if header/provider behavior changes. |
| `public/js/app.js` | Planned: BYOK key handling and request headers. |
| `README.md` | Planned: user-facing BYOK behavior and setup docs. |

---

## How to Verify It's Working

- Run `npm test`.
- Send a BYOK request and confirm only the selected provider is called.
- Confirm a raw API key never appears in logs, thrown errors, or test snapshots.
- Confirm repeated requests with the same key are counted by fingerprint and the raw key is not stored.

---

## Related Decisions

- Depends on: ADR-002, ADR-004
- Supersedes: None
- Related: ADR-007

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance. If the decision changes, write a new ADR that supersedes this one.*
