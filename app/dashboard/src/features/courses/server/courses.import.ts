import { createServerFn } from '@tanstack/react-start'
import {
  parseImportFileSchema,
  runImportSchema,
  undoImportSchema,
  validateImportSchema,
} from '../schemas/courses.workflow.schema'
import type { ImportPreview, ImportRunResult, ImportValidation } from '../courses.types'

/**
 * S-2.13 step 1: parse the uploaded file into a column/row table the client
 * can map. Text formats (csv/md) travel as UTF-8; binary (xlsx/docx) as
 * base64. Hard cap 20 MB per spec.
 */
export const parseImportFile = createServerFn({ method: 'POST' })
  .validator((input: unknown) => parseImportFileSchema.parse(input))
  .handler(async ({ data }): Promise<ImportPreview> => {
    const { parseImportFileImpl } = await import('./courses.import.impl.server')
    return parseImportFileImpl(data)
  })

/** S-2.13 step 2/3: validate mapped rows; returns counts + skipped rows. */
export const validateImport = createServerFn({ method: 'POST' })
  .validator((input: unknown) => validateImportSchema.parse(input))
  .handler(async ({ data }): Promise<ImportValidation> => {
    const { validateImportImpl } = await import('./courses.import.impl.server')
    return validateImportImpl(data)
  })

/** Run the import: creates modules/lessons (tagged `source:import`) + undo window. */
export const runImport = createServerFn({ method: 'POST' })
  .validator((input: unknown) => runImportSchema.parse(input))
  .handler(async ({ data }): Promise<ImportRunResult> => {
    const { runImportImpl } = await import('./courses.import.impl.server')
    return runImportImpl(data)
  })

/** Undo an import inside its 30-minute window (S-7.1 confirmed client-side). */
export const undoImport = createServerFn({ method: 'POST' })
  .validator((input: unknown) => undoImportSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { undoImportImpl } = await import('./courses.import.impl.server')
    return undoImportImpl(data.jobPublicId)
  })
