# Abandonment Gate

decision: continue
rationale: below abandonment thresholds
qualitative_review: /Users/daniel/Desktop/git/round-table/code_review/buzzy-agent-flow/iteration-0/ABANDONMENT_REVIEW.md

counts:
- critical: 0
- high: 0
- medium: 0
- low: 0

thresholds:
- abandon when critical >= 3
- needs-human-judgment when high >= 8

This gate is advisory but blocking for the automated fix loop. A human must confirm before fixing, merging, or abandoning.
