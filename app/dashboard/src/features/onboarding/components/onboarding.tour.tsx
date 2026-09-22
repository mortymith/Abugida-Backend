import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { placeTourCard, spotlightRect } from '../onboarding.geometry'
import type { TourCardPosition, TourRect } from '../onboarding.geometry'
import { useOnboardingTour } from '../hooks/onboarding.use-tour'

const SPOTLIGHT_PADDING = 8
const CARD_WIDTH = 320
const CARD_HEIGHT_ESTIMATE = 180

interface MeasuredStep {
  targetRect: TourRect
  viewport: { width: number; height: number }
  position: TourCardPosition
}

function measureStep(target: string): MeasuredStep | null {
  if (typeof document === 'undefined') return null
  const element = document.querySelector(`[data-tour-target="${target}"]`)
  if (!(element instanceof HTMLElement)) return null
  const box = element.getBoundingClientRect()
  const targetRect: TourRect = {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
  }
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const position = placeTourCard(targetRect, viewport, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT_ESTIMATE,
  })
  return { targetRect, viewport, position }
}

/**
 * S-7.6 Onboarding Tour (spec 09): a dismissible spotlight tour over the
 * core sidebar entries with step counter, progress dots, and Skip/Next
 * controls. Keyboard: →/Enter next, ← back, Esc skip. The spotlight dims
 * the page with a CSS box-shadow hole around the target element; no overlay
 * library is added.
 */
export function OnboardingTour() {
  const tour = useOnboardingTour()
  const cardRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<MeasuredStep | null>(null)
  const step = tour.step

  const remeasure = useCallback(() => {
    if (!tour.open) return
    // Double rAF: let the layout settle (scroll, fonts) before measuring.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMeasured(measureStep(step.target))
      })
    })
  }, [tour.open, step])

  useEffect(() => {
    if (!tour.open) return
    const element = document.querySelector(`[data-tour-target="${step.target}"]`)
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    remeasure()
    cardRef.current?.focus()
  }, [tour.open, step, remeasure])

  useEffect(() => {
    if (!tour.open) return
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [tour.open, remeasure])

  useEffect(() => {
    if (!tour.open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        tour.skip()
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        tour.goNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        tour.goBack()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [tour])

  if (!tour.open || measured == null) return null

  const spot = spotlightRect(measured.targetRect, SPOTLIGHT_PADDING, measured.viewport)
  const isLast = tour.stepIndex === tour.totalSteps - 1

  return (
    <div className="pointer-events-none fixed inset-0 z-[400]">
      {/* Spotlight hole: transparent box, page dimmed by the huge shadow. */}
      <div
        className="absolute rounded-lg transition-all duration-200"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
        }}
        aria-hidden="true"
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Tour step ${tour.stepIndex + 1} of ${tour.totalSteps}: ${step.title}`}
        tabIndex={-1}
        className="pointer-events-auto absolute w-80 rounded-xl border bg-card p-4 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ top: measured.position.y, left: measured.position.x }}
      >
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {tour.stepIndex + 1} of {tour.totalSteps}
        </p>
        <h2 className="mt-1 text-sm font-semibold">{step.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>

        <div className="mt-3 flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: tour.totalSteps }, (_, index) => (
            <span
              key={index}
              className={
                index === tour.stepIndex
                  ? 'bg-primary h-1.5 w-4 rounded-full'
                  : 'bg-muted-foreground/40 h-1.5 w-1.5 rounded-full'
              }
            />
          ))}
          <span className="sr-only" aria-live="polite">
            Step {tour.stepIndex + 1} of {tour.totalSteps}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={tour.skip}>
            Skip
          </Button>
          {tour.stepIndex > 0 ? (
            <Button variant="outline" size="sm" onClick={tour.goBack}>
              Back
            </Button>
          ) : null}
          <Button size="sm" onClick={tour.goNext}>
            {isLast ? 'Finish' : 'Next →'}
          </Button>
        </div>
      </div>
    </div>
  )
}
