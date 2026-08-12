/**
 * @module processors/lesson
 * @description Processors for lesson completion and quiz grading jobs.
 */

import type {
  AnyProcessorEntry,
  JobProcessor,
  LessonCompletionUpdateJobData,
  QuizGradeJobData,
} from "../core/types.js";
import { JobType } from "../core/types.js";
import { QUEUE_NAMES } from "../definitions/queues.js";

// ---------------------------------------------------------------------------
// Lesson Completion Update Processor
// ---------------------------------------------------------------------------

/**
 * Process lesson completion status update.
 *
 * Expected side effects:
 * - Record lesson completion in the database
 * - Update enrollment progress
 * - Trigger next lesson unlock if applicable
 * - Enqueue `ENROLLMENT_PROGRESS_UPDATE` job
 */
export const processLessonCompletionUpdate: JobProcessor<LessonCompletionUpdateJobData> = async (data, job) => {
  const { enrollmentId, lessonId, completed, idempotencyKey } = data;

  console.debug(`[lesson:completion] Updating lesson=${lessonId} enrollment=${enrollmentId} completed=${completed}`, {
    jobId: job.id,
    idempotencyKey,
  });

  // TODO: Replace with actual database integration:
  // const db = getDatabase();
  //
  // if (completed) {
  //   await db.insert(lessonCompletions).values({
  //     enrollmentId,
  //     lessonId,
  //     completedAt: new Date(),
  //     idempotencyKey,
  //   }).onConflictDoNothing();
  //
  //   // Recalculate enrollment progress
  //   const totalLessons = await db.select(...);
  //   const completedCount = await db.select(...);
  //   // Enqueue progress update job...
  // }

  return {
    enrollmentId,
    lessonId,
    completed,
    processedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Quiz Grade Processor
// ---------------------------------------------------------------------------

/**
 * Grade quiz submissions and store results.
 *
 * Expected side effects:
 * - Validate quiz answers against correct answers
 * - Calculate score (percentage)
 * - Store quiz result in the database
 * - Update enrollment if this affects course progress
 * - Allow retry if score is below passing threshold
 */
export const processQuizGrade: JobProcessor<QuizGradeJobData> = async (data, job) => {
  const { quizId, submissionId, answers, idempotencyKey } = data;

  console.debug(`[quiz:grade] Grading quiz=${quizId} submission=${submissionId}`, {
    jobId: job.id,
    idempotencyKey,
  });

  // TODO: Replace with actual database integration:
  // const db = getDatabase();
  //
  // 1. Fetch quiz questions with correct answers
  // const questions = await db.query.quizQuestions.findMany({
  //   where: eq(quizQuestions.quizId, quizId),
  // });
  //
  // 2. Compare answers and calculate score
  // let correct = 0;
  // const results = questions.map((q) => {
  //   const userAnswer = answers[q.id];
  //   const isCorrect = userAnswer === q.correctAnswer;
  //   if (isCorrect) correct++;
  //   return { questionId: q.id, isCorrect, userAnswer, correctAnswer: q.correctAnswer };
  // });
  //
  // const score = Math.round((correct / questions.length) * 100);
  // const passed = score >= 70; // configurable passing threshold
  //
  // 3. Store result
  // await db.insert(quizResults).values({
  //   enrollmentId,
  //   quizId,
  //   submissionId,
  //   score,
  //   passed,
  //   answers: results,
  //   submittedAt: new Date(),
  //   idempotencyKey,
  // }).onConflictDoNothing();

  // Placeholder result
  const totalQuestions = Object.keys(answers).length;
  return {
    submissionId,
    quizId,
    score: 0, // Will be calculated from actual grading
    totalQuestions,
    passed: false, // Will be determined by actual grading
    processedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Processor Entries
// ---------------------------------------------------------------------------

export const lessonProcessors: AnyProcessorEntry[] = [
  {
    jobType: JobType.LESSON_COMPLETION_UPDATE,
    processor: processLessonCompletionUpdate,
    queueName: QUEUE_NAMES.LESSONS,
    concurrency: 5,
  },
  {
    jobType: JobType.QUIZ_GRADE,
    processor: processQuizGrade,
    queueName: QUEUE_NAMES.QUIZZES,
    concurrency: 10,
  },
];
