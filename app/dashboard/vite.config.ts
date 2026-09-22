import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { stdlib } from 'vite-plugin-stdlib'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * vite-plugin-stdlib registers its node-stdlib alias map globally, which in
 * rolldown-vite also rewrites `node:` subpath imports (e.g. `node:stream/promises`
 * pulled in by srvx) during the SSR build and breaks resolution. The browser
 * polyfill aliases are only meaningful for the client environment, so scope them
 * there and leave the server build on real Node builtins. The remaining stdlib
 * pieces (Buffer/global/process injects) are safe for SSR: they re-export Node's
 * own modules.
 */
function stdlibClientScoped() {
  const plugin = stdlib() as unknown as {
    name: string
    config: () => {
      resolve?: { alias?: unknown }
      oxc?: unknown
      optimizeDeps?: unknown
      build?: unknown
    }
  }
  const { resolve, ...ssrSafe } = plugin.config()
  return {
    name: 'vite-plugin-stdlib (client-scoped aliases)',
    config() {
      return {
        ...ssrSafe,
        environments: {
          client: { resolve },
        },
      }
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [stdlibClientScoped(), devtools(), tailwindcss(), tanstackStart(), viteReact()],
  server: {
    allowedHosts: ['accuracy-flip-playing.ngrok-free.dev'],
  },
  optimizeDeps: {
    exclude: ['pg', '@abugida/database/client'],
  },
  ssr: {
    external: ['pg', '@abugida/database/client'],
    resolve: {
      conditions: ['node', 'import'],
    },
  },
})

export default config
