/**
 * Shared Syncpack configuration for the Abugida monorepo.
 *
 * Run as a DETECTION tool (`pnpm lint:deps` → `syncpack lint`): the goal is
 * to surface version drift across workspaces, not to force identical
 * versions where runtime compatibility legitimately differs. Do not run
 * `syncpack fix` without verifying each package's constraints.
 *
 * - peerDependencies are ignored: peers intentionally declare flexible
 *   ranges (that is their purpose).
 * - TypeScript is mid-migration across workspaces (root ^6.0.3 vs library
 *   ^5.7.x); its dev-range drift is reported but not auto-fixed until every
 *   consumer is verified — see tooling/README.md.
 *
 * @type {import('syncpack').Config}
 */
const config = {
  versionGroups: [
    {
      label: 'Peer ranges are intentionally flexible',
      dependencyTypes: ['peer'],
      isIgnored: true,
    },
  ],
  semverGroups: [
    {
      label: 'TypeScript migration window',
      // Drift is reported but not auto-fixed until each consumer is verified
      // against ^6.0.3 (peer ceiling <6.1.0 in the shared ESLint config).
      // dependencyTypes dev + prod cover every way typescript is declared.
      dependencies: ['typescript'],
      dependencyTypes: ['dev', 'prod'],
      isIgnored: true,
    },
  ],
}

export default config
