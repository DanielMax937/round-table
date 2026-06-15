# Triage

## fix-now
- components/Navigation.tsx:63 - New `/buzzy-agent` links can ship without a tracked route
  Severity: High
  Cost: small
  Risk: Unfixed risk is broad user-facing 404s from global navigation and movie CTAs; fix risk is low because it is local to route/link ownership, not architectural.
  Rationale: The PR introduces links to `/buzzy-agent` but the route is not tracked in the changeset. This can regress production navigation from a clean checkout/deploy. Either include the route/component and required dependencies, or remove/feature-gate the links before merge.
  Fix owner: this-pr

## defer

## skip

# Merge Guidance
decision: block
rationale: The reviewed tracked diff can ship clickable links to a missing App Router route. This is a concrete correctness regression with broad navigation blast radius and a small local fix, so the PR should not proceed until fixed.
