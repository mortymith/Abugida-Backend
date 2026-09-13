import { cn } from '#/lib/utils'

function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground shadow-sm">
        A
      </div>
      <span className="font-heading text-xl font-bold tracking-tight">Abugida Academy</span>
    </div>
  )
}

export { Logo }
