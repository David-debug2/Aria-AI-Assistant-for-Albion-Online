# Aria RC: Provider & Market Intelligence Update

## Summary

This is the active roadmap for the next Aria RC update.

The update combines three tracks:

1. **Provider SDK Cleanup**: remove Ollama, migrate Google SDK usage to `@google/genai`, and clean stale provider docs.
2. **BYOK Update**: refine Bring Your Own Key around stateless per-request keys, provider registry routing, and safe rate limiting.
3. **Albion Data Market Intelligence**: continue the market roadmap from `docs/albion-data-market-intelligence-update.md`.

Do not edit `docs/versions/BETA.md`; it is frozen history.

## Implementation Order

1. Provider SDK cleanup.
2. BYOK alignment.
3. Albion Data REST correctness.
4. Larger market intelligence phases after the provider and REST foundations are stable.

## Track 1: Provider SDK Cleanup

### Remove Ollama as a provider

- Remove `askOllama()`, `OLLAMA_INTENTS`, Ollama model selection, test provider hooks, and Ollama fallback entries.
- Use this server fallback chain:

```text
OpenRouter -> Cloudflare Workers AI -> Gemini Flash
```

- Do not add `ollama` to dependencies.

### Migrate Google SDK

- Remove `@google/generative-ai`.
- Add `@google/genai` at `^2.10.0`.
- Update Gemini generation, schema usage, embedding calls, and cache handling in:
  - `src/ai-agent.js`
  - `src/schemas.js`
  - `src/brain-loader.js`
  - `scripts/embed-brain.js`
- Verify exact `@google/genai` API shapes against current official Google docs during implementation.

### Preserve existing behavior

- `/api/ask` continues supporting OpenRouter, OpenAI, Anthropic, and Gemini per-request keys.
- OpenRouter quota threshold and Cloudflare fallback behavior remain.
- `node-fetch` stays as the fetch fallback.
- Missing embeddings still fall back to lexical scoring.

## Track 2: BYOK Update

Use `docs/aria-byok.md` as the detailed BYOK planning source.

### MVP direction

- Stateless header proxy.
- Raw key sent only per request over HTTPS.
- No disk, database, or server-side key persistence.
- Provider registry in `ai-agent.js`.
- Hashed key fingerprint rate limiting.
- Clear user-facing no-storage guarantee.

### Alignment with provider cleanup

- Initial BYOK providers should match the supported public provider set:
  - OpenRouter
  - OpenAI
  - Anthropic
  - Gemini
- Treat Cloudflare and Grok as future BYOK extensions unless their API shapes are verified.
- BYOK requests bypass the internal server fallback chain and route directly to the selected user provider.
- Keep server-configured fallback providers separate from user-supplied BYOK providers.

### Header policy

- Prefer one long-term public header contract.
- Either keep the current `X-Provider`, `X-Model`, and `X-Provider-Key` contract or migrate consistently to `X-Aria-Provider` and `X-Aria-API-Key`.
- Do not support two public header contracts long-term.

## Track 3: Albion Data Market Intelligence

Keep `docs/albion-data-market-intelligence-update.md` as the detailed market roadmap. This combined plan only defines when that work begins relative to provider cleanup.

### Phase 1: REST correctness and API parity

- Make history region-aware.
- Support only documented history timescales: `1`, `6`, and `24`.
- Add optional history filters for `quality`, `date`, and `endDate`.
- Build price/history URLs with structured query params.

### Phase 2: normalized Albion Data contracts

- Add normalized shapes for market orders, market history, gold prices, and bandit events.
- Keep source/freshness metadata on normalized records.
- Do not consume packet-capture or private data.

### Phase 3: REST expansion and reliability

- Add gold price support.
- Add charts support.
- Add URL-length-safe batching.
- Add bounded retry/backoff for 429 and transient 5xx errors.

### Later phases

- Freshness-aware market snapshot.
- Daily dump warm start.
- Deduped public NATS live updates.
- Freshness-aware flip, crafting, and guild advice.
- Mode-specific wiki parser pipeline.

## Documentation Updates

- Add this roadmap to `docs/README.md`.
- Add RC changelog entries when each track ships.
- Keep `docs/albion-data-market-intelligence-update.md` linked as the detailed market roadmap.
- Keep `docs/aria-byok.md` linked as the BYOK planning source.
- Add ADRs for:
  - removing Ollama from the server fallback chain
  - stateless BYOK header proxy and fingerprint rate limiting

## Test Plan

### Provider cleanup

- Run `npm install`.
- Run `npm test`.
- Verify fallback tests expect 3 providers.
- Verify no runtime code imports Ollama.
- Verify `@google/generative-ai` is removed from code and lockfile.
- Verify `@google/genai` covers chat, schemas, cache, and embeddings.

### BYOK

- Test supported provider/model validation.
- Test missing/invalid key errors.
- Test BYOK bypasses the server fallback chain.
- Test raw keys are not logged.
- Test fingerprint rate limiting without storing raw keys.

### Market intelligence

- Test region-aware history URLs.
- Test supported/unsupported timescales.
- Test `quality`, `date`, and `endDate` query mapping.
- Add normalizer fixture tests before snapshots, dumps, or NATS.

## Assumptions

- Provider cleanup is the next immediate RC update.
- BYOK is part of the same future update roadmap but can ship after SDK cleanup.
- Albion Data market intelligence remains the next major feature track after provider/BYOK stability.
- `docs/versions/BETA.md` is not edited.
