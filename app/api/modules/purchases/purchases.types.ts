/**
 * @module purchases.types
 *
 * TypeScript interfaces for the purchases feature module.
 */

export interface PurchaseOptionView {
  id: string
  courseId: string | null
  bundleId: string | null
  platform: string
  productId: string
  displayName: string
  description: string | null
  durationDays: number
  price: { amount: string; currency: string }
  isActive: boolean
}

export interface PurchaseView {
  id: string
  courseId: string | null
  bundleId: string | null
  purchaseOptionId: string
  status: string
  amount: { amount: string; currency: string }
  completedAt: string | null
  createdAt: string
  enrollments: string[]
}

export interface PurchaseListQuery {
  cursor: string | undefined
  limit: number | undefined
  type: string | undefined
}

export interface PurchaseInitiateBody {
  courseId?: string
  bundleId?: string
  purchaseOptionId: string
  platform: string
}
