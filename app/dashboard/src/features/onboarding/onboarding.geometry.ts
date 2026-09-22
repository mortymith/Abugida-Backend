/**
 * S-7.6 Onboarding Tour geometry (spec 09).
 *
 * Pure placement math for the spotlight card: pick the side of the target
 * with room, then clamp the card inside the viewport. Kept DOM-free so it
 * is unit-testable; the component measures rects and applies the result.
 */

export interface TourRect {
  top: number
  left: number
  width: number
  height: number
}

export interface TourViewport {
  width: number
  height: number
}

export interface TourCardSize {
  width: number
  height: number
}

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TourCardPosition {
  x: number
  y: number
  placement: TourPlacement
}

export const TOUR_DEFAULT_MARGIN = 16

/**
 * Spotlight padding grows the dimmed "hole" around the target element.
 */
export function spotlightRect(
  target: TourRect,
  padding = 8,
  viewport?: TourViewport,
): TourRect & { clipped: boolean } {
  const top = target.top - padding
  const left = target.left - padding
  const width = target.width + padding * 2
  const height = target.height + padding * 2
  if (!viewport) return { top, left, width, height, clipped: false }
  const clipped =
    top < 0 || left < 0 || left + width > viewport.width || top + height > viewport.height
  return { top: Math.max(0, top), left: Math.max(0, left), width, height, clipped }
}

export function placeTourCard(
  target: TourRect,
  viewport: TourViewport,
  card: TourCardSize,
  margin = TOUR_DEFAULT_MARGIN,
): TourCardPosition {
  const space = {
    top: target.top,
    bottom: viewport.height - (target.top + target.height),
    left: target.left,
    right: viewport.width - (target.left + target.width),
  }

  let placement: TourPlacement
  if (space.bottom >= card.height + margin) placement = 'bottom'
  else if (space.top >= card.height + margin) placement = 'top'
  else if (space.right >= card.width + margin) placement = 'right'
  else if (space.left >= card.width + margin) placement = 'left'
  else placement = space.bottom >= space.top ? 'bottom' : 'top'

  let x: number
  let y: number
  switch (placement) {
    case 'bottom':
      x = target.left + target.width / 2 - card.width / 2
      y = target.top + target.height + margin
      break
    case 'top':
      x = target.left + target.width / 2 - card.width / 2
      y = target.top - card.height - margin
      break
    case 'right':
      x = target.left + target.width + margin
      y = target.top + target.height / 2 - card.height / 2
      break
    case 'left':
      x = target.left - card.width - margin
      y = target.top + target.height / 2 - card.height / 2
      break
  }

  // Clamp inside the viewport so the card never leaves the screen.
  x = Math.min(Math.max(margin, x), Math.max(margin, viewport.width - card.width - margin))
  y = Math.min(Math.max(margin, y), Math.max(margin, viewport.height - card.height - margin))

  return { x, y, placement }
}
