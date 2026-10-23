# Branch protection & environment protection (QGS-001 §11)

This document is the declarative source for branch protection on `dev` and
`master` and for GitHub environment protection. Apply it via the GitHub UI
(Settings → Branches → Rulesets) or the API; the values below are normative.

## Required status checks (§11.1)

Applied to `dev` and `master`:

| Check              | Required | Notes                                               |
| ------------------ | -------- | --------------------------------------------------- |
| `quality-gate`     | ✅       | Aggregate of `.github/workflows/quality.yml` (§7.2) |
| `security-gate`    | ✅       | Aggregate of `.github/workflows/security.yml`       |
| `build-gate`       | ✅       | All workspaces build                                |
| `integration-gate` | ⏳       | Required on `dev` only after the promotion window   |

Also required:

- Branch must be **up to date** before merge
- **Linear history** — squash merge only, no merge commits
- **No force pushes**, **no deletions**
- CODEOWNERS review required (§11.3)

## Environment protection (§11.2)

| Environment  | Required reviewers | Wait timer | Branch   |
| ------------ | ------------------ | ---------- | -------- |
| `staging`    | 0                  | 0          | `dev`    |
| `production` | 2                  | 10 min     | `master` |

## CODEOWNERS (§11.3)

See `.github/CODEOWNERS`. A PR modifying an owned path requires an approval
from that owner — the human fallback for the machine-enforced boundary gates.

## RACI (§12)

Gate implementation & upkeep: Platform (R/A) · Gate catalogue changes:
Platform (R), maintainers (A) · Waiver approval: feature owner (R) with
security owner (R/A) for security gates · Coverage floor changes: Platform (R),
maintainers (A) · Release & publishing: Platform (R/A).
