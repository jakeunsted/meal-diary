# Feature pipeline handoffs

Agents return these sections in their final message. The orchestrator saves only the brief and the design.

## Market research

```markdown
## Market research

### Table stakes
- What comparable household meal planners, shared shopping lists, or family diaries already do for this kind of feature

### Notable patterns
- Patterns worth copying, and why they matter for a family sharing one diary

### Risks
- Trust, privacy, sharing, or expectation risks

### Sources
- Title — URL — what it supports

### Uncertain
- Claims you could not check
```

## Practice review

```markdown
## Practice review

### Existing behavior
- Domain (auth, family groups, diary, recipes, shopping list, billing) and how it works today
- Files that already own that behavior

### Constraints
- Rules from `.cursor/rules/meal-diary-rules.mdc`, `AGENTS.md`, and `apps/mobile/AGENTS.md` that apply
- Stripe on web versus RevenueCat on mobile, when billing is involved

### Likely files
- Path — why it would change

### Surfaces
- API: change or unchanged
- Web: change or unchanged
- Mobile: change or unchanged
- Shared types: change or unchanged

### Conflicts
- Where the idea fights current behavior

### Uncertain
- What you could not confirm in the repo
```

## Questions

The orchestrator asks these with the AskQuestion tool. Seven questions is the maximum. Each option list starts with the recommended choice, and that label ends with `(Recommended)`.

```markdown
## Open questions

1. Question
   - Recommended: …
   - Other real options: …
   - Why it is still open: …
```

## Brief

Saved as `docs/features/<slug>/brief.md`.

```markdown
# <Feature name>

## Problem
Who has the problem, and what they can do when this is done.

## Decision
The rough idea, restated as one decision.

## Research
- Table stakes and patterns that shaped this brief
- Constraints and conflicts from the current Meal Diary code

## Answers
- Question — answer

## Assumptions
- Assumption — what the user can reject

## Out of scope
- Later work and surfaces that stay as they are
```

## Design

Saved as `docs/features/<slug>/design.md`.

```markdown
# <Feature name> design

## Surfaces
- API: change or unchanged — why
- Web: change or unchanged — why
- Mobile: change or unchanged — why
- Shared types: change or unchanged — why

## Flows
### Web
Steps, empty state, and error state. New copy is an i18n key under `frontend/i18n/locales/`, not literal text.

### Mobile
Steps, empty state, and error state. New copy goes through `apps/mobile/lib/i18n/`. Android is the target unless this design includes iOS.

## API contract
Method, path, auth, request, response, and errors. Say "no API change" when the contract stays the same.

## Data
Models, fields, and family-group ownership.

## Entitlements
Free, premium, Stripe, or RevenueCat impact. Say "none" when access stays the same.

## Test plan
- API: which unit tests, or none
- Shared: which unit tests, or none
- Web: which Cypress specs, or none, and the browser flow to exercise
- Mobile: which unit tests and whether `tsc` is required, or none

## Files
- Path — owner (`api-builder`, `web-builder`, or `mobile-builder`)
```

## Builder report

```markdown
## Builder report

### Surface
api, web, or mobile

### Contract
Types, endpoints, and i18n keys the other surfaces must use. Write "unchanged" when this builder did not own a new contract.

### Changed
- Path — what changed

### Tests run
- Command — pass or fail

### Left open
- Anything the design asked for that is still missing
```

## Verification

```markdown
## Verification

### Passed
- Command or flow — evidence

### Failed
- Command or flow — failure — surface that owns the fix (`api-builder`, `web-builder`, or `mobile-builder`)

### Not run
- Check — why

### Browser
Say whether the parent still needs to exercise a web flow. The verifier does not claim the browser pass.
```
