/**
 * Server-only implementation of the AI generators (S-2.11 / S-2.16).
 *
 * Provider strategy:
 * - With an LLM key configured (OPENAI_API_KEY / ANTHROPIC_API_KEY /
 *   GEMINI_API_KEY), generation runs through `chat()` from `@tanstack/ai`
 *   (AGENTS.md §19) with strict JSON output.
 * - Otherwise the deterministic local synthesizer (courses.ai-local) builds
 *   the draft so the workflow — generate → review → edit → explicit accept —
 *   works without external credentials.
 *
 * Both paths persist an `ai_generation_jobs` row; drafts are never applied
 * silently (spec contract: explicit human acceptance).
 */
import { aiGenerationJobs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { env } from '#/config/app.config'
import { requireAuthoringRole, resolveLesson } from './courses.server-helpers.server'
import { localOutline, localQuiz, stripMarkdown } from '../courses.ai-local'
import type { AiOutlineRequest, AiQuizRequest } from '../schemas/courses.workflow.schema'
import type { AiOutlineModule, AiOutlineResult, AiQuizDraft } from '../courses.types'
import type { AiQuizQuestionLike } from '../courses.ai-local'

type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'local'

function activeProvider(): AiProvider {
  if (env.OPENAI_API_KEY) return 'openai'
  if (env.ANTHROPIC_API_KEY) return 'anthropic'
  if (env.GEMINI_API_KEY) return 'gemini'
  return 'local'
}

export async function generateCourseOutlineImpl(
  request: AiOutlineRequest,
): Promise<AiOutlineResult> {
  const userId = await requireAuthoringRole()
  const provider = activeProvider()

  let draft: { title: string; description: string; modules: AiOutlineModule[] }
  try {
    draft =
      provider === 'local'
        ? localOutline(request)
        : ((await llmJson(buildOutlinePrompt(request))) as {
            title: string
            description: string
            modules: AiOutlineModule[]
          })
  } catch {
    // Partial-failure contract: the author always gets a draft.
    draft = localOutline(request)
  }
  if (!Array.isArray(draft.modules) || draft.modules.length === 0) {
    draft = localOutline(request)
  }

  const jobPublicId = await persistJob({
    kind: 'course_outline',
    prompt: request.prompt,
    params: { ...request },
    result: draft,
    provider,
    userId,
  })

  return { jobPublicId, provider, ...draft }
}

export async function regenerateOutlineModuleImpl(input: {
  request: AiOutlineRequest
  moduleTitle?: string
}): Promise<AiOutlineResult> {
  const base = await generateCourseOutlineImpl(input.request)
  if (input.moduleTitle && base.modules.length > 0) {
    const index = Math.min(1, base.modules.length - 1)
    base.modules[index] = { ...base.modules[index], title: input.moduleTitle }
  }
  return base
}

export async function expandOutlineModuleImpl(input: {
  moduleTitle: string
  moduleDescription?: string
  count: number
  request: AiOutlineRequest
}): Promise<AiOutlineResult> {
  const userId = await requireAuthoringRole()
  const provider = activeProvider()

  const base = localOutline(input.request)
  const theme = input.moduleTitle.split(':').at(-1)?.trim() ?? input.moduleTitle
  const targetModule =
    base.modules.find((module) => module.title.endsWith(theme)) ?? base.modules[0]
  const expanded: AiOutlineModule = {
    title: input.moduleTitle,
    description: input.moduleDescription ?? targetModule.description,
    lessons: [
      ...targetModule.lessons,
      ...localOutline({
        ...input.request,
        prompt: `${input.moduleTitle}. ${input.request.prompt}`,
        moduleCount: 1,
        lessonsPerModule: input.count,
      }).modules[0].lessons,
    ],
  }

  const jobPublicId = await persistJob({
    kind: 'course_outline',
    prompt: `expand:${input.moduleTitle}`,
    params: { ...input.request, count: input.count },
    result: expanded,
    provider,
    userId,
  })

  return {
    jobPublicId,
    provider,
    title: base.title,
    description: base.description,
    modules: [expanded],
  }
}

export async function generateQuizDraftImpl(request: AiQuizRequest): Promise<AiQuizDraft> {
  const userId = await requireAuthoringRole()
  const provider = activeProvider()
  const lesson = await resolveLesson(request.lessonPublicId)
  const body = stripMarkdown(lesson.body ?? '')
  if (body.split(/\s+/).filter(Boolean).length < 200) {
    throw new Error('CONTENT_TOO_SHORT: this lesson needs at least 200 words of content')
  }

  let questions: AiQuizQuestionLike[]
  try {
    questions =
      provider === 'local'
        ? localQuiz(body, request)
        : ((await llmJson(buildQuizPrompt(body, request))) as AiQuizQuestionLike[])
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('CONTENT_TOO_SHORT')) throw error
    questions = localQuiz(body, request)
  }

  const jobPublicId = await persistJob({
    kind: 'quiz_draft',
    prompt: `quiz:${lesson.title}`,
    params: { ...request },
    result: questions,
    provider,
    userId,
  })

  return { jobPublicId, provider, questions }
}

