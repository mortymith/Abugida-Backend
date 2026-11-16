/**
 * @module quizzes.types
 *
 * TypeScript interfaces for the quizzes feature module.
 */

export interface QuizQuestionView {
  id: string
  questionIndex: number
  questionText: string
}

export interface QuizQuestionSetView {
  lessonId: string
  totalQuestions: number
  questions: QuizQuestionView[]
}

export interface QuizSubmitAnswer {
  questionId: string
  answer: string
}

export interface QuizSubmitRequestView {
  answers: QuizSubmitAnswer[]
  startedAt: string
}

export interface QuizAnswerResult {
  questionId: string
  isCorrect: boolean
  explanation: string | null
}

export interface QuizAttemptResultView {
  attemptId: string
  attemptNumber: number
  totalQuestions: number
  correctAnswers: number
  scorePercentage: number
  isPassed: boolean
  durationSeconds: number | null
  answers: QuizAnswerResult[]
}

export interface QuizAttemptDetailView {
  id: string
  lessonId: string
  attemptNumber: number
  totalQuestions: number
  correctAnswers: number
  scorePercentage: number
  isPassed: boolean
  durationSeconds: number | null
  startedAt: string
  completedAt: string | null
  answers: {
    questionId: string
    questionText: string
    studentAnswer: string | null
    isCorrect: boolean
    correctAnswer: string
    explanation: string | null
  }[]
}

export interface QuizAttemptsQuery {
  cursor: string | undefined
  limit: number | undefined
}
