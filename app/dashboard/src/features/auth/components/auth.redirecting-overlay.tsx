import type { Provider } from '#/features/auth/hooks/auth.provider-memory'
import { Spinner } from '#/components/ui/spinner'
import { Logo } from '#/components/common/logo'
import { ProviderIcon } from '#/features/auth/components/auth.provider-button'

interface RedirectingOverlayProps {
  provider: Provider
}

function RedirectingOverlay({ provider }: RedirectingOverlayProps) {
  const providerName = provider === 'google' ? 'Google' : 'Telegram'

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md"
    >
      <div className="anim-up flex flex-col items-center gap-6">
        <Logo />
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
          <div className="relative flex size-14 items-center justify-center rounded-full border bg-card shadow-sm">
            <ProviderIcon provider={provider} className="size-6" />
          </div>
        </div>
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium">
            <Spinner />
            Contacting {providerName}…
          </p>
          <p className="mt-1 text-xs text-muted-foreground">You'll be redirected automatically</p>
        </div>
      </div>
    </div>
  )
}

export { RedirectingOverlay }
