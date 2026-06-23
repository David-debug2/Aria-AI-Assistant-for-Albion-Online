# How to Document Aria — A Guide to This Documentation System

This file explains the documentation system itself: what files exist, what each one is for, when to update them, and how they connect to each other. Read this once when you join the project, and refer back to it whenever you're not sure where something belongs.

---

## The Four Documents You Need to Know

```
docs/
├── CHANGELOG.md              ← "What changed and when" — update every version
├── CONTRIBUTING.md           ← "How to work on this project" — update rarely
├── HOW-TO-DOCUMENT.md        ← This file — update only if the system changes
├── HOW-TO-UPDATE-DOCS.md     ← how to update docs after any change
├── versions/
│   ├── ALPHA.md              ← Frozen snapshot of what Alpha was
│   ├── BETA.md               ← (create when Beta ships)
│   └── ...                   ← One file per major version, created when that version ships
└── decisions/
    ├── ADR-000-template.md   ← Copy this to create a new ADR
    ├── ADR-001-*.md          ← One file per significant architectural decision
    └── ...
```

---

## Document 1: CHANGELOG.md

### What it is
A running log of every meaningful change to Aria, organized by version. It's the first place a returning contributor or new developer looks to understand what's happened since they last touched the project.

### Who it's for
Everyone — developers, non-coders, players who contribute game knowledge.

### When to update it
Every time you ship something. A feature, a fix, a brain file update, a dependency change — if it changed Aria in any way, it belongs in the CHANGELOG.

### How to add an entry

Find the current in-progress version section and add one line under the right category:

```markdown
### Added
- Real T5 weapon stat tables in `8_weapons_armor.md`

### Fixed
- Ollama routing now correctly fires for summarization tasks

### Changed
- Brain loader now returns section chunks instead of whole files
```

**Rules:**
- One line per change, plain English
- Link to an ADR if the change was driven by a significant decision: `(see ADR-001)`
- Don't collapse multiple changes into one vague line ("various improvements")
- Don't delete old version sections — they're permanent

### How versions are named

| Name | Meaning |
|---|---|
| **Alpha** | First working version — proves the concept |
| **Beta** | Architecture improvements — makes it right |
| **1.0** | First "production-ready" release (naming shifts to numbers after Beta) |
| **1.1, 1.2...** | Incremental improvements after 1.0 |
| **2.0** | Major breaking change or architectural overhaul |

You decide when a version is "done" and a new one begins. There's no rule — use your judgment. When you've shipped all the planned work for a phase, close that version and open the next one.

---

## Document 2: Version Snapshots (docs/versions/)

### What they are
Frozen, comprehensive descriptions of what a specific version of Aria was — its features, its file structure, its known limitations, its key decisions. Once a version is closed, its snapshot file is never edited again.

### Who they're for
New developers who need to understand the history, and the project owner who wants to remember what state things were in before a big change.

### When to create one
When a major version ships. Alpha is already done. Create `BETA.md` when Beta is complete.

### How to create one

Copy `versions/ALPHA.md` as a template. Update every section:

1. **Theme** — one sentence describing the version's purpose
2. **What a user could do** — feature table (non-technical)
3. **How it worked** — plain-English walkthrough for non-coders
4. **What it did NOT have** — honest list of known gaps
5. **File map** — the directory tree with one-line descriptions
6. **Key technical decisions** — a table linking to the relevant ADRs
7. **Dependencies** — what packages were used and why
8. **How to run it** — preserved setup commands
9. **Test coverage** — what was tested and what wasn't

**Important:** Once the version ships and you create the snapshot, **freeze it**. Never edit a closed version's snapshot. If something was wrong in Beta, that's a Beta fact — document the correction in the next version.

---

## Document 3: ADRs (docs/decisions/)

### What they are
Architecture Decision Records. Each one answers the question: "Why was this built this way, and what alternatives were considered?"

