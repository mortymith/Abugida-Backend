/**
 * Deterministic local AI synthesizers (S-2.11 / S-2.16 fallback provider).
 * Pure + client-safe so bun tests cover them directly. The LLM path lives in
 * the server impl; drafts are always human-reviewed before acceptance.
 */

export interface AiOutlineRequestLike {
  prompt: string
  audience: string
  level: 'beginner' | 'intermediate' | 'advanced'
  moduleCount: number
  lessonsPerModule: number
  language: string
  includeQuizSeeds: boolean
}

export interface AiOutlineLessonLike {
  title: string
  format: 'video' | 'reading' | 'quiz' | 'exercise'
  durationMinutes: number
  quizSeed?: {
    questionText: string
    correctAnswer: string
    options: string[]
  } | null
  needsContent: boolean
}

export interface AiOutlineModuleLike {
  title: string
  description: string
  lessons: AiOutlineLessonLike[]
}

export interface AiQuizRequestLike {
  questionCount: number
  types: Array<'multiple_choice' | 'true_false' | 'short_answer'>
  difficulty: 'easy' | 'mixed' | 'hard'
}

export interface AiQuizQuestionLike {
  questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  questionText: string
  options: Array<{ optionText: string; isCorrect: boolean }>
  correctAnswer: string | null
  explanation: string | null
  points: number
}

/** Strip HTML/markdown so word counts are honest about visible content. */
export function stripMarkdown(body: string): string {
  return body
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#*_~`>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MODULE_THEMES = [
  'Foundations',
  'Core techniques',
  'Practice and application',
  'Common pitfalls',
  'Advanced strategies',
  'Real-world scenarios',
  'Review and reinforcement',
  'Assessment and next steps',
]

const LESSON_THEMES = [
  'Overview and key concepts',
  'Step-by-step walkthrough',
  'Worked examples',
  'Guided practice',
  'Quick reference and summary',
]

export function localOutline(request: AiOutlineRequestLike): {
  title: string
  description: string
  modules: AiOutlineModuleLike[]
} {
  const topic = extractTopic(request.prompt)
  const title = topic.slice(0, 100)
  const description = buildDescription(topic, request)
  const modules: AiOutlineModuleLike[] = []

  for (let moduleIndex = 0; moduleIndex < request.moduleCount; moduleIndex += 1) {
    const theme = MODULE_THEMES[moduleIndex % MODULE_THEMES.length]
    modules.push({
      title: `${topic}: ${theme}`.slice(0, 300),
      description: `For ${request.audience} (${request.level}). Language: ${request.language}.`,
      lessons: localLessons(theme, request, moduleIndex),
    })
  }
  return { title, description, modules }
}

function localLessons(
  theme: string,
  request: AiOutlineRequestLike,
  moduleIndex: number,
): AiOutlineLessonLike[] {
  const lessons: AiOutlineLessonLike[] = []
  for (let lessonIndex = 0; lessonIndex < request.lessonsPerModule; lessonIndex += 1) {
    const lessonTheme = LESSON_THEMES[(moduleIndex + lessonIndex) % LESSON_THEMES.length]
    const isFinal = lessonIndex === request.lessonsPerModule - 1
    lessons.push({
      title: `${lessonTheme}: ${theme}`.slice(0, 300),
      format: isFinal && request.includeQuizSeeds ? 'quiz' : 'video',
      durationMinutes: 15 + ((moduleIndex * 3 + lessonIndex * 7) % 4) * 5,
      quizSeed: request.includeQuizSeeds
        ? {
            questionText: `Which statement best describes "${theme}"?`,
            correctAnswer: `${theme} builds directly on the lesson content.`,
            options: [
              `${theme} builds directly on the lesson content.`,
              `${theme} is unrelated to this course.`,
              `${theme} only applies to advanced learners.`,
              `${theme} has no practical use.`,
            ],
          }
        : null,
      needsContent: true,
    })
  }
  return lessons
}

function buildDescription(topic: string, request: AiOutlineRequestLike): string {
  return (
    `${topic} — a ${request.moduleCount}-module ${request.level} course for ${request.audience}` +
    ` (~${request.moduleCount * request.lessonsPerModule} lessons, in ${request.language}).` +
    (request.includeQuizSeeds ? ' Includes quiz seeds for each module.' : '')
  ).slice(0, 500)
}

/** First meaningful sentence, stripped of imperative openers ("Create a..."). */
export function extractTopic(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim()
  const match = /^(.{10,160}?[.!?])\s/.exec(cleaned)
  const sentence = match ? match[1] : cleaned
  return sentence
    .replace(/^(create|build|design|generate|make)\s+(a|an|the)?\s*/i, '')
    .replace(/\s+course.*$/i, '')
    .trim()
}

/**
 * Deterministic quiz synthesis from lesson body sentences. Distractors come
 * from other sentences of the same lesson; every draft is flagged for human
 * review downstream (spec: "AI can make mistakes — verify each answer key").
 */
export function localQuiz(
  body: string,
  request: AiQuizRequestLike,
  excludePrompts: string[] = [],
): AiQuizQuestionLike[] {
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40 && sentence.length < 260)
  if (sentences.length === 0) {
    throw new Error('CONTENT_TOO_SHORT: not enough material in the lesson body')
  }

  const questions: AiQuizQuestionLike[] = []
  let cursor = 0

  for (const type of request.types) {
    for (let index = 0; index < request.questionCount; index += 1) {
      if (questions.length >= request.questionCount) break
      const sentence = sentences[cursor % sentences.length]
      cursor += 1
      if (excludePrompts.some((prompt) => sentence.startsWith(prompt))) continue

      if (type === 'true_false') {
        const negate = index % 2 === 1
        questions.push({
          questionType: 'true_false',
          questionText: (negate
            ? `True or false: it is NOT the case that ${decapitalize(sentence)}`
            : `True or false: ${decapitalize(sentence)}`
          ).slice(0, 500),
          options: [
            { optionText: 'True', isCorrect: !negate },
            { optionText: 'False', isCorrect: negate },
          ],
          correctAnswer: negate ? 'False' : 'True',
          explanation: 'Verify this against the lesson text before publishing.',
          points: 10,
        })
      } else if (type === 'short_answer') {
        questions.push({
          questionType: 'short_answer',
          questionText: `In your own words, summarize: ${sentence.slice(0, 220)}`.slice(0, 500),
          options: [],
          correctAnswer: sentence,
          explanation: null,
          points: 10,
        })
      } else {
        const distractors = sentences.filter((candidate) => candidate !== sentence).slice(0, 3)
        if (distractors.length < 2) continue
        questions.push({
          questionType: 'multiple_choice',
          questionText: 'Which statement appears in the lesson?'.slice(0, 500),
          options: [
            { optionText: sentence.slice(0, 180), isCorrect: true },
            ...distractors.map((candidate) => ({
              optionText: candidate.slice(0, 180),
              isCorrect: false,
            })),
          ],
          correctAnswer: sentence.slice(0, 180),
          explanation: null,
          points: 10,
        })
      }
    }
  }

  if (questions.length === 0) {
    throw new Error('CONTENT_TOO_SHORT: not enough material in the lesson body')
  }
  return questions
}

function decapitalize(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1)
}
