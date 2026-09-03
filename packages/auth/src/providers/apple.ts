/**
 * @module providers/apple
 *
 * Sign in with Apple. better-auth's built-in "apple" social provider already
 * handles the OAuth redirect + id_token verification dance; this module is
 * responsible for:
 *   - validating the credential shape at startup (fail fast, not at request time)
 *   - generating the ES256 client-secret JWT Apple requires in place of a
 *     static client secret
 *   - normalizing the `name`/`email` scopes and native-app (bundle id) case
 *
 * better-auth expects `clientSecret` to be a plain string that it embeds in
 * the token request, so the JWT is minted here, synchronously, whenever a
 * Better Auth instance is created. The secret is short-lived (Apple caps it
 * at ~6 months) and is regenerated on every process start, so rotating the
 * .p8 key never requires shipping a stale secret.
 */

import { createSign } from 'node:crypto'
import type { AppleProviderCredentials, AuthProviderDefinition } from '../core/types'
import { assertNonEmpty, invalidCredential } from './base'

const APPLE_TOKEN_AUDIENCE = 'https://appleid.apple.com'
const DEFAULT_CLIENT_SECRET_TTL_SECONDS = 15_777_000 // Apple's documented max (~6 months)

function base64Url(input: Buffer): string {
  return input.toString('base64url')
}

/**
 * Converts an ASN.1/DER ECDSA signature (node:crypto output) into the raw
 * fixed-width R||S form JOSE expects (64 bytes for ES256).
 */
function derSignatureToJose(signature: Buffer): Buffer {
  const rStart = signature.indexOf(0x02)
  const rLenByte = signature[rStart + 1]
  if (rStart < 0 || rLenByte === undefined) {
    throw new Error('Apple client secret signing produced an invalid signature.')
  }
  let r = signature.subarray(rStart + 2, rStart + 2 + rLenByte)
  if (r[0] === 0x00) r = r.subarray(1) // strip DER leading zero

  const sStart = signature.indexOf(0x02, rStart + 2 + rLenByte)
  const sLenByte = signature[sStart + 1]
  if (sStart < 0 || sLenByte === undefined) {
    throw new Error('Apple client secret signing produced an invalid signature.')
  }
  let s = signature.subarray(sStart + 2, sStart + 2 + sLenByte)
  if (s[0] === 0x00) s = s.subarray(1) // strip DER leading zero

  const pad32 = (value: Buffer): Buffer =>
    value.length === 32 ? value : Buffer.concat([Buffer.alloc(32 - value.length), value])

  return Buffer.concat([pad32(r), pad32(s)])
}

/**
 * Generates the ES256 JWT Apple uses as the OAuth client_secret. Synchronous
 * (node:crypto) so `createAuth()` stays a synchronous factory. Re-run on every
 * boot; each token is valid for `clientSecretTtlSeconds` (default ~6 months).
 */
export function generateAppleClientSecret(credentials: AppleProviderCredentials): string {
  const ttl = credentials.clientSecretTtlSeconds ?? DEFAULT_CLIENT_SECRET_TTL_SECONDS
  const now = Math.floor(Date.now() / 1000)

  const header = base64Url(Buffer.from(JSON.stringify({ alg: 'ES256', kid: credentials.keyId })))
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        iss: credentials.teamId,
        iat: now,
        exp: now + ttl,
        aud: APPLE_TOKEN_AUDIENCE,
        sub: credentials.clientId,
      }),
    ),
  )
  const signingInput = `${header}.${payload}`

  let signer
  try {
    signer = createSign('sha256')
  } catch (cause) {
    invalidCredential(
      'apple',
      'privateKey',
      'Apple client secret signing could not be initialised.',
      cause,
    )
  }
  signer.update(signingInput)
  signer.end()

  let signature: Buffer
  try {
    signature = signer.sign(credentials.privateKey)
  } catch (cause) {
    invalidCredential(
      'apple',
      'privateKey',
      'Apple private key could not be used for signing. Check the .p8 file contents.',
      cause,
    )
  }

  return `${signingInput}.${base64Url(derSignatureToJose(signature))}`
}

export const appleProvider: AuthProviderDefinition<AppleProviderCredentials> = {
  id: 'apple',
  name: 'Apple',
  scopes: ['name', 'email'],

  validateCredentials(credentials) {
    assertNonEmpty('apple', 'clientId', credentials.clientId)
    assertNonEmpty('apple', 'teamId', credentials.teamId)
    assertNonEmpty('apple', 'keyId', credentials.keyId)
    assertNonEmpty('apple', 'privateKey', credentials.privateKey)

    if (credentials.teamId.length !== 10) {
      invalidCredential('apple', 'teamId', 'Apple Team ID must be exactly 10 characters.')
    }
    if (!credentials.privateKey.includes('BEGIN PRIVATE KEY')) {
      invalidCredential(
        'apple',
        'privateKey',
        'Expected a PKCS#8 PEM-encoded private key (the raw .p8 file contents).',
      )
    }
  },

  toBetterAuthConfig(credentials) {
    this.validateCredentials(credentials)

    return {
      clientId: credentials.clientId,
      // better-auth's apple provider requires a static string it embeds in
      // the token request; we mint a fresh short-lived JWT per boot.
      clientSecret: generateAppleClientSecret(credentials),
      // Native app flows (Sign in with Apple SDK on iOS/macOS) present a
      // different `aud` in the id_token — better-auth needs the bundle id
      // to accept those tokens alongside the web Services ID.
      appBundleIdentifier: credentials.appBundleIdentifier,
      redirectURI: credentials.redirectUri,
      scope: ['name', 'email'],
      // Apple-specific: only sends the user's name on the FIRST authorization.
      // Consumers must persist it from the initial callback — better-auth
      // does this automatically via the `account`/`user` tables.
      mapProfileToUser: (profile: {
        email?: string
        name?: { firstName?: string; lastName?: string }
      }) => ({
        email: profile.email,
        name: profile.name
          ? [profile.name.firstName, profile.name.lastName].filter(Boolean).join(' ')
          : undefined,
      }),
    }
  },
}
