/**
 * @example astro/integration
 * @description Wiring the Astro integration for the marketing site.
 *
 * File: astro.config.mjs
 */

import { defineConfig } from 'astro/config'
import { astroObservability } from '../src/integrations/astro.ts'

export default defineConfig({
  output: 'server',
  integrations: [
    astroObservability({
      serviceName: 'marketing',
      serviceVersion: '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
    }),
  ],
})
