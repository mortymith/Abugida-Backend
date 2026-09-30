/**
 * @module client/plugins
 *
 * Client-side mirror of the server plugin registry. Client-safe: no database,
 * no Node built-ins, no server configuration. Apps get the same organization
 * and two-factor actions the server exposes, with the same additional-field
 * contract, so the browser and the server can never disagree about the shape
 * of an organization.
 */

import { organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { ORGANIZATION_ADDITIONAL_FIELDS } from '../plugins/constants'

/**
 * Client plugins for the Abugida platform, in the same order as the server
 * registry. Pure, so it can be asserted in tests.
 *
 * The return type is deliberately left to inference: widening it to
 * `BetterAuthClientPlugin[]` would erase each plugin's `$InferServerPlugin`,
 * and `authClient.useSession()` would stop knowing that a session carries an
 * active organization.
 */
export function buildClientPlugins() {
  return [
    organizationClient({
      schema: {
        organization: {
          additionalFields: { ...ORGANIZATION_ADDITIONAL_FIELDS },
        },
      },
    }),
    twoFactorClient(),
  ]
}
