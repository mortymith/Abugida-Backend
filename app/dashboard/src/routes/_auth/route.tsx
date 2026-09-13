import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Logo } from '#/components/common/logo'

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-muted/70 to-transparent" />
        <div
          className="absolute -top-24 -right-24 size-72 rounded-full border border-foreground/[0.06]"
          style={{ animation: 'float 8s ease-in-out infinite' }}
        />
        <div
          className="absolute -bottom-16 -left-16 size-56 rounded-full border border-foreground/[0.05]"
          style={{ animation: 'float 10s ease-in-out infinite 2s' }}
        />
        <div
          className="absolute top-1/3 -left-8 size-32 rounded-full bg-foreground/[0.03]"
          style={{ animation: 'float 12s ease-in-out infinite 4s' }}
        />
        <div
          className="absolute top-1/4 right-1/4 size-20 rounded-full bg-foreground/[0.02]"
          style={{ animation: 'float 9s ease-in-out infinite 1s' }}
        />
      </div>

      <div className="anim-up relative mb-8">
        <Logo />
      </div>

      <div className="anim-up d1 relative w-full max-w-md">
        <Outlet />
      </div>

      <div className="anim-up d2 relative mt-8">
        <p className="text-center text-xs text-muted-foreground">
          No password needed — sign-in is handled by Google and Telegram.
        </p>
      </div>
    </div>
  )
}
