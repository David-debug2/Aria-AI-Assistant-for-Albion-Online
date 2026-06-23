# Implementation Plan: User-Supplied API Keys

## Goal

Let public Aria users bring their own AI API key while keeping credential handling narrow, transparent, and session-only.

## Current State

- `public/js/app.js` sends `/api/ask` with only `{ query }`.
- `src/server.js` forwards the query to `ask(query, liveData)`.
- `src/ai-agent.js` chooses between Ollama and Gemini using server-side environment configuration.
- The current Gemini path depends on the server's `GOOGLE_API_KEY`.

## Target Request Flow

1. User opens Settings in the sidebar.
2. User selects provider and model, then enters an API key.
3. Frontend stores the settings in `sessionStorage`.
4. Chat submit sends:
   - `X-Provider`
   - `X-Model`
   - `X-Provider-Key`
5. `server.js` validates provider/model headers and passes an AI options object to `ask()`.
6. `ai-agent.js` routes the prompt to the selected provider handler.
7. Provider handler returns text using the same response shape already expected by the UI.

## Phase A: Frontend Settings Panel

**Files:** `public/index.html`, `public/js/app.js`, `public/css/styles.css`

Tasks:

- Add a Settings nav item or compact settings section in the sidebar.
- Add provider dropdown with:
  - OpenRouter
  - OpenAI
  - Anthropic
  - Google Gemini
- Add hardcoded model dropdown values per provider.
- Add password input for API key.
- Add key status indicator.
- Store provider, model, and key in `sessionStorage`.
- Load settings from `sessionStorage` on app startup.

Acceptance:

- Key survives page refresh in the same tab.
- Key disappears after tab close.
- No key is printed to console.
- UI clearly says the key is stored only for the browser session.

## Phase B: Frontend Request Wiring

**File:** `public/js/app.js`

Tasks:

- Add a `getAiSettings()` helper.
- Add a `setAiHeaders(headers)` helper.
- Before chat submit, block the request if no provider key is configured.
- Send provider settings as headers on `/api/ask`.

Acceptance:

- `/api/ask` includes `X-Provider`, `X-Model`, and `X-Provider-Key`.
- Missing key produces a clear chat message without calling the backend.
- Existing chat rendering behavior remains unchanged.

## Phase C: Backend Validation

**Files:** `src/server.js`, possibly `config/config.js`

Tasks:

- Read `x-provider`, `x-model`, and `x-provider-key` from `req.headers`.
- Normalize provider values to lowercase ids.
- Add a hardcoded provider/model allowlist.
- Reject missing key/provider/model with 400.
- Reject unsupported provider/model with 400.
- Pass `{ provider, model, apiKey }` to `ask()`.

Acceptance:

- Invalid provider/model fails before any provider call.
- API key is never logged.
- Existing market and crafting endpoints are unaffected.

## Phase D: Provider Abstraction

**File:** `src/ai-agent.js`

Tasks:

- Change `ask(query, liveData, forceIntent)` to accept an optional fourth `aiOptions` argument or options object.
- Keep brain-context loading and prompt construction unchanged.
- Add provider handlers:
  - `askOpenRouter(prompt, model, apiKey)`
  - `askOpenAI(prompt, model, apiKey)`
  - `askAnthropic(prompt, model, apiKey)`
  - `askGeminiWithKey(prompt, model, apiKey)`
- Return the same result object shape: `{ response, engine, intent, filesLoaded }`.
- Keep Ollama as server-side only for internal fallback/admin use.

Acceptance:

- OpenRouter works as the default recommended provider.
- OpenAI, Anthropic, and Gemini native handlers use user-supplied keys.
- Provider errors return a controlled failure to `server.js`.
- The returned `engine` identifies the selected provider and model.

## Phase E: Tests and Manual Verification

**Files:** `test/*.test.js`, possibly new `test/ai-agent-provider.test.js`

Tasks:

- Add validation tests for unsupported provider/model.
- Add tests that verify `/api/ask` rejects missing provider config.
- Add unit-level tests for provider allowlist behavior if exported cleanly.
- Use mocked provider calls where practical; do not require real API keys in automated tests.

Manual checks:

- Start the app with `npm start`.
- Configure OpenRouter in the UI.
- Ask "best T5 PvP build".
- Confirm response appears and engine displays the selected provider/model.
- Confirm browser `sessionStorage` contains the key and `localStorage` does not.
- Close/reopen tab and confirm the key is gone.

## Suggested Hardcoded Model Lists

OpenRouter:

- `openai/gpt-4o-mini`
- `anthropic/claude-3.5-haiku`
- `google/gemini-2.0-flash-001`
- `meta-llama/llama-3.1-8b-instruct`

OpenAI:

- `gpt-4o-mini`
- `gpt-4o`

Anthropic:

- `claude-3-5-haiku-latest`
- `claude-3-5-sonnet-latest`

Google Gemini:

- `gemini-2.0-flash`
- `gemini-1.5-flash`
- `gemini-1.5-pro`

## Implementation Order

1. Add provider/model allowlist.
2. Add backend header validation and pass-through options.
3. Add provider handlers in `ai-agent.js`.
4. Add frontend settings storage and request headers.
5. Add UI styling.
6. Add tests.
7. Run smoke tests with at least OpenRouter.

## Risks

- HTTPS is mandatory before real users enter keys.
- OpenRouter and native provider model IDs can drift; hardcoded lists should be reviewed periodically.
- Provider error response shapes differ, so handlers should normalize failures before returning to the API layer.
- Existing Gemini SDK migration is still valuable later, but it should not block the user-supplied key MVP if the current SDK path still works.
