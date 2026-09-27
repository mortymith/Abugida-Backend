import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      server: { entry: './default-entry/server.ts' },
    }),
    viteReact(),
  ],
  server: {
    allowedHosts: ['accuracy-flip-playing.ngrok-free.dev'],
  },
  ssr: {
    // `@abugida/queue` pulls Bun's native Redis client (`import 'bun'`), which
    // rolldown cannot bundle — keep it a runtime import resolved by Bun, and
    // never reachable from the client environment (only `.server` chunks use it).
    // Marketing campaign sends enqueue EMAIL_NOTIFICATION jobs through it.
    //
    // `@abugida/database` is deliberately NOT listed here: it compiles with
    // `moduleResolution: "Bundler"`, so tsc emits extensionless specifiers that
    // Node's ESM loader rejects. Bundling it lets Vite resolve those imports.
    external: ['pg', '@abugida/queue'],
    resolve: {
      conditions: ['node', 'import'],
    },
  },
  optimizeDeps: {
    exclude: ['pg', '@abugida/queue'],
  },
})

export default config
