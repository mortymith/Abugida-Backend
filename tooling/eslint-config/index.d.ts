import type { Linter } from 'eslint'

/** Re-export of `typescript-eslint` so consumers compose configs without
 * declaring their own (drifting) copy of the plugin. */
export declare const tseslint: typeof import('typescript-eslint').default

/** File globs the TypeScript rules apply to. */
export declare const typescriptFiles: string[]

/** Ignores shared by every consumer. */
export declare const globalIgnores: string[]

/** Rules shared by every workspace in the repository. */
export declare const sharedRules: NonNullable<Linter.RulesRecord>

/**
 * Config block that applies the shared rules and registers the plugin that
 * implements them.
 */
export declare function sharedRulesConfig(options?: {
  files?: string[]
  rules?: Linter.RulesRecord
  plugin?: boolean
}): Linter.Config

/** Type-aware block for workspaces that lint with a tsconfig project. */
export declare function typescriptProject(options?: {
  files?: string[]
  project?: string | boolean | string[]
  tsconfigRootDir?: string
}): Linter.Config

/** Base flat config: ignores + typescript-eslint recommended + shared rules. */
declare const config: Linter.Config[]

export default config
