<!--
  QGS-001 §4 — Definition of Done. All items below are merge criteria.
  Waivers: append `<!-- waiver: QG-xxx -->` (see docs/quality/README.md §13).

-->

## Summary

Linked issue / work item: <!-- required (§4.8) -->

## Definition of Done checklist (QGS-001 §4)

- [ ] G1 completed on the PR head SHA (no stale merge-commit runs)
- [ ] Every BLOCKING gate green, or a time-boxed waiver attached and approved (`<!-- waiver: QG-xxx -->`)
- [ ] ADR referenced if this changes architecture (packages public API / docker compose / app config)
- [ ] Runbook / service doc linked if this changes infrastructure (`docker/**`, `scripts/**`)
- [ ] New/changed code is covered by tests that fail without the change (reviewer verifies at least one)
- [ ] Coverage does not regress beyond the §6.3 ratchet floor
- [ ] Commit history is Conventional-Commits compliant (squash merge only, no merge commits)
- [ ] All required reviewers approved (CODEOWNERS)

## Test evidence

<!-- Which tests cover this change? How do they fail without it? -->

## Waivers (if any)

<!-- e.g. <!-- waiver: QG-107 --> with justification and docs/quality/waivers/ file -->
