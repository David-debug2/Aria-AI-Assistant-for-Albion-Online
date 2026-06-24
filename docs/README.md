# Aria Documentation

This folder contains the project documentation for Aria.

## Start Here
- `HOW-TO-DOCUMENT.md` - explains this folder's structure and when to update each file.
- `HOW-TO-UPDATE-DOCS.md` - explains how to document shipped changes.
- `PROJECT_OVERVIEW.md` - explains what Aria is, how it works, and how the repo is organized.

## Tracking Changes
- `CHANGELOG.md` - version-by-version log of meaningful changes.
- `CONTRIBUTING.md` - setup, contribution, and documentation conventions.
- `VERSIONING.md` - SemVer release lifecycle policy for Alpha, Beta, RC, and GA.

## Architecture Plans
- `aria-architecture-upgrade-plan.md` - phased Alpha-to-Beta architecture roadmap.
- `aria-rc-provider-market-intelligence-update.md` - RC roadmap for provider cleanup, BYOK, and market intelligence.
- `aria-byok.md` - BYOK planning source for stateless per-request user keys.
- `albion-data-market-intelligence-update.md` - detailed Albion Data market intelligence roadmap.
- `user-api-keys-plan.md` - implementation plan for user-supplied API keys.

## Version Snapshots
- `versions/ALPHA.md` - frozen record of what Alpha was.
- `versions/BETA.md` - frozen record of what Beta was.

## Architecture Decisions
- `decisions/ADR-000-template.md` - copy this to record a new decision.
- `decisions/ADR-001-lexical-chunking.md` - why brain files are chunked before prompt assembly.
- `decisions/ADR-002-user-supplied-api-keys.md` - why user keys are session-only and per-request.
- `decisions/ADR-003-embedding-retrieval.md` - why embeddings use a flat generated JSON index.
- `decisions/ADR-004-structured-json-output.md` - why AI output is schema-shaped JSON.
- `decisions/ADR-005-provider-fallback-chain.md` - why server-configured providers are stacked as fallbacks.
- `decisions/ADR-006-openalbion-gameinfo-data.md` - why OpenAlbion and Gameinfo are used for real item data.
- `decisions/ADR-007-provider-chain-without-ollama.md` - proposed RC decision to remove Ollama from the server fallback chain.
- `decisions/ADR-008-byok-stateless-header-proxy.md` - proposed RC decision for stateless BYOK headers and key fingerprint rate limiting.
- `decisions/phase-0-checkpoint.md` - Phase 0 verification results and context reduction samples.
- `decisions/user-supplied-api-keys-rationale.md` - product/security rationale for the API key feature.

## Also See
- `../README.md` - quick start and API reference.
- `../BRAIN.md` - brain authoring guidelines for editing `albion-brain/`.
