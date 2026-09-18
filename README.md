<div align="center">

# Abugida Academy

**A course-operations platform for exam-preparation educators, built for the Ethiopian market.**

[![Status](https://img.shields.io/badge/status-active%20development-orange)](#project-status)
[![Workspaces](https://img.shields.io/badge/workspaces-9-blue)](#product-ecosystem)
[![ADRs](https://img.shields.io/badge/ADRs-25%20records-purple)](docs/architecture/adr/README.md)
[![License](https://img.shields.io/badge/license-unspecified-lightgrey)](#license)

</div>

---

## Overview

Abugida Academy is a self-hostable platform that enables an education organization to operate its entire course business — content authoring, student enrollment, payments, assessments, and analytics — from a single admin workspace. It is designed around the realities of serving Ethiopian learners: pricing in Birr, payment through Telebirr, notifications through local SMS, and federated sign-in through the providers students already use.

At the infrastructure level, the platform is application-agnostic. The same backend stack can host one workspace or many, and the three application surfaces — API, dashboard, and marketing site — are swappable slots rather than hard-coded products.

---

## Problem

Organizations that prepare students for standardized exams — TOEFL, IELTS, GRE, national entrance exams, and similar — typically operate across a fragmented set of tools: a content management system for course material, a separate form builder for assessments, a spreadsheet for enrollments, a payment-link service, and phone-based support. None of these tools share a unified concept of a course tied to an exam type tied to a student's progression, and none price in Birr or accept Telebirr natively.

The result is manual stitching of workflows, duplicated student records across systems, manual payment reconciliation, and limited visibility into where students disengage. There is no single source of truth for what a student owns, what they have completed, and what they should study next.

---

## Solution

Abugida Academy treats the course as the central object of the business. Every other concept — exam types, modules, lessons, quizzes, enrollments, purchases, bundles, bookmarks, recommendations, and downloads — is modeled as a relation on the course graph. This makes the student journey legible end to end: an exam type organizes courses, a course organizes modules, a module organizes lessons, and a lesson organizes quizzes and resources that a student works through in sequence.

Payments, access grants, and progress are not separate systems bolted on; they are first-class relations on the same graph. A purchase creates an enrollment, an enrollment tracks progress, progress unlocks the next lesson, and completion drives both analytics and recommendations. Local payment and notification providers — Telebirr and SMS Ethiopia — are integrated natively rather than through a generic gateway abstraction that strips away their specifics.

---

## Key Features

- **Course catalog by exam type** — A hierarchical exam-type taxonomy (parent to child) allows modeling of structures such as English → TOEFL → Reading without a custom taxonomy per organization.
- **Multi-step course authoring** — A four-step wizard guides a course from details to curriculum to pricing to publish, with draft, published, and archived states.
- **Curriculum builder** — Courses contain modules, modules contain lessons, and lessons contain quizzes and downloadable resources, with prerequisites and unlock rules.
- **Assessment engine** — Per-lesson quizzes track attempts, scores, pass/fail status, time spent, and answer history per student.
- **Enrollment and progress tracking** — Enrollments record source (purchase, bundle, free access, admin grant, preview), progress percentage, completion, and last-accessed timestamps.
- **Course bundles** — Multiple courses can be grouped into a single purchasable bundle with its own pricing.
- **Local payment integration** — A native Telebirr (Ethio Telecom) client handles RSA signing, order creation, and payment-notification verification.
- **Federated authentication** — Sign-in is offered through Google or Telegram only; the platform stores no passwords. Optional multi-factor authentication and per-user device limits are supported.
- **Bookmarks and recommendations** — Students can bookmark lessons, and the platform surfaces recommended next content based on activity.
- **Content library** — A shared asset repository supports upload, preview, transcription and subtitle editing, and folder organization.
- **Analytics** — Course performance, quiz analytics, drop-off analysis, cohort comparison, and report exports.
- **Marketing and growth tooling** — Email campaigns, a template editor, discount codes, an affiliate program, and student testimonials, as specified in the dashboard UX blueprint.
- **Offline-first sync** — PowerSync provides real-time, offline-capable data synchronization to mobile and web clients through PostgreSQL logical replication.

---

## Who It's For

- **Education organizations** operating exam-preparation programs (TOEFL, IELTS, GRE, national exams) that require a single system in place of a fragmented toolchain.
- **Course creators and instructors** in Ethiopia who need to price in Birr and accept Telebirr without building payment integration independently.
- **Platform operators** who require a self-hostable backend they can run on their own infrastructure rather than a closed SaaS offering.
- **Teams serving mobile-first markets** where students study on devices with intermittent connectivity and benefit from offline-first sync.

The admin workspace is role-aware and supports five staff roles — **Admin**, **Editor**, **Reviewer**, **Viewer**, and **Support** — each with scoped capabilities across courses, students, content, and settings.

---

## How It Works

The primary operator journey proceeds in five stages:

1. **Onboard** — An administrator signs in with Google or Telegram, creates a workspace, and completes a starter checklist: invite the team, brand the workspace, and create the first course.
2. **Author courses** — Through the course wizard, the administrator defines a course against an exam type, builds its module and lesson curriculum, sets pricing (free, paid, or bundled), and publishes.
3. **Enroll students** — Students discover courses, pay through Telebirr, and receive an enrollment record that tracks their progress through the curriculum. Administrators may also grant free access, create cohorts, or configure automated enrollment rules.
4. **Track learning** — As students complete lessons and attempt quizzes, the platform records progress, scores, and drop-off points. Instructors review these metrics through per-student and per-course analytics views.
5. **Iterate** — The administrator reviews analytics, exports reports, runs email campaigns, issues discount codes, and adjusts the catalog in response to the data.

At the platform level, the dashboard communicates with the REST API, which reads and writes through a connection-pooled PostgreSQL database. MinIO holds uploads and downloadable resources. Redis handles caching and the background-job queue — covering purchases, enrollments, notifications, exports, moderation, and retention. PowerSync exposes the same data to mobile and web clients with offline synchronization.

---

## Product Ecosystem

The platform is structured as a monorepo with three user-facing applications and five shared packages.

### Applications

| Surface                              | Role                                                                                                                                                      | Audience                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Dashboard** (`app/dashboard`)      | Admin workspace: authentication, course catalog, curriculum builder, student directory, analytics, content library, settings                              | Organization staff                      |
| **API** (`app/api`)                  | REST backend exposing courses, enrollments, purchases, quizzes, bookmarks, recommendations, resources, bundles, downloads, webhooks, and system endpoints | Dashboard, mobile clients, integrations |
| **Marketing site** (`app/marketing`) | Public landing page for prospective students and organizations                                                                                            | Public web visitors                     |

### Shared packages

| Package         | Responsibility                                   |
| --------------- | ------------------------------------------------ |
| `database`      | Drizzle ORM schema and PostgreSQL client         |
| `auth`          | Sessions, tokens, CSRF, and provider integration |
| `storage`       | S3-compatible object storage operations          |
| `queue`         | Background-job definitions and workers           |
| `observability` | Logging, tracing, and metrics instrumentation    |

All five packages are consumed by the applications above, ensuring domain logic remains consistent across surfaces.

---

## Project Status

**Active development — pre-release.** The project is under active construction and is not yet a finished product.

| Dimension               | Status                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| History                 | First commit July 2026; approximately two months of active development                                                                                                                           |
| Activity                | 99 commits on `master`; most recent commit within the current week                                                                                                                               |
| Contributors            | Single author                                                                                                                                                                                    |
| Releases                | No version tags have been cut                                                                                                                                                                    |
| Application surfaces    | The API and dashboard are scaffolded with functional modules. The marketing site currently retains the default Astro starter template.                                                           |
| Application Dockerfiles | Ship with placeholder health-server sections intended to be replaced when a real application is wired in                                                                                         |
| Dashboard UX            | Fully specified across an 11-part UX blueprint (60+ screens), with shadcn/ui scaffolding and authentication flows implemented                                                                    |
| Database schema         | Substantial — spans auth, catalog, learning, finance, ops, and shared concerns, with integrity constraints and Zod validation                                                                    |
| Background jobs         | 14 job types defined (purchases, enrollments, notifications, exports, moderation, retention, audit) with Redis-backed workers                                                                    |
| Infrastructure          | 25 production services defined across a 12-file modular Compose structure. The production tier requires a Linux host (Keepalived VRRP, iptables) and has not been deployed from this repository. |
| CI/CD                   | Workflows are documented in `docs/development/dev-workflow.md`. No `.github/` directory is present in the repository.                                                                            |
| License                 | No `LICENSE` file is present. See the [License](#license) section.                                                                                                                               |

Prospective production users should treat the project as a preview: the architecture and data model are mature, while application surfaces and deployment automation remain in progress.

---

## Getting Started

Two paths are available, depending on whether the intent is application development or running the full infrastructure stack.

### Application development (pnpm + Turborepo)

```bash
pnpm install                          # install all workspace dependencies
pnpm dev                              # start all three apps via the Turborepo TUI
pnpm dev --filter=@abugida/api        # or start a single workspace
pnpm typecheck                        # typecheck the whole monorepo
pnpm test                             # run the test suite
```

Development ports: API on `3001`, Dashboard on `3000`, Marketing on `4321`.

### Infrastructure stack (Docker + Just)

The full stack — databases, cache, storage, observability, and edge — is orchestrated through a single `justfile`:

```bash
bash scripts/setup/prerequisites.sh   # install Docker, Just, Bun, Trivy, jq, nmap
cp .env.example .env                  # configure environment
just setup-dev                        # bootstrap and start the 5-service dev environment
just health                           # verify all services are healthy
```

The production tier requires a Linux host, as Keepalived VRRP and iptables are not supported on macOS or Windows. Full prerequisites and port requirements are documented in [`docs/onboarding/prerequisites.md`](docs/onboarding/prerequisites.md).

---

## Documentation

All documentation lives under [`docs/`](docs/) and is organized by intent:

| Objective                                          | Document                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| Get running in five minutes                        | [Quick Start](docs/onboarding/quick-start.md)             |
| Review prerequisites and ports                     | [Prerequisites](docs/onboarding/prerequisites.md)         |
| Walk through installation step by step             | [Installation](docs/onboarding/installation.md)           |
| Review the system diagram and service catalog      | [Architecture Overview](docs/architecture/overview.md)    |
| Understand deployment tiers and CI/CD flow         | [Deployment Model](docs/architecture/deployment-model.md) |
| Review trust boundaries and secret layering        | [Security Model](docs/architecture/security-model.md)     |
| Browse the 25 Architecture Decision Records        | [ADR Index](docs/architecture/adr/README.md)              |
| Look up a specific service                         | [Service Catalogue](docs/services/_index.md)              |
| Operate the platform under incident or maintenance | [Runbooks](docs/runbooks/README.md)                       |
| Follow the branching model and PR process          | [Development Workflow](docs/development/dev-workflow.md)  |

The dashboard UX specification — 11 parts covering authentication, global navigation, dashboard, courses, content library, students, analytics, settings, shared components, marketing and growth, and global standards — is located under [`app/dashboard/spec /`](app/dashboard/spec /).

---

## Contributing

The repository does not currently include a `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, or `.github/` directory. Formal contribution guidelines, issue templates, and PR templates are not yet defined.

The following conventions are documented:

- **Branching** — Feature branches from `dev`, squash-merged. See [Development Workflow](docs/development/dev-workflow.md).
- **Commit messages** — Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `security`, `test`, `ci`) with a service scope.
- **Pre-commit** — Husky and lint-staged run ESLint and Prettier on staged files.
- **Compose changes** — Run `just validate-compose` before pushing.

Contributors are advised to open an issue in advance to align with the maintainer before submitting a pull request.

---

## License

No `LICENSE` file is present in this repository, and no OSI-approved license has been granted. Until a license file is added, default copyright terms apply: the source is publicly visible but not licensed for redistribution, modification, or production use. Parties interested in using any portion of this project should contact the maintainer to determine licensing terms.
