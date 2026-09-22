// Root Knip configuration is a thin consumer of the shared tooling layer.
// Workspace entries and ignore policy live in tooling/knip-config.
// KNIP_DISABLE_RAW_TRANSFER avoids oxc-parser's large raw-transfer buffer,
// which fails to allocate in memory-constrained environments (CI containers).
export { default } from '@abugida/knip-config'
