/**
 * @module providers/base
 *
 * Shared helpers for building AuthProviderDefinition implementations, plus a
 * tiny registry consumers can use to add custom providers alongside the
 * built-in Apple/Google ones.
 */

import type { AuthProviderDefinition, BaseProviderCredentials, AuthConfigError } from "../core/types";

/** Throws a structured AuthConfigError-shaped error for provider validation failures. */
export function invalidCredential(providerId: string, field: string, message: string, cause?: unknown): never {
  const error: AuthConfigError = {
    kind: "config_invalid",
    field: `providers.${providerId}.${field}`,
    message,
    cause,
  };
  throw error;
}

export function assertNonEmpty(providerId: string, field: string, value: string | undefined): asserts value is string {
  if (!value || value.trim().length === 0) {
    invalidCredential(providerId, field, `"${field}" is required for the ${providerId} provider.`);
  }
}

/**
 * Registry of providers keyed by id. Built-in providers (apple, google) are
 * registered by `createAuth()`; consumers can add their own via
 * `config.providers.custom` without forking this package.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, AuthProviderDefinition>();

  register<T extends BaseProviderCredentials>(definition: AuthProviderDefinition<T>): void {
    this.providers.set(definition.id, definition as unknown as AuthProviderDefinition);
  }

  get(id: string): AuthProviderDefinition | undefined {
    return this.providers.get(id);
  }

  list(): AuthProviderDefinition[] {
    return Array.from(this.providers.values());
  }
}
