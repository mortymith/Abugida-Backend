/**
 * Server-only implementation of S-7.6 tour state. Persistence lives on the
 * caller's own `user_profiles` row (`tour_completed_at` — the spec's
 * `onboarding_progress.tour_completed`); there is deliberately no second
 * onboarding model. Never import from client code.
 */
import { eq } from '@abugida/database'
import { userProfiles } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/config/auth.server'

export interface TourState {
  /** True once the tour was completed or skipped (never auto-launch again). */
  tourCompleted: boolean
  completedAt: string | null
}

async function requireUserId(): Promise<string> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')
  return session.value.user.id
}

export async function getTourStateImpl(): Promise<TourState> {
  const userId = await requireUserId()
  const rows = await db
    .select({ tourCompletedAt: userProfiles.tourCompletedAt })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)
  const row = rows.at(0)

  if (!row || row.tourCompletedAt == null) {
    return { tourCompleted: false, completedAt: null }
  }
  return {
    tourCompleted: true,
    completedAt: row.tourCompletedAt.toISOString(),
  }
}

export async function completeTourImpl(): Promise<TourState> {
  const userId = await requireUserId()
  const completedAt = new Date()

  await db
    .insert(userProfiles)
    .values({ userId, tourCompletedAt: completedAt })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { tourCompletedAt: completedAt },
    })

  return { tourCompleted: true, completedAt: completedAt.toISOString() }
}