export async function regenerateQuizQuestionImpl(
  request: AiQuizRequest & { excludePrompts: string[] },
): Promise<AiQuizDraft> {
  const userId = await requireAuthoringRole()
  const provider = activeProvider()
  const lesson = await resolveLesson(request.lessonPublicId)
  const body = stripMarkdown(lesson.body ?? '')
  const questions = localQuiz(body, request, request.excludePrompts)

  const jobPublicId = await persistJob({
    kind: 'quiz_draft',
    prompt: `quiz-regen:${lesson.title}`,
    params: { ...request },
    result: questions,
    provider,
    userId,
  })

  return { jobPublicId, provider, questions }
}

async function persistJob(input: {
  kind: 'course_outline' | 'quiz_draft'
  prompt: string
  params: Record<string, unknown>
  result: unknown
  provider: string
  userId: string
}): Promise<string> {
  const inserted = await db
    .insert(aiGenerationJobs)
    .values({
      kind: input.kind,
      status: 'completed',
      prompt: input.prompt.slice(0, 2000),
      params: input.params,
      result: input.result,
      provider: input.provider,
      createdBy: input.userId,
    })
    .returning({ publicId: aiGenerationJobs.publicId })
  const publicId = inserted.at(0)?.publicId
  if (!publicId) throw new Error('AI_JOB_PERSIST_FAILED')
  return publicId
}

/* ── LLM path (only when a key is configured) ─────────────────────────── */

async function llmJson(prompt: string): Promise<unknown> {
  const provider = activeProvider()
  const { chat } = await import('@tanstack/ai')
  let adapter: unknown
  if (provider === 'openai') {
    const mod = await import('@tanstack/ai-openai')
    adapter = mod.openaiText((env.AI_MODEL || 'gpt-4o-mini') as never)
  } else if (provider === 'anthropic') {
    const mod = await import('@tanstack/ai-anthropic')
    adapter = mod.anthropicText((env.AI_MODEL || 'claude-3-5-haiku-latest') as never)
  } else if (provider === 'gemini') {
    const mod = await import('@tanstack/ai-gemini')
    adapter = mod.geminiText((env.AI_MODEL || 'gemini-1.5-flash') as never)
  } else {
    throw new Error('NO_PROVIDER')
  }

  const result = await (
    chat as unknown as (options: {
      adapter: unknown
      system?: string[]
      messages: Array<{ role: 'user'; content: string }>
      stream?: false
    }) => Promise<{ text?: string }>
  )({
    adapter,
    system: [
      'You draft educational course outlines and quizzes for human review.',
      'Reply with strict JSON only — no prose, no markdown fences.',
    ],
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  })

  const text = result.text ?? ''
  const start = Math.min(
    ...['{', '['].map((token) => {
      const index = text.indexOf(token)
      return index < 0 ? Number.POSITIVE_INFINITY : index
    }),
  )
  if (!Number.isFinite(start)) throw new Error('LLM_MALFORMED')
  return JSON.parse(
    text
      .slice(start)
      .replace(/```json|```/g, '')
      .trim(),
  )
}

function buildOutlinePrompt(request: AiOutlineRequest): string {
  return `Create a course outline as JSON: {"title": string, "description": string, "modules": [{"title": string, "description": string, "lessons": [{"title": string, "format": "video"|"reading"|"quiz"|"exercise", "durationMinutes": number, "needsContent": true${request.includeQuizSeeds ? ', "quizSeed": {"questionText": string, "correctAnswer": string, "options": string[]}' : ''}}]}]}.
Course request: ${request.prompt}
Audience: ${request.audience}; Level: ${request.level}; Language: ${request.language}.
Exactly ${request.moduleCount} modules, ${request.lessonsPerModule} lessons per module.`
}

function buildQuizPrompt(body: string, request: AiQuizRequest): string {
  return `Create ${request.questionCount} quiz questions from the lesson text as JSON: [{"questionType": "multiple_choice"|"true_false"|"short_answer", "questionText": string, "options": [{"optionText": string, "isCorrect": boolean}], "correctAnswer": string, "explanation": string, "points": number}].
Allowed types: ${request.types.join(', ')}; difficulty: ${request.difficulty}. Multiple choice must have exactly one correct option.
Lesson text: ${body.slice(0, 6000)}`
}
