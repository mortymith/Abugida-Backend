/**
 * Repository-level Syncpack configuration for the Abugida monorepo.
 *
 * Owned by the repository root: syncpack discovers `syncpack.config.js` in
 * the working directory, so the root script needs no `--config` flag.
 *
 * Run as a DETECTION tool (`pnpm lint:deps` → `syncpack lint`): the goal is
 * to surface version drift across workspaces, not to force identical
 * versions where runtime compatibility legitimately differs. Do not run
 * `syncpack fix` without verifying each package's constraints.
 *
 * - peerDependencies are ignored: peers intentionally declare flexible
 *   ranges (that is their purpose).
 * - dev and prod ranges are aligned across workspaces: every workspace
 *   declares the same range for the same dependency, so a version bump is
 *   a single edit. TypeScript is aligned at `^6.0.3` across the monorepo.
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
}

export default config
