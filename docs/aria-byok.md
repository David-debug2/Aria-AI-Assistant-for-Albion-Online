# Aria BYOK: Bring Your Own Key

## Problem Statement

Aria needs a way for public users to bring their own LLM API key so the app can work without server-side API costs, without leaking the user's key, and without exposing Aria's Albion brain in browser-side LLM calls.

## Recommended Direction

Use a **stateless header proxy with in-memory rate limiting by key fingerprint**.

The user's raw API key travels in a custom request header over HTTPS on every request. The server reads it, instantiates the selected provider client in memory, sends the LLM request, and drops the key immediately. The raw key is never written to disk, logged, or stored in a database.

To detect abuse without storing keys, the server hashes each incoming key with SHA-256 and tracks request counts against that hash in a bounded in-memory store. This gives per-key rate limiting with zero raw-key retention.

BYOK requests should bypass the internal fallback chain. A user-selected provider should route directly to that provider with the user's key. Server-configured fallback providers remain separate and apply only when no BYOK provider is supplied.

## Initial Provider Scope

The initial BYOK provider set should match Aria's current public provider support:

- OpenRouter
- OpenAI
- Anthropic
- Gemini

Cloudflare Workers AI and Grok remain future BYOK candidates until their API shapes, auth requirements, and model defaults are verified.

## MVP Scope

**In:**

- Provider registry in `ai-agent.js`.
- One public BYOK header contract.
- Per-request raw key handling only.
- SHA-256 fingerprint rate limiting.
- Explicit header scrubbing before logs.
- Graceful error translation:
  - 401: invalid key
  - 429: provider rate limit hit
  - 400: bad provider request
- User-facing no-storage documentation.

**Out of MVP:**

- Server-side encrypted key storage.
- User accounts and encrypted vaults.
- Streaming responses.
- Provider quality A/B testing.
- Billing or metered usage.
- Browser-side direct LLM calls.

## Header Contract

Aria should use one public header contract long-term.

Current implementation already uses:

```text
X-Provider
X-Model
X-Provider-Key
```

The RC update can either keep that contract or migrate consistently to:

```text
X-Aria-Provider
X-Aria-API-Key
```

Do not support both contracts long-term. If the header names change, update `README.md`, frontend request code, backend validation, and tests in the same change.

## Key Assumptions to Validate

- Users will supply valid keys often enough for BYOK to be worth the UX cost.
- HTTPS is enforced before public BYOK usage.
- The in-memory fingerprint limiter stays bounded under real usage.
- Users understand that "we do not store your key" requires behavior, docs, and logging discipline.
- Default model choices per provider are good enough for MVP if a full model picker is deferred.

## Implementation Entry Points

- `src/ai-agent.js`: provider registry and direct BYOK routing.
- `src/server.js`: header validation, header scrubbing, and request context wiring.
- `src/market-cache.js` or a new rate limiter module: fingerprint counters.
- `config/config.js`: BYOK provider/model allowlist and rate limit settings.
- `public/index.html` and `public/js/app.js`: provider settings UI and key handling.
- `README.md`: user-facing setup and key handling documentation.

## Test Plan

- Supported provider/model validation passes.
- Unsupported provider/model validation fails before any provider call.
- Missing API key returns a clear 400.
- Invalid provider key returns a user-safe 401-style error.
- BYOK calls bypass server fallback providers.
- Raw keys do not appear in server logs, browser logs, errors, or snapshots.
- Fingerprint rate limiting counts repeated requests without retaining the raw key.
