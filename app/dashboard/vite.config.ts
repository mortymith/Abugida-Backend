import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  server: {
    allowedHosts: ['accuracy-flip-playing.ngrok-free.dev'],
  },
  ssr: {
    resolve: {
      conditions: ['node', 'import'],
    },
  },
})

export default config
