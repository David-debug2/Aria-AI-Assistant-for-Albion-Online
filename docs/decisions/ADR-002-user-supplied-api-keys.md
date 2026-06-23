# ADR-002: User-Supplied API Keys

## Status

**Accepted**

---

## Date

2026-06-23

---

## What This Decision Is About

Aria needed to be usable by different players without the project owner paying for every AI call or storing user credentials. The app also needed a provider model that could support OpenRouter, OpenAI, Anthropic, and Gemini without making the backend a long-lived secret store.

---

## The Decision

Store user API keys only in browser `sessionStorage`, send them to `/api/ask` in request headers, validate provider/model allowlists on the backend, and never persist those keys server-side.

---

## Why This Option Was Chosen

- It avoids long-lived backend custody of user credentials.
- `sessionStorage` clears on tab close, which is safer for shared computers than default persistent storage.
- Per-request provider metadata lets one backend support several AI providers with one route.
- A hardcoded provider/model allowlist prevents arbitrary provider injection.
- OpenRouter can act as the recommended broad-coverage provider while native keys remain available.

---

## Alternatives That Were Considered

### Option: Server-side encrypted session storage
- **What it is:** Encrypt a user key on the server and keep it for the session.
- **Pros:** Cleaner UX because the key does not need to be sent each request.
- **Why rejected:** It makes the backend responsible for key custody and secret rotation before Aria needs accounts or long-lived sessions.

### Option: Local storage in the browser
- **What it is:** Persist keys in `localStorage`.
- **Pros:** Better convenience because keys survive browser restarts.
- **Why rejected:** Persistent browser storage is a poor default for API keys in a public-facing tool.

### Option: Environment variables only
- **What it is:** The deployer configures one server API key in `.env`.
- **Pros:** Simple for private deployments.
- **Why rejected:** It does not fit a public-facing tool where each user should bring their own key.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| The key crosses the network on every `/api/ask` request. | Deployment must use HTTPS before real users enter keys. |
| Session-only storage is less convenient. | The UI shows key status and the user can paste the key again when needed. |
| Provider model lists can become stale. | Models are centralized in `config/config.js` for explicit updates. |

---

## Files Changed

| File | Change |
|---|---|
| `public/index.html` | Added provider settings UI. |
| `public/js/app.js` | Stores provider settings in `sessionStorage` and sends provider headers. |
| `public/css/styles.css` | Styles the provider settings controls. |
| `src/server.js` | Validates provider headers and allowlisted models. |
| `src/ai-agent.js` | Routes per-request provider calls. |
| `config/config.js` | Defines provider and model allowlists. |
| `docs/decisions/user-supplied-api-keys-rationale.md` | Captures product/security rationale. |
| `test/api-key-validation.test.js` | Tests backend header validation. |

---

## How to Verify It's Working

- Run `npm test`.
- In the browser, set provider/model/key and confirm `/api/ask` sends `X-Provider`, `X-Model`, and `X-Provider-Key`.
- Close and reopen the tab and confirm the key is no longer present.
- Send an invalid provider or model and confirm the API returns 400 without calling an AI provider.

---

## Related Decisions

- Depends on: None
- Supersedes: None
- Related: ADR-005

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance. If the decision changes, write a new ADR that supersedes this one.*
