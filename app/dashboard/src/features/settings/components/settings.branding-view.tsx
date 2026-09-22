import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Textarea } from '#/components/ui/textarea'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { brandingQueryOptions } from '../hooks/settings.queries'
import { useResetBranding, useSaveBranding } from '../hooks/settings.mutations'
import { getBrandingUploadUrl } from '../server/all'
import { toast } from 'sonner'

/**
 * S-6.4 Branding — logo/favicon upload, brand colors, custom CSS, live
 * preview, and reset (admin only). Uploads go through presigned URLs;
 * colors/CSS preview live client-side before saving.
 */

const DEFAULT_BRANDING = {
  primary: '#8b5cf6',
  secondary: '#6d28d9',
  background: '#f8fafc',
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value)
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 rounded border"
        />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="max-w-32 font-mono"
          aria-invalid={value !== '' && !valid}
        />
      </div>
    </div>
  )
}

export function BrandingView() {
  const query = useQuery(brandingQueryOptions())
  const save = useSaveBranding()
  const reset = useResetBranding()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  const [companyName, setCompanyName] = useState('')
  const [logoKey, setLogoKey] = useState<string | null>(null)
  const [faviconKey, setFaviconKey] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('')
  const [secondaryColor, setSecondaryColor] = useState('')
  const [backgroundColor, setBackgroundColor] = useState('')
  const [customCss, setCustomCss] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)

  useEffect(() => {
    const branding = query.data
    if (branding && !loaded) {
      setCompanyName(branding.companyName ?? '')
      setLogoKey(branding.logoObjectKey)
      setFaviconKey(branding.faviconObjectKey)
      setPrimaryColor(branding.primaryColor ?? '')
      setSecondaryColor(branding.secondaryColor ?? '')
      setBackgroundColor(branding.backgroundColor ?? '')
      setCustomCss(branding.customCss ?? '')
      setLoaded(true)
    }
  }, [query.data, loaded])

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const branding = query.data
  const logoUrl = branding.logoUrl
  const faviconUrl = branding.faviconUrl

  async function upload(kind: 'logo' | 'favicon', file: File) {
    setUploading(kind)
    try {
      const { objectKey, uploadUrl } = await getBrandingUploadUrl({
        data: { kind, fileName: file.name, contentType: file.type },
      })
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!response.ok) throw new Error(`Upload failed (HTTP ${response.status})`)
      if (kind === 'logo') setLogoKey(objectKey)
      else setFaviconKey(objectKey)
      toast.success(`${kind === 'logo' ? 'Logo' : 'Favicon'} uploaded — Save Branding to apply.`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Upload failed. Retry?')
    } finally {
      setUploading(null)
    }
  }

  const dirty =
    companyName !== (branding.companyName ?? '') ||
    logoKey !== (branding.logoObjectKey ?? null) ||
    faviconKey !== (branding.faviconObjectKey ?? null) ||
    primaryColor !== (branding.primaryColor ?? '') ||
    secondaryColor !== (branding.secondaryColor ?? '') ||
    backgroundColor !== (branding.backgroundColor ?? '') ||
    customCss !== (branding.customCss ?? '')

  const previewPrimary = /^#[0-9a-fA-F]{6}$/.test(primaryColor)
    ? primaryColor
    : DEFAULT_BRANDING.primary
  const previewSecondary = /^#[0-9a-fA-F]{6}$/.test(secondaryColor)
    ? secondaryColor
    : DEFAULT_BRANDING.secondary
  const previewBackground = /^#[0-9a-fA-F]{6}$/.test(backgroundColor)
    ? backgroundColor
    : DEFAULT_BRANDING.background

  const invalidColor =
    (primaryColor !== '' && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) ||
    (secondaryColor !== '' && !/^#[0-9a-fA-F]{6}$/.test(secondaryColor)) ||
    (backgroundColor !== '' && !/^#[0-9a-fA-F]{6}$/.test(backgroundColor))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-muted-foreground text-sm">
          Configure platform branding: logo, colors, favicon, and custom CSS.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Logo & Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-md border"
                style={{ backgroundColor: previewBackground }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Current logo"
                    className="max-h-16 max-w-36 object-contain"
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">160×40</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void upload('logo', file)
                    event.target.value = ''
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading != null}
                >
                  {uploading === 'logo' ? 'Uploading…' : 'Upload New Logo'}
                </Button>
                <p className="text-muted-foreground text-xs">PNG, JPEG, WebP, or SVG.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded border">
                {faviconUrl ? (
                  <img src={faviconUrl} alt="Current favicon" className="size-6 object-contain" />
                ) : (
                  <span className="text-muted-foreground text-[10px]">32²</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/x-icon,image/svg+xml"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void upload('favicon', file)
                    event.target.value = ''
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={uploading != null}
                >
                  {uploading === 'favicon' ? 'Uploading…' : 'Upload Favicon'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Abugida Academy"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colors & Custom CSS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField
                id="primary-color"
                label="Primary Color"
                value={primaryColor}
                onChange={setPrimaryColor}
              />
              <ColorField
                id="secondary-color"
                label="Secondary Color"
                value={secondaryColor}
                onChange={setSecondaryColor}
              />
              <ColorField
                id="background-color"
                label="Background Color"
                value={backgroundColor}
                onChange={setBackgroundColor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-css">Custom CSS</Label>
              <Textarea
                id="custom-css"
                rows={5}
                value={customCss}
                onChange={(event) => setCustomCss(event.target.value)}
                placeholder="/* Advanced styling overrides */"
                className="font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                Applied after the design system, as advanced override.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Live Preview</h3>
              <div className="rounded-lg border p-4" style={{ backgroundColor: previewBackground }}>
                <div
                  className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                  style={{ backgroundColor: previewPrimary }}
                >
                  Primary button
                </div>
                <div
                  className="mt-2 inline-block rounded-md px-3 py-1.5 text-sm font-medium text-white"
                  style={{ backgroundColor: previewSecondary }}
                >
                  Secondary
                </div>
              </div>
              <style>{customCss}</style>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button
          onClick={() =>
            save.mutate({
              companyName: companyName.trim() || 'Abugida Academy',
              logoObjectKey: logoKey,
              faviconObjectKey: faviconKey,
              primaryColor: primaryColor || null,
              secondaryColor: secondaryColor || null,
              backgroundColor: backgroundColor || null,
              customCss: customCss || null,
            })
          }
          disabled={!dirty || save.isPending || invalidColor || companyName.trim() === ''}
        >
          {save.isPending ? 'Saving…' : 'Save Branding'}
        </Button>
        <Button variant="ghost" onClick={() => setResetOpen(true)}>
          Reset to Default
        </Button>
        {invalidColor ? (
          <p className="text-destructive text-sm" role="alert">
            Colors must be hex values like #8b5cf6.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset branding to default?"
        body="Logo, colors, custom CSS, and company name return to the platform defaults. This cannot be undone."
        confirmLabel="Reset Branding"
        onConfirm={async () => {
          await reset.mutateAsync(undefined)
          setLoaded(false)
        }}
      />
    </div>
  )
}
