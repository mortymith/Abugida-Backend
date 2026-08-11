export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/.git/**',
      '**/*.gen.ts',
      '**/.env',
      '**/.env.*',
      '!**/.env.example',
      '**/*.tsbuildinfo',
    ],
  },
]
