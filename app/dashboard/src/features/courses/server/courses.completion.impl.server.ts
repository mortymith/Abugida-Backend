/**
 * Server-only implementation of S-2.10 Certificates & Completion Rules.
 */
import { eq } from '@abugida/database'
import { certificateTemplates, completionRules } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireAuthoringRole, resolveCourse } from './courses.server-helpers.server'
import type { CompletionRulesSaveInput } from '../schemas/courses.learning.schema'
import type { CompletionSettingsDTO } from '../courses.types'

export async function getCompletionSettingsImpl(
  coursePublicId: string,
): Promise<CompletionSettingsDTO> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)

  const [ruleRows, certificateRows] = await Promise.all([
    db.select().from(completionRules).where(eq(completionRules.courseId, course.id)).limit(1),
    db
      .select()
      .from(certificateTemplates)
      .where(eq(certificateTemplates.courseId, course.id))
      .limit(1),
  ])

  const rule = ruleRows.at(0)
  const certificate = certificateRows.at(0)

  return {
    rule: rule?.rule ?? 'all_lessons',
    minPercent: rule?.minPercent ?? 80,
    autoIssue: rule?.autoIssue ?? true,
    certificate: certificate
      ? {
          title: certificate.title,
          showStudentName: certificate.showStudentName,
          showCourseTitle: certificate.showCourseTitle,
          showCompletionDate: certificate.showCompletionDate,
          showSignature: certificate.showSignature,
          signatureObjectKey: certificate.signatureObjectKey,
          signatureLabel: certificate.signatureLabel,
        }
      : {
          title: `Certificate of Completion — ${course.title}`,
          showStudentName: true,
          showCourseTitle: true,
          showCompletionDate: true,
          showSignature: true,
          signatureObjectKey: null,
          signatureLabel: null,
        },
  }
}

export async function saveCompletionSettingsImpl(
  input: CompletionRulesSaveInput,
): Promise<{ ok: true }> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)

  await db.transaction(async (tx) => {
    const existingRule = await tx
      .select({ id: completionRules.id })
      .from(completionRules)
      .where(eq(completionRules.courseId, course.id))
      .limit(1)

    if (existingRule.at(0)) {
      await tx
        .update(completionRules)
        .set({
          rule: input.rule,
          minPercent: input.rule === 'min_percent_quiz' ? input.minPercent : 80,
          autoIssue: input.autoIssue,
        })
        .where(eq(completionRules.id, existingRule.at(0)!.id))
    } else {
      await tx.insert(completionRules).values({
        courseId: course.id,
        rule: input.rule,
        minPercent: input.rule === 'min_percent_quiz' ? input.minPercent : 80,
        autoIssue: input.autoIssue,
      })
    }

    const existingCertificate = await tx
      .select({ id: certificateTemplates.id })
      .from(certificateTemplates)
      .where(eq(certificateTemplates.courseId, course.id))
      .limit(1)

    const certificateValues = {
      courseId: course.id,
      title: input.certificate.title,
      showStudentName: input.certificate.showStudentName,
      showCourseTitle: input.certificate.showCourseTitle,
      showCompletionDate: input.certificate.showCompletionDate,
      showSignature: input.certificate.showSignature,
      signatureObjectKey: input.certificate.signatureObjectKey,
      signatureLabel: input.certificate.signatureLabel,
    }

    if (existingCertificate.at(0)) {
      await tx
        .update(certificateTemplates)
        .set(certificateValues)
        .where(eq(certificateTemplates.id, existingCertificate.at(0)!.id))
    } else {
      await tx.insert(certificateTemplates).values(certificateValues)
    }
  })

  return { ok: true }
}
