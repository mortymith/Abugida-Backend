#!/usr/bin/env node
/**
 * Make tsc-emitted ESM resolvable by Node's native ESM loader.
 *
 * Packages are compiled with `"moduleResolution": "Bundler"`, which is what we
 * want for authoring — it lets source use extensionless relative imports like
 * `import * as schema from '../schema'`. TypeScript's emit does not rewrite
 * those specifiers, however, so `dist/src/client.js` ships
 * `from '../schema'`, a *directory* import. Bundlers (Vite) and Bun tolerate
 * that; Node's ESM resolver does not:
 *
 *   ERR_UNSUPPORTED_DIR_IMPORT — Directory import '.../dist/schema' is not
 *   supported resolving ES modules imported from '.../dist/src/client.js'
 *
 * This surfaces as soon as a module is listed in Vite's `ssr.external`, since
 * Vite then hands it to the platform loader instead of bundling it.
 *
 * Switching the package to `moduleResolution: "NodeNext"` would fix the emit
 * but force explicit `.js` extensions on every source import. Rewriting the
 * emitted specifiers instead keeps the source ergonomic and the diff confined
 * to the build.
 *
 * Usage: node scripts/fix-esm-extensions.mjs <dist-dir>
 *
 * Idempotent: specifiers that already carry an extension are left untouched, so
 * re-running after an incremental build is safe. `.d.ts` files are deliberately
 * skipped — TypeScript resolves those extensionless, so they must stay as-is.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, dirname, resolve as resolvePath } from 'node:path'

const distDir = process.argv[2]

if (!distDir) {
  console.error('Usage: node fix-esm-extensions.mjs <dist-dir>')
  process.exit(1)
}

async function collectJsFiles(dir, found = []) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return found
    throw error
  }

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await collectJsFiles(path, found)
    else if (entry.name.endsWith('.js')) found.push(path)
  }
  return found
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** Matches `from '...'`, `import '...'`, `export * from '...'` and `import('...')`. */
const RELATIVE_SPECIFIER =
  /(\bfrom\s*|\bimport\s*|\bexport\s*\*\s*from\s*|\bimport\(\s*)(['"])(\.\.?\/[^'"]*)\2/g

const ALREADY_RESOLVED = /\.(js|mjs|cjs|json|node)$/

async function rewriteFile(file) {
  const source = await readFile(file, 'utf8')
  const replacements = new Map()

  for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
    const specifier = match[3]
    if (ALREADY_RESOLVED.test(specifier)) continue

    // The emitted specifier is extensionless, so the on-disk target has to be
    // probed as `<specifier>.js` or `<specifier>/index.js` — the bare
    // `<specifier>` path never exists on disk.
    const absolute = resolvePath(join(dirname(file), specifier))

    if (await isFile(`${absolute}.js`)) {
      replacements.set(match[0], `${match[1]}${match[2]}${specifier}.js${match[2]}`)
    } else if (await isFile(join(absolute, 'index.js'))) {
      const dirSpecifier = specifier.replace(/\/+$/, '')
      replacements.set(match[0], `${match[1]}${match[2]}${dirSpecifier}/index.js${match[2]}`)
    }
  }

  if (replacements.size === 0) return 0

  let output = source
  for (const [from, to] of replacements) output = output.split(from).join(to)
  await writeFile(file, output)
  return replacements.size
}

let filesChanged = 0
let specifiersFixed = 0

for (const file of await collectJsFiles(distDir)) {
  const fixed = await rewriteFile(file)
  if (fixed > 0) {
    filesChanged++
    specifiersFixed += fixed
  }
}

console.log(`fix-esm-extensions: ${specifiersFixed} specifiers across ${filesChanged} files`)
