/**
 * @module plugins/constants
 *
 * Constants shared by the server and client plugin registries. Kept in their
 * own module so a client bundle can import them without pulling in
 * better-auth's server plugins.
 */

/**
 * Fields declared on top of better-auth's built-in `organization` model.
 *
 * Keep in sync with `organization.use_case` in `@abugida/database` — the
 * column is `NOT NULL`, so the field is part of this package's contract with
 * the schema and is not something an app may opt out of.
 */
export const ORGANIZATION_ADDITIONAL_FIELDS = {
  useCase: { type: 'string', required: true, input: true },
} as const
