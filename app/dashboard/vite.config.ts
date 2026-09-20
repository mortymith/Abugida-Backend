import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { stdlib } from 'vite-plugin-stdlib'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [stdlib(), devtools(), tailwindcss(), tanstackStart(), viteReact()],
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
