import { Tick01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils'

/**
 * S-6.9 Permission Matrix (spec 09 shared component #16): module ×
 * capability toggle grid. `lockWrite` keeps the admin role's matrix
 * non-empty server-side; the UI communicates the lock with a tooltip.
 */
export function PermissionMatrix({
  modules,
  capabilities,
  matrix,
  memberCount,
  lockWrite,
  onChange,
}: {
  modules: string[]
  capabilities: string[]
  matrix: Record<string, string[]>
  memberCount: number
  lockWrite: boolean
  onChange: (moduleName: string, capability: string, checked: boolean) => void
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Module</TableHead>
            <TableHead className="w-20">Members</TableHead>
            {capabilities.map((capability) => (
              <TableHead key={capability} className="capitalize">
                {capability}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map((moduleName) => {
            const caps = matrix[moduleName] ?? []
            const hasAny = caps.length > 0
            return (
              <TableRow key={moduleName}>
                <TableCell className="font-medium">{moduleName}</TableCell>
                <TableCell className="text-muted-foreground text-xs tabular-nums">
                  {memberCount > 0 && hasAny ? memberCount : hasAny ? memberCount : '—'}
                </TableCell>
                {capabilities.map((capability) => {
                  const checked = caps.includes(capability)
                  const disableUncheck = lockWrite && checked && caps.length === 1
                  return (
                    <TableCell key={capability}>
                      {checked ? (
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked
                            disabled={disableUncheck}
                            onChange={(event) =>
                              onChange(moduleName, capability, event.target.checked)
                            }
                            aria-label={`${capability} ${moduleName}`}
                            className="accent-primary size-4"
                          />
                          <HugeiconsIcon
                            icon={Tick01Icon}
                            strokeWidth={2.5}
                            className="text-primary size-3.5"
                            aria-hidden="true"
                          />
                        </label>
                      ) : (
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={(event) =>
                              onChange(moduleName, capability, event.target.checked)
                            }
                            aria-label={`${capability} ${moduleName}`}
                            className="accent-primary size-4"
                          />
                          <span className="text-muted-foreground text-xs" aria-hidden="true">
                            —
                          </span>
                        </label>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className={cn('text-muted-foreground mt-2 text-xs', lockWrite && 'after:content-[""]')}>
        {lockWrite
          ? 'Admin write access per module is locked to prevent workspace lockout.'
          : 'View = read-only. Any write capability grants management of the module.'}
      </p>
    </div>
  )
}
