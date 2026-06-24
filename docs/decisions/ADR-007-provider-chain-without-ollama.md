# ADR-007: Provider Chain Without Ollama

## Status

**Proposed**

---

## Date

2026-06-24

---

## What This Decision Is About

Aria's Beta fallback chain included Ollama as a local provider, but the package was never declared in `package.json`. Keeping it means users either need undocumented local setup or the project needs to add another runtime dependency. The RC update needs a clearer provider policy before migrating the Google SDK and expanding BYOK.

---

## The Decision

Remove Ollama from the server-configured fallback chain and use OpenRouter, Cloudflare Workers AI, and Gemini Flash as the server fallback providers.

---

## Why This Option Was Chosen

- It removes an undeclared dependency path.
- It keeps the default server path focused on providers that work through configured API credentials.
- It reduces fallback-chain test surface before the Google SDK migration.
- It prevents local model setup from being implied as required for normal users.

---

## Alternatives That Were Considered

### Option: Add `ollama` as a dependency
- **What it is:** Keep the existing fallback chain and declare `ollama` in `package.json`.
- **Pros:** Preserves local/offline provider support.
- **Why rejected:** It keeps a local model path in the standard server runtime even though the project is moving toward public BYOK and API-provider routing.

### Option: Keep Ollama as an optional dynamic import
- **What it is:** Leave the code as-is and continue relying on users to install Ollama manually if they want it.
- **Pros:** Lowest code change.
- **Why rejected:** It leaves an undocumented and untested provider path in the main fallback chain.

### Option: Remove server fallback entirely
- **What it is:** Require every request to use BYOK and remove server-configured providers.
- **Pros:** Eliminates project-owner provider cost.
- **Why rejected:** Aria still needs a server-configured path for local development, internal checks, and deployments where an owner-managed key is acceptable.

---

## Trade-offs and Risks

| Trade-off / Risk | How it's managed |
|---|---|
| Local/offline model support is removed from the default provider path. | Revisit as a separate plugin-style provider later if local mode becomes a real product requirement. |
| Fewer fallback providers means fewer independent quotas. | BYOK gives users direct provider control, and the server chain still keeps OpenRouter, Cloudflare, and Gemini. |
| ADR-005 described Ollama as part of the accepted Beta chain. | Keep ADR-005 as historical context and supersede it when this decision is implemented. |

---

## Files Changed

| File | Change |
|---|---|
| `src/ai-agent.js` | Planned: remove Ollama routing, provider hook, and fallback entry. |
| `test/ai-agent.test.js` | Planned: update fallback-chain tests for three providers. |
| `README.md` | Planned: remove Ollama setup and troubleshooting references. |
| `docs/CONTRIBUTING.md` | Planned: remove Ollama setup examples. |
| `docs/PROJECT_OVERVIEW.md` | Planned: update provider chain summary. |

---

## How to Verify It's Working

- Run `npm test`.
- Run `rg "ollama|Ollama" src test package.json package-lock.json` and confirm no runtime/test dependency path remains.
- Simulate OpenRouter and Cloudflare retryable failures and confirm Gemini Flash serves as the final fallback.

---

## Related Decisions

- Depends on: ADR-002, ADR-004
- Supersedes: ADR-005 when implemented
- Related: ADR-008

---

*ADRs are permanent records. Do not delete or heavily edit after acceptance. If the decision changes, write a new ADR that supersedes this one.*
