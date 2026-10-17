# Security Policy

Abugida stores your course data, user accounts, and payment state. Take its security
seriously — and if you find a way to break it, tell us privately before you tell the
world.

## Supported versions

The project is under active development and not yet released. Fixes land on the
development branches only — there are no tagged releases to support yet.

| Branch | State                                    | Security fixes |
| ------ | ---------------------------------------- | -------------- |
| `main` | Production-bound; receives vetted merges | ✅             |
| `dev`  | Staging; active development              | ✅             |
| other  | Ephemeral `feature/*` branches           | ❌             |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use one of these private channels, in order of preference:

1. **GitHub Private Vulnerability Reporting** (preferred). Enable it at
   _Settings → Security → Private vulnerability reporting_; advisers can then file a
   draft security advisory that only maintainers can see.
2. **Email** — `security@abugida.dev`. <!-- TODO: replace with the public inbox before publishing -->

We acknowledge every report within **72 hours** and provide a status update at least
every **7 days** until it is resolved. If you reported via email and did not hear back
within 72 hours, assume we missed it and follow up.

### What to include

- The affected area: endpoint, module, package, or compose service.
- Reproduction steps — a PoC request, payload, or compose snippet is worth a page of prose.
- Impact as you understand it (what could an attacker do, to whom).
- Any known workarounds, and how you found the issue.

Feel free to test against your own local deployment (`just setup-dev`). Do not test
against infrastructure you do not own.

### Scope

**In scope**

- `app/api` — every documented endpoint, the auth surface mounted under `/auth/*`, the
  webhook routes under `/webhooks/*`, rate limiting, and the problem+json error contract.
- `app/dashboard` — server functions, session handling, and authorization checks.
- `packages/*` — auth, database, queue, storage, observability, tenant.
- `docker/` — compose definitions, network isolation, Vault configuration, edge (Caddy)
  behavior as configured in this repository.

**Out of scope**

- Secrets in `.env.example` files or defaults in the dev tier — dev credentials are
  placeholders by design (`docs/architecture/security-model.md` documents the dev
  `.env` model, and Vault governs staging/prod).
- Absent hardening on a local dev deployment (CSP, HSTS, etc. live at the Caddy edge in
  staging/prod, not on `localhost`).
- Report output from automated scanners without a demonstrated exploit path.
- Social engineering, physical attack, or denial-of-service by volume.

## What happens next

1. **Triage** — we reproduce the issue and confirm its severity.
2. **Fix** — developed on a private branch, merged to `dev` first, promoted to `main`
   with the regular review flow.
3. **Rotation** — if the issue touches credentials, the corresponding runbook applies
   (secret rotation is part of the release, not a follow-up).
4. **Disclosure** — we publish a summary after a fix ships, crediting you by name unless
   you prefer otherwise. Coordinated disclosure is the default; we ask for a maximum of
   90 days before public detail.

## Security posture in this repository

The full model lives in [`docs/architecture/security-model.md`](docs/architecture/security-model.md):

- Tiered secrets: flat `.env` in dev, HashiCorp Vault with 1 h dynamic credentials and
  PKI leaf certificates in staging/prod (ADR-006).
- Three-layer network isolation; the infrastructure network is `internal: true` and
  cannot reach the internet.
- Redis ACL with three least-privilege users; `FLUSHALL`/`FLUSHDB`/`DEBUG` are disabled.
- Images pinned by version (no `:latest`), Trivy scanned in CI; CRITICAL/HIGH findings
  block the merge.
- Schema-validated environment (`app/api/src/config/app_config.ts`) — the API fails fast
  on misconfiguration instead of booting half-secured.
- Inbound webhooks authenticate with a SHA-256-hashed `X-API-Key` matched against
  `ops.api_keys`.

Run the full audit locally with:

```bash
just security-audit   # check-configs + dependency audit + validate-secrets
```

## Incident runbooks

For operators, the response procedures live under `docs/runbooks/security-events/`:

- [Vulnerability found](docs/runbooks/security-events/vulnerability-found.md)
- [Unauthorized access](docs/runbooks/security-events/unauthorized-access.md)
- [Compromised secret](docs/runbooks/security-events/compromised-secret.md)
- [TLS certificate expired](docs/runbooks/security-events/tls-certificate-expired.md)

Escalation levels, contacts, and SLAs are defined in
[`docs/runbooks/reference/contact-escalation.md`](docs/runbooks/reference/contact-escalation.md).

## Policy

This project is [MIT licensed](LICENSE). Practice code and tooling submitted in
response to this policy is accepted under the same license.
