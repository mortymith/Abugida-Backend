# boundary-rules

Machine-enforced architecture boundary rules for the Abugida monorepo
(QGS-001 §5.3, gates QG-301 … QG-305).

| Rule                                 | Gate   | Policy                           |
| ------------------------------------ | ------ | -------------------------------- |
| `no-cross-app-imports`               | QG-301 | BLOCKING, hard limit (no waiver) |
| `no-shared-concern-reimplementation` | QG-303 | BLOCKING, hard limit             |
| `no-process-env-outside-config`      | QG-304 | BLOCKING, hard limit             |
| `no-raw-sql-interpolation`           | QG-305 | BLOCKING, hard limit             |

Usage (flat config):

```js
import boundary from './boundary-rules/index.js'

export default [
  {
    files: ['app/api/**'],
    plugins: { boundary: { rules: boundary.rules } },
    languageOptions: { globals: { process: 'readonly' } },
    rules: {
      'boundary/no-cross-app-imports': ['error', { current: '@abugida/api' }],
      'boundary/no-shared-concern-reimplementation': ['error', { current: '@abugida/api' }],
      'boundary/no-process-env-outside-config': 'error',
    },
  },
]
```