### Who they're for
Developers (current and future) who need to understand *why* a decision was made — especially before changing something that looks arbitrary but isn't.

### When to write one

Write an ADR when:
- You're choosing between two or more serious technical approaches
- The decision would take more than 10 minutes to explain verbally
- A future developer might reasonably ask "why didn't they just use X instead?"
- The decision is expensive or time-consuming to reverse

**Don't** write an ADR for:
- Obvious choices with no real alternatives
- Minor implementation details
- Temporary decisions you plan to revisit soon

### How to create one

1. Copy `docs/decisions/ADR-000-template.md`
2. Rename it: `ADR-00X-short-descriptive-title.md` (use the next available number)
3. Fill in every section — especially the "Alternatives Considered" and "Trade-offs" sections
4. Add a link to it in `CHANGELOG.md` under the version where it was decided

### Numbering

ADRs are numbered sequentially: ADR-001, ADR-002, ADR-003...
Never reuse a number. Never renumber existing ADRs. If a decision is superseded, the old ADR stays as-is and the new one references it.

### ADR lifecycle

```
PROPOSED → ACCEPTED → (SUPERSEDED by ADR-XXX | DEPRECATED)
```

- **Proposed:** Being discussed, not yet implemented
- **Accepted:** Implemented and active
- **Superseded:** A newer ADR replaced this decision
- **Deprecated:** The decision is no longer relevant (e.g. a dependency was removed)

---

## Document 4: CONTRIBUTING.md

### What it is
A plain-English guide for anyone who wants to work on Aria — coders and non-coders. It covers setup, conventions, and the rules for contributing.

### When to update it
When the project's setup process changes, when new contribution conventions are established, or when a new category of contributor needs guidance.

### What NOT to put in it
Specific feature decisions or version history — those belong in CHANGELOG.md and ADRs.

---

## The Decision Flowchart: "Where Does This Go?"

```
I want to record something about Aria...
│
├── I changed something in the code or brain files
│   └── → Add a line to CHANGELOG.md
│
├── I made a significant architectural choice
│   └── → Write an ADR + link it from CHANGELOG.md
│
├── A major version just shipped
│   └── → Create a new file in docs/versions/
│
├── How contributors should work changed
│   └── → Update CONTRIBUTING.md
│
└── The documentation system itself changed
    └── → Update this file (HOW-TO-DOCUMENT.md)
```

---

## Version Transition Checklist

Use this when closing one version and opening the next:

**Closing the current version:**
- [ ] All CHANGELOG entries for this version are written
- [ ] All ADRs for decisions made this version are written and linked
- [ ] Version snapshot file created in `docs/versions/`
- [ ] Snapshot reviewed for accuracy — correct any gaps before freezing
- [ ] CHANGELOG version section marked with a completion date

**Opening the next version:**
- [ ] New version section added at the top of CHANGELOG.md
- [ ] Theme decided (one sentence: "what is this version trying to accomplish?")
- [ ] Planned work listed under the relevant categories (can be stubs initially)

---

## Quick Reference

| I want to... | Go to... |
|---|---|
| See what's changed recently | `docs/CHANGELOG.md` |
| Understand what Alpha had | `docs/versions/ALPHA.md` |
| Make a code change | `docs/CONTRIBUTING.md` → Section 5 |
| Edit game knowledge (no code) | `docs/CONTRIBUTING.md` → Section 3 |
| Record a technical decision | Copy `docs/decisions/ADR-000-template.md` |
| Understand why something was built a certain way | `docs/decisions/` |
| Understand the full upgrade roadmap | `docs/aria-architecture-upgrade-plan.md` |

---

*This documentation system is designed to be lightweight. The goal is one source of truth per concern — not exhaustive documentation of every line of code. If maintaining a document feels like overhead with no return, question whether it's needed. If you find yourself explaining the same thing twice in chat or verbally, that's the signal it needs to be written down.*
