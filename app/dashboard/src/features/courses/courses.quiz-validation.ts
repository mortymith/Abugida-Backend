/**
 * Quiz save-time rules (spec 04 S-2.8): "Every question needs a correct
 * answer marked" blocks save. Pure + client-safe; server re-checks.
 */

export interface QuizQuestionLike {
  questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  questionText: string
  options: Array<{ optionText: string; isCorrect: boolean }>
  correctAnswer?: string
}

export interface QuizRuleViolation {
  questionIndex: number
  message: string
}

export function validateQuizQuestions(questions: QuizQuestionLike[]): QuizRuleViolation[] {
  const violations: QuizRuleViolation[] = []
  questions.forEach((question, questionIndex) => {
    const label = `Q${questionIndex + 1}`
    if (question.questionType === 'short_answer') {
      if (!question.correctAnswer || question.correctAnswer.trim() === '') {
        violations.push({ questionIndex, message: `${label}: provide the expected answer` })
      }
      return
    }
    const correctCount = question.options.filter((option) => option.isCorrect).length
    if (correctCount !== 1) {
      violations.push({
        questionIndex,
        message:
          correctCount === 0
            ? `${label}: mark one correct answer`
            : `${label}: only one answer can be correct`,
      })
    }
    if (question.questionType === 'true_false' && question.options.length !== 2) {
      violations.push({ questionIndex, message: `${label}: True/False needs two options` })
    }
  })
  return violations
}

/** True/False option pair as stored (True first). */
export function trueFalseOptions(): Array<{ optionText: string; isCorrect: boolean }> {
  return [
    { optionText: 'True', isCorrect: true },
    { optionText: 'False', isCorrect: false },
  ]
}

export function emptyQuestion(
  questionType: QuizQuestionLike['questionType'] = 'multiple_choice',
): QuizQuestionLike & { points: number } {
  return {
    questionType,
    questionText: '',
    points: 10,
    options:
      questionType === 'true_false'
        ? trueFalseOptions()
        : [
            { optionText: '', isCorrect: true },
            { optionText: '', isCorrect: false },
          ],
  }
}
