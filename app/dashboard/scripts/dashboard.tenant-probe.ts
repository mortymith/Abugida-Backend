/**
 * Tenant resolution probe.
 *
 * Answers one question against the dashboard's **real** configuration: given a
 * hostname, what does Abugida think it is? Run it after changing
 * `TENANT_BASE_DOMAIN` / `VITE_WORKSPACE_DOMAIN`, after adding a reserved
 * subdomain, or when a tenant link behaves unexpectedly in a browser.
 *
 *   bun run scripts/dashboard.tenant-probe.ts
 *   bun run scripts/dashboard.tenant-probe.ts acme
 *
 * Exits non-zero if any hostname resolves to something other than the expected
 * kind, so it is usable as a deployment check, not only as a print-out.
 */
import { resolveTenantFromHostname } from '@abugida/tenant'
import type { TenantHostResolution } from '@abugida/tenant'
import { getTenantUrl } from '@abugida/tenant/url'

import { tenantDomainConfig } from '../src/config/tenant.server'

interface Case {
  hostname: string
  expect: TenantHostResolution['kind']
  why: string
}

/** The local development shape: Vite serves every `*.localhost` host. */
const dev: typeof tenantDomainConfig = {
  ...tenantDomainConfig,
  baseDomain: 'localhost',
  protocol: 'http',
  port: 3000,
}

const productionCases: Case[] = [
  { hostname: 'acme.abugida.com', expect: 'tenant', why: 'an ordinary tenant workspace' },
  { hostname: 'acme.abugida.com.', expect: 'tenant', why: 'a trailing root dot is ignored' },
  { hostname: 'dashboard.abugida.com', expect: 'platform', why: 'organization management' },
  { hostname: 'api.abugida.com', expect: 'platform', why: 'the public API' },
  { hostname: 'www.abugida.com', expect: 'platform', why: 'the marketing site' },
  { hostname: 'abugida.com', expect: 'apex', why: 'the bare domain is never a tenant' },
  { hostname: 'acme.abugida.com.evil.test', expect: 'external', why: 'suffix confusion' },
  { hostname: 'ab.abugida.com', expect: 'invalid', why: 'too short to be a slug' },
]

const devCases: Case[] = [
  { hostname: 'acme.localhost:3000', expect: 'tenant', why: 'the dev port is stripped' },
  { hostname: 'dashboard.localhost:3000', expect: 'platform', why: 'platform is platform in dev' },
]

let failures = 0

function check(config: typeof tenantDomainConfig, cases: Case[]): void {
  console.log(`\nbase domain: ${config.baseDomain} (${config.protocol})`)
  for (const { hostname, expect, why } of cases) {
    const result = resolveTenantFromHostname(hostname, config)
    const ok = result.kind === expect
    if (!ok) failures += 1
    const detail = result.kind === 'tenant' ? ` → slug "${result.slug}"` : ''
    console.log(`  ${ok ? '✓' : '✗'} ${hostname.padEnd(32)} ${result.kind}${detail}  (${why})`)
  }
}

check(tenantDomainConfig, productionCases)
check(dev, devCases)

const slug = process.argv[2]
if (slug) {
  console.log(`\ncanonical URL for "${slug}": ${getTenantUrl({ ...tenantDomainConfig, slug })}`)
}

console.log(failures === 0 ? '\nall hostnames resolved as expected' : `\n${failures} unexpected`)
process.exit(failures === 0 ? 0 : 1)
