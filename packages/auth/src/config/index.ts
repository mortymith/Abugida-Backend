/**
 * @module config
 *
 * Runtime validation for AuthConfig using zod, so misconfiguration is caught
 * at startup with a clear message instead of surfacing as an opaque failure
 * mid-OAuth-flow in production.
 */

import { z } from "zod";
import type { AuthConfig, AuthConfigError, AuthDatabaseSchema } from "../core/types";
import { noopLogger, redact, type Logger } from "../core/logger";

const sessionSchema = z
  .object({
    expiresInSeconds: z
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30),
    updateAgeSeconds: z
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24),
    cookie: z
      .object({
        name: z.string().min(1).optional(),
        domain: z.string().min(1).optional(),
        secure: z.boolean().optional(),
        sameSite: z.enum(["lax", "strict", "none"]).optional(),
      })
      .optional(),
  })
  .optional();

const corsSchema = z
  .object({
    origins: z.array(z.string().url()).min(1),
    credentials: z.boolean().optional(),
  })
  .optional();

const rateLimitSchema = z
  .object({
    max: z.number().int().positive(),
    windowSeconds: z.number().int().positive(),
  })
  .optional();

const appleCredentialsSchema = z
  .object({
    clientId: z.string().min(1),
    teamId: z.string().length(10),
    keyId: z.string().min(1),
    privateKey: z.string().min(1),
    redirectUri: z.string().url().optional(),
    clientSecretTtlSeconds: z.number().int().positive().max(15_777_000).optional(),
    appBundleIdentifier: z.string().min(1).optional(),
  })
  .optional();

const googleCredentialsSchema = z
  .object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.string().url().optional(),
    additionalClientIds: z.array(z.string().min(1)).optional(),
    accessType: z.enum(["online", "offline"]).optional(),
    prompt: z.enum(["none", "consent", "select_account"]).optional(),
  })
  .optional();

const baseConfigSchema = z.object({
  environment: z.enum(["development", "test", "production"]),
  baseUrl: z.string().url(),
  secret: z.string().min(32, "secret must be at least 32 characters — generate one with `openssl rand -hex 32`."),
  session: sessionSchema,
  cors: corsSchema,
  rateLimit: rateLimitSchema,
  providers: z.object({
    apple: appleCredentialsSchema,
    google: googleCredentialsSchema,
  }),
});

/**
 * Validates the parts of AuthConfig that are plain data (everything except
 * `database`, `betterAuthOverrides`, and `providers.custom`, which carry
 * live objects/functions zod can't usefully schema-check). Throws an
 * AuthConfigError on the first failure.
 */
export function validateAuthConfig<TSchema extends AuthDatabaseSchema>(
  config: AuthConfig<TSchema>,
  logger: Logger = config.logger ?? noopLogger
): void {
  const fail = (error: AuthConfigError): never => {
    logger.error("Auth config validation failed", redact({ field: error.field, message: error.message }));
    throw error;
  };

  const result = baseConfigSchema.safeParse(config);

  if (!result.success) {
    const first = result.error.issues[0];
    fail({
      kind: "config_invalid",
      field: first?.path.join(".") ?? "unknown",
      message: first?.message ?? "Invalid auth configuration.",
      cause: result.error,
    });
  }

  if (!config.providers.apple && !config.providers.google && !config.providers.custom) {
    fail({
      kind: "config_invalid",
      field: "providers",
      message: "At least one provider (apple, google, or a custom provider) must be configured.",
    });
  }

  if (!config.database?.db || !config.database?.schema) {
    fail({
      kind: "config_invalid",
      field: "database",
      message: "A `db` instance and `schema` (user/session/account/verification tables) are required.",
    });
  }

  if (config.environment === "production" && config.session?.cookie?.secure === false) {
    fail({
      kind: "config_invalid",
      field: "session.cookie.secure",
      message: "Cookies must be Secure in production.",
    });
  }

  logger.debug("Auth config validated", { environment: config.environment });
}

/** Applies documented defaults for fields the caller left unset. */
export function withDefaults<TSchema extends AuthDatabaseSchema>(config: AuthConfig<TSchema>): AuthConfig<TSchema> {
  return {
    ...config,
    session: {
      expiresInSeconds: 60 * 60 * 24 * 30,
      updateAgeSeconds: 60 * 60 * 24,
      cookie: {
        name: "abugida.session",
        secure: config.environment === "production",
        sameSite: "lax",
        ...config.session?.cookie,
      },
      ...config.session,
    },
    rateLimit: config.rateLimit ?? { max: 20, windowSeconds: 60 },
  };
}
