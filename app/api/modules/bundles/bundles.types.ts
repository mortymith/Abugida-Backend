/**
 * @module bundles.types
 *
 * TypeScript interfaces for the bundles feature module.
 */

export interface BundleView {
  id: string
  examTypeId: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  price: { amount: string; currency: string }
  originalPrice: { amount: string; currency: string }
  discountPercentage: number
  status: string
  courseCount: number
  publishedAt: string | null
  createdAt: string
}

export interface BundleCourseItemView {
  courseId: string
  title: string
  slug: string
  thumbnailUrl: string | null
  individualPrice: { amount: string; currency: string }
  sortOrder: number
}

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

export interface BundleListQuery {
  cursor: string | undefined
  limit: number | undefined
  sort: string | undefined
}

export interface BundleSearchQuery {
  q: string | undefined
  examType: string | undefined
  minPrice: number | undefined
  maxPrice: number | undefined
  sort: string | undefined
  cursor: string | undefined
  limit: number | undefined
}

export interface BundleByExamTypeQuery {
  examTypeId: string
  cursor: string | undefined
  limit: number | undefined
}
