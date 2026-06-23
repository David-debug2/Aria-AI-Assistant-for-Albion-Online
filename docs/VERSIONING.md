# Aria Versioning Policy

Aria uses Semantic Versioning (SemVer) for release names:

```text
MAJOR.MINOR.PATCH
```

Example: `v1.4.2`

- **MAJOR** changes when Aria makes a foundational or breaking change.
- **MINOR** changes when Aria adds a backwards-compatible feature.
- **PATCH** changes when Aria fixes a bug without changing how the app is used.

## Release Lifecycle

Aria moves through prerelease stages before a stable General Availability release.

| Stage | Example | Meaning | Audience |
|---|---|---|---|
| Alpha | `v1.0.0-alpha.1` | Core features exist, but the build is unstable and still changing quickly. | Internal testing |
| Beta | `v1.0.0-beta.1` | Planned features are present and need real-world feedback. | Trusted early testers |
| Release Candidate | `v1.0.0-rc.1` | The build is believed to be release-ready unless final testing finds a blocker. | Testers and advanced users |
| General Availability | `v1.0.0` | Stable public production release. | Every end-user |

Prerelease numbers increment when another build is needed in the same stage:

```text
v1.0.0-alpha.1
v1.0.0-alpha.2
v1.0.0-beta.1
v1.0.0-rc.1
v1.0.0
```

## Current Track

Alpha and Beta are closed historical stages in Aria's documentation. The current `1.0` work is the stabilization track toward `v1.0.0`, represented in the changelog as `v1.0.0-rc`.

If release-candidate testing finds a blocking issue, fix it and open the next RC build, such as `v1.0.0-rc.2`. If no blockers are found, promote the same release line to `v1.0.0`.

## Post-Launch Updates

After `v1.0.0` is live, choose the next version by the type of change:

| Update type | Current version | What changed | New version |
|---|---:|---|---:|
| Patch | `v1.0.0` | Bug fix or crash fix only | `v1.0.1` |
| Minor | `v1.0.1` | New backwards-compatible feature | `v1.1.0` |
| Major | `v1.1.0` | Breaking change or major rewrite | `v2.0.0` |

## Future Major Versions

Every future major release restarts the same lifecycle. A large `v2.0.0` overhaul would move through prerelease builds before becoming stable:

```text
v2.0.0-alpha.1
v2.0.0-beta.1
v2.0.0-rc.1
v2.0.0
```

## Documentation Rules

- `docs/CHANGELOG.md` is the human-readable release history.
- `docs/versions/` contains frozen snapshots of completed lifecycle stages.
- Closed snapshots are never edited after they are published.
- This policy is documentation-only unless a future change explicitly adds release scripts, Git tags, CI automation, or package metadata enforcement.
