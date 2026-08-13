import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: { resolve: true },
    splitting: false,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
  },
  {
    entry: ['src/middleware/hono/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    outDir: 'dist/middleware/hono',
  },
  {
    entry: ['src/middleware/tanstack/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    outDir: 'dist/middleware/tanstack',
  },
])
