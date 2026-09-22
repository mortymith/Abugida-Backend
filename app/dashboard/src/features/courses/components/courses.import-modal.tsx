import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { autoMapColumns, SAMPLE_IMPORT_CSV } from '../courses.import-rows'
import type { ImportField, ImportMapping } from '../schemas/courses.workflow.schema'
import type { ImportPreview, ImportValidation } from '../courses.types'

const FIELD_LABELS: Array<{ value: ImportField; label: string }> = [
  { value: 'module', label: 'Module' },
  { value: 'lesson_title', label: 'Lesson title *' },
  { value: 'video_url', label: 'Video URL' },
  { value: 'content', label: 'Lesson content' },
  { value: 'duration', label: 'Duration' },
  { value: 'ignore', label: 'Ignored' },
]

/**
 * S-2.13 Bulk Module & Lesson Import — 3 steps: upload (csv/xlsx/md/docx,
 * ≤20MB) with auto-mapping, mapping override, validation preview with
 * skipped rows, then a run with a 30-minute undo window.
 */
export function BulkImportModal({
  open,
  onOpenChange,
  coursePublicId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  coursePublicId?: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<ImportMapping>({})
  const [validation, setValidation] = useState<ImportValidation | null>(null)
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [showSkipped, setShowSkipped] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null)

  const readFile = async (file: File): Promise<string> => {
    if (file.size > 20 * 1024 * 1024) throw new Error('File exceeds the 20 MB limit')
    const isBinary = /\.(xlsx|xls|docx)$/i.test(file.name)
    if (isBinary) {
      const buffer = await file.arrayBuffer()
      let binary = ''
      const bytes = new Uint8Array(buffer)
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index])
      }
      return btoa(binary)
    }
    return file.text()
  }

  const parse = useMutation({
    mutationFn: async (file: File) => {
      const { parseImportFile } = await import('../server/all')
      const content = await readFile(file)
      return parseImportFile({ data: { fileName: file.name, content } })
    },
    onSuccess: (result, file) => {
      setFileName(file.name)
      setNewCourseTitle(file.name.replace(/\.[^.]+$/, ''))
      setPreview(result)
      setMapping(autoMapColumns(result.columns))
      setStep(2)
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : 'Could not read the file'),
  })

  const validate = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('Upload a file first')
      const { validateImport } = await import('../server/all')
      return validateImport({ data: { fileName, rows: preview.rows, mapping } })
    },
    onSuccess: (result) => {
      setValidation(result)
      setStep(3)
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Validation failed'),
  })

  const run = useMutation({
    mutationFn: async () => {
      if (!preview || !validation) throw new Error('Validate before importing')
      const { runImport } = await import('../server/all')
      return runImport({
        data: {
          fileName,
          coursePublicId,
          newCourseTitle: coursePublicId ? undefined : newCourseTitle,
          rows: preview.rows,
          mapping,
        },
      })
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success(`${result.moduleCount} modules and ${result.lessonCount} lessons created.`)
      setConfirmUndo(result.jobPublicId)
      onOpenChange(false)
      void navigate({ to: '/courses/$courseId', params: { courseId: result.coursePublicId } })
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Import failed'),
  })

  const undo = useMutation({
    mutationFn: async (jobPublicId: string) => {
      const { undoImport } = await import('../server/all')
      return undoImport({ data: { jobPublicId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Import undone.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Undo failed'),
  })

  const closeAndReset = () => {
    onOpenChange(false)
    setStep(1)
    setPreview(null)
    setValidation(null)
    setFileName('')
    setMapping({})
    setShowSkipped(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (!next ? closeAndReset() : undefined)}>
        <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Modules &amp; Lessons</DialogTitle>
            <DialogDescription>
              Step {step} of 3 —{' '}
              {step === 1 ? 'Upload' : step === 2 ? 'Map columns' : 'Validate & preview'}
            </DialogDescription>
          </DialogHeader>

          {step === 1 ? (
            <div
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files[0]
                if (file instanceof File) parse.mutate(file)
              }}
            >
              <p className="text-sm text-muted-foreground">
                Drop <strong>.csv / .xlsx / .md / .docx</strong> here, or click to browse (≤ 20 MB)
              </p>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,.xls,.md,.markdown,.docx"
                className="sr-only"
                aria-label="Import file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file instanceof File) parse.mutate(file)
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={parse.isPending}
              >
                {parse.isPending ? <Spinner className="size-4" /> : null}
                Browse files
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  const blob = new Blob([SAMPLE_IMPORT_CSV], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const anchor = document.createElement('a')
                  anchor.href = url
                  anchor.download = 'abugida-import-template.csv'
                  anchor.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Download sample CSV template
              </Button>
            </div>
          ) : null}

          {step === 2 && preview ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Auto-mapping applied — adjust any column below. {preview.rows.length} rows detected.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="py-1">
                      Source column
                    </th>
                    <th scope="col" className="py-1">
                      Maps to
                    </th>
                    <th scope="col" className="py-1">
                      Sample (row 1)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.columns.map((column) => (
                    <tr key={column} className="border-t">
                      <td className="py-1.5 pr-2 font-medium">{column}</td>
                      <td className="py-1.5 pr-2">
                        <select
                          aria-label={`Mapping for ${column}`}
                          value={mapping[column] ?? 'ignore'}
                          onChange={(event) =>
                            setMapping((previous) => ({
                              ...previous,
                              [column]: event.target.value as ImportField,
                            }))
                          }
                          className="h-8 rounded border bg-input/30 px-2 text-sm"
                        >
                          {FIELD_LABELS.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="max-w-48 truncate py-1.5 text-muted-foreground">
                        {preview.rows[0]?.[preview.columns.indexOf(column)] ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button onClick={() => validate.mutate()} disabled={validate.isPending}>
                  {validate.isPending ? <Spinner className="size-4" /> : null}
                  Validate rows
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 && validation ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm" aria-live="polite">
                {preview?.rows.length} rows → <strong>{validation.moduleCount} modules</strong> ·{' '}
                <strong className="tabular-nums">{validation.lessonCount} lessons</strong> · ⚠️{' '}
                {validation.skipped.length} rows skipped
              </p>
              {validation.warnings.length > 0 ? (
                <ul className="rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
                  {validation.warnings.slice(0, 5).map((warning) => (
                    <li key={`${warning.rowIndex}-${warning.message}`}>
                      Row {warning.rowIndex + 1}: {warning.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {validation.skipped.length > 0 ? (
                <div>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowSkipped((previous) => !previous)}
                  >
                    {showSkipped ? 'Hide' : 'Show'} skipped rows ({validation.skipped.length})
                  </Button>
                  {showSkipped ? (
                    <ul className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs">
                      {validation.skipped.map((skipped) => (
                        <li key={`${skipped.rowIndex}-${skipped.message}`}>
                          Row {skipped.rowIndex + 1}: {skipped.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {!coursePublicId ? (
                <div>
                  <Label htmlFor="import-course-title">New course title</Label>
                  <Input
                    id="import-course-title"
                    value={newCourseTitle}
                    onChange={(event) => setNewCourseTitle(event.target.value)}
                  />
                </div>
              ) : null}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  ← Back to mapping
                </Button>
                <Button
                  onClick={() => run.mutate()}
                  disabled={run.isPending || validation.lessonCount === 0}
                >
                  {run.isPending ? <Spinner className="size-4" /> : null}
                  Import {validation.lessonCount} Lessons
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmUndo != null}
        onOpenChange={(next) => !next && setConfirmUndo(null)}
        title="Undo this import?"
        body="Removes only the modules and lessons created by this import. Available for 30 minutes."
        confirmLabel="Undo import"
        destructive
        onConfirm={() =>
          confirmUndo ? undo.mutateAsync(confirmUndo).then(() => undefined) : undefined
        }
      />
    </>
  )
}
