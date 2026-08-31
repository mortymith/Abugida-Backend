/**
 * Environment-driven configuration for @abugida/observability.
 *
 * Every value is read from the process environment so that no
 * credentials, hostnames, or deployment-specific details are
 * hard-coded into the package.
 */

export interface ObservabilityConfig {
  serviceName: string
  serviceVersion: string
  environment: string
  otlpEndpoint: string
  otlpProtocol: 'grpc' | 'http/protobuf'
  tracesExporter: string
  metricsExporter: string
  tracesSampler: string
  tracesSamplerArg: number
}

export interface ObservabilityInitOptions {
  serviceName: string
  serviceVersion: string
  environment: string
}

/**
 * Read configuration from environment variables with sensible defaults
 * for local development.
 */
export function resolveConfig(init: ObservabilityInitOptions): ObservabilityConfig {
  return {
    serviceName: process.env.OTEL_SERVICE_NAME ?? init.serviceName,
    serviceVersion: process.env.OTEL_SERVICE_VERSION ?? init.serviceVersion,
    environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? init.environment,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    otlpProtocol:
      (process.env.OTEL_EXPORTER_OTLP_PROTOCOL as 'grpc' | 'http/protobuf') ?? 'http/protobuf',
    tracesExporter: process.env.OTEL_TRACES_EXPORTER ?? 'otlp',
    metricsExporter: process.env.OTEL_METRICS_EXPORTER ?? 'otlp',
    tracesSampler: process.env.OTEL_TRACES_SAMPLER ?? 'parentbased_always_on',
    tracesSamplerArg: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG ?? '1'),
  }
}
