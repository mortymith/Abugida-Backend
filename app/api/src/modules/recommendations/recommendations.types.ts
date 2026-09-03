/**
 * @module recommendations.types
 *
 * TypeScript interfaces for the recommendations feature module.
 */

export interface RecommendationView {
  courseId: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  averageRating: string | null
  ratingCount: number
  enrollmentCount: number
  score: string | null
}

export interface RecommendationListQuery {
  limit: number | undefined
}

export interface CourseRatingSummaryView {
  courseId: string
  averageRating: number | null
  ratingCount: number
  distribution: {
    '1': number
    '2': number
    '3': number
    '4': number
    '5': number
  }
}

export interface RatingSubmitInput {
  rating: number
}

export interface ReviewView {
  reviewId: string
  courseId: string
  studentDisplayName: string
  rating: number
  title: string
  content: string
  createdAt: string
}

export interface ReviewSubmitInput {
  rating: number
  title: string
  content: string
}

export interface ReviewListQuery {
  cursor: string | undefined
  limit: number
}
