/**
 * OpenTelemetry Resource construction.
 *
 * Builds a {@link Resource} carrying service identity and deployment
 * attributes that every span and metric will inherit.
 */

import { Resource } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions'

export type ResourceAttributes = Record<string, string | number | boolean>

/**
 * Create the base OpenTelemetry Resource for this service.
 *
 * @param serviceName    – unique identifier for the application (e.g. "api", "course-builder")
 * @param serviceVersion – semantic version of the deploying service
 * @param environment    – deployment environment ("production", "staging", "development", …)
 * @param extra          – additional resource attributes merged on top
 */
export function createResource(
  serviceName: string,
  serviceVersion: string,
  environment: string,
  extra?: ResourceAttributes,
): Resource {
  const baseAttributes: ResourceAttributes = {
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  }

  return new Resource({ ...baseAttributes, ...extra })
}
