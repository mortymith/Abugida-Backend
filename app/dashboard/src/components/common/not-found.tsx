import { Link } from '@tanstack/react-router'

import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="text-muted-foreground size-16 rounded-full bg-muted flex items-center justify-center">
        <span className="text-2xl font-bold">?</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">404</h1>
        <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      </div>
      <Link to="/" className={cn(buttonVariants({ variant: 'default' }))}>
        Go back home
      </Link>
    </div>
  )
}

export { NotFound }
