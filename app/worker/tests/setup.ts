/**
 * Test preload for the worker app.
 *
 * The worker composes its logging from `@abugida/observability`, whose
 * logger throws until `initObservability()` has run. The processors log
 * through that logger, so the observability stack has to be initialised
 * before any test executes.
 *
 * The exporters are switched off and the level is set to `fatal`: the tests
 * assert behaviour, not telemetry, and no test may reach the network or
 * flood the output with log lines.
 */

process.env.OTEL_TRACES_EXPORTER ??= 'none'
process.env.OTEL_METRICS_EXPORTER ??= 'none'
process.env.LOG_LEVEL ??= 'fatal'

const { initObservability } = await import('@abugida/observability')

await initObservability({
  serviceName: 'abugida-worker-test',
  serviceVersion: '0.0.0',
  environment: 'test',
})
