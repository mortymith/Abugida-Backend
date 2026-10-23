// QGS-001 §5.3 — architecture boundary rules (QG-301…QG-305, QG-308).
// Flat-ESLint plugin consumed by @abugida/eslint-config and app configs.
//
// Rules:
//  - no-cross-app-imports: an app may not import another app (QG-301, no waiver).
//  - no-shared-concern-reimplementation: app/* may not import drizzle-orm,
//    better-auth internals, bullmq or @aws-sdk/client-s3 directly except
//    through the @abugida/* package barrel (QG-303; app/api may use better-auth).
//  - no-process-env-outside-config: process.env reads only in the config
//    module of each workspace (QG-304, no waiver).
//  - no-raw-sql-interpolation: ban template literals inside sql`…` tagged
//    templates in packages/database (QG-305, no waiver).

const APP_PACKAGES = ['@abugida/api', '@abugida/dashboard', '@abugida/marketing']
const SHARED_CONCERNS = ['drizzle-orm', 'bullmq', '@aws-sdk/client-s3', 'better-auth']
const BETTER_AUTH_ALLOWLIST = ['@abugida/api']

export default {
  meta: { name: '@abugida/eslint-plugin-boundary-rules', version: '1.0.0' },
  rules: {
    'no-cross-app-imports': {
      meta: {
        type: 'problem',
        docs: { description: 'No cross-app imports (QG-301 — hard limit, no waiver)' },
        schema: [
          {
            type: 'object',
            properties: { current: { type: 'string' } },
            additionalProperties: false,
          },
        ],
        messages: {
          crossApp:
            'Cross-app imports are forbidden (QGS-001 QG-301): "{{imported}}" may not be imported from {{current}}.',
        },
      },
      create(ctx) {
        const current = ctx.options[0]?.current ?? ''
        return {
          ImportDeclaration(node) {
            const source = node.source.value
            if (APP_PACKAGES.includes(source) && source !== current) {
              ctx.report({ node, messageId: 'crossApp', data: { imported: source, current } })
            }
          },
        }
      },
    },
    'no-shared-concern-reimplementation': {
      meta: {
        type: 'problem',
        docs: { description: 'Shared concerns must be consumed via @abugida/* barrels (QG-303)' },
        schema: [
          {
            type: 'object',
            properties: { current: { type: 'string' } },
            additionalProperties: false,
          },
        ],
        messages: {
          direct:
            '"{{pkg}}" may not be imported directly from {{current}}; use the @abugida/* package barrel (QGS-001 QG-303).',
        },
      },
      create(ctx) {
        const current = ctx.options[0]?.current ?? ''
        return {
          ImportDeclaration(node) {
            const source = node.source.value
            const pkg = SHARED_CONCERNS.find((p) => source === p || source.startsWith(`${p}/`))
            if (!pkg) return
            if (pkg === 'better-auth' && BETTER_AUTH_ALLOWLIST.includes(current)) return
            ctx.report({ node, messageId: 'direct', data: { pkg, current } })
          },
        }
      },
    },
    'no-process-env-outside-config': {
      meta: {
        type: 'problem',
        docs: {
          description: 'process.env may only be read in the workspace config module (QG-304)',
        },
        schema: [
          {
            type: 'object',
            properties: { allow: { type: 'array', items: { type: 'string' } } },
            additionalProperties: false,
          },
        ],
        messages: {
          env: 'process.env must only be read in the config module (QGS-001 QG-304). Import the Zod-validated config instead.',
        },
      },
      create(ctx) {
        const allow = ctx.options[0]?.allow ?? ['config', 'env']
        const file = ctx.filename.replace(/\\/g, '/')
        if (allow.some((a) => file.includes(`/config/`) || file.includes(`${a}.config`))) return {}
        return {
          MemberExpression(node) {
            const obj = node.object
            if (
              obj.type === 'Identifier' &&
              obj.name === 'process' &&
              node.property?.name === 'env'
            ) {
              ctx.report({ node, messageId: 'env' })
            }
          },
        }
      },
    },
    'no-raw-sql-interpolation': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Drizzle sql`…` tagged templates must not interpolate raw strings (QG-305)',
        },
        schema: [],
        messages: {
          raw: 'Do not interpolate raw strings into sql`…` — use parameter binding (QGS-001 QG-305).',
        },
      },
      create(ctx) {
        return {
          TaggedTemplateExpression(node) {
            const tag = node.tag
            const isSql =
              (tag.type === 'Identifier' && tag.name === 'sql') ||
              (tag.type === 'MemberExpression' && tag.property?.name === 'sql')
            if (!isSql) return
            for (const expr of node.quasi.expressions) {
              if (expr.type !== 'TemplateLiteral') {
                ctx.report({ node: expr, messageId: 'raw' })
              }
            }
          },
        }
      },
    },
  },
  configs: {},
}
