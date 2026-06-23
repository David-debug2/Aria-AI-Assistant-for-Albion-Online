# User-Supplied API Key System for Aria

## Problem Statement

How might we let any Albion player use Aria with their own AI provider without the developer managing credentials or paying for inference costs?

## Recommendation

Build a settings panel in the existing sidebar UI. The user selects a provider, picks a model, and pastes an API key. The key is stored in `sessionStorage`, never written to a database, and cleared when the tab closes. Every request to `/api/ask` passes the key as an `X-Provider-Key` header alongside `X-Provider` and `X-Model`. The backend reads provider settings from the request, not from `.env`, and routes accordingly.

OpenRouter should be the recommended/default provider because it covers GPT, Claude, Gemini, Mistral, and Llama models through one key format and one API shape. Add native handlers for OpenAI, Anthropic Claude, and Google Gemini for users who already have direct keys.

Skip Azure OpenAI and Microsoft Copilot in the MVP. Their OAuth, tenant, and pricing models are much more complex than the expected value for an Albion fan tool.

## Why Session Storage

Use `sessionStorage` instead of `localStorage` because keys do not survive tab close. This reduces risk for shared computers and avoids making Aria responsible for long-lived credential persistence.

The UI should state:

> Your API key is stored in your browser session only and is sent to the server only to forward your AI request.

## MVP Scope

**In:**

- Settings panel in the sidebar or chat view
- Provider dropdown
- Hardcoded model dropdown per provider
- API key input
- `sessionStorage` key storage with session-clear behavior
- Backend reads `X-Provider-Key`, `X-Provider`, and `X-Model` from request headers
- Provider handlers for OpenRouter, OpenAI, Anthropic Claude, and Google Gemini
- Visual key status indicator

**Out of MVP:**

- Azure OpenAI and Microsoft Copilot
- UI-configurable Ollama
- Server-side key storage
- Accounts/login system
- Dynamic model fetching from provider APIs
- Key validation on input
- Encrypted server-side session storage

## Provider Strategy

OpenRouter is the default "works with everything" path. It minimizes code complexity and gives users one place to access many model families.

Native providers are supported only where they provide obvious value:

- OpenAI for users with direct OpenAI keys
- Anthropic for users with direct Claude keys
- Google Gemini for users with direct Google AI Studio keys

Ollama remains server-side only, configured through `.env`, because local model access does not fit a public-facing user-supplied key flow.

## Security Rules

- Never persist user API keys server-side.
- Never log API keys in server logs or browser logs.
- Validate provider and model against a hardcoded allowlist.
- Require HTTPS in deployment before users enter real keys.
- Return a clear 400 for missing provider, missing key, invalid provider, or invalid model.
- Avoid putting API keys in request bodies or URLs; use headers only.

## Open Questions Resolved

- Ollama should remain server-side only.
- Model dropdowns should use hardcoded lists.
- Session-only key storage is the MVP requirement.

## Future Options

- Optional `localStorage` persistence with an explicit warning and opt-in checkbox.
- Dynamic provider model fetching.
- Lightweight key validation button.
- Server-side encrypted sessions if UX friction becomes significant.
- User accounts and encrypted per-user provider profiles if Aria becomes a SaaS product.
