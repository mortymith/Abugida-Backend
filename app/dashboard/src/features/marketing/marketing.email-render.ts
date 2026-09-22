import { renderMergeTags, hasUnresolvedTags } from './marketing.merge-tags'
import type { MergeTagData } from './marketing.merge-tags'
import type { TemplateBlockView } from './marketing.types'

/**
 * Render a template document (blocks + locked unsubscribe footer) into a
 * plain, client-safe HTML email body. Pure so the preview, the test send,
 * and the real campaign pipeline all produce identical output.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escape HTML but preserve intentional merge-tag renders (already data). */
function escapeData(text: string): string {
  return escapeHtml(text)
}

export interface RenderedEmail {
  html: string
  /** True when any field still contains an unresolved `{{tag}}`. */
  hasUnresolvedTags: boolean
}

function renderBlockToHtml(block: TemplateBlockView, data: MergeTagData): string {
  switch (block.type) {
    case 'hero': {
      const heading = escapeData(renderMergeTags(block.heading ?? '', data))
      const sub = block.subheading
        ? `<p style="margin:8px 0 0;color:#555;">${escapeData(renderMergeTags(block.subheading ?? '', data))}</p>`
        : ''
      return `<tr><td style="padding:24px 16px 8px;"><h1 style="margin:0;font-size:22px;">${heading}</h1>${sub}</td></tr>`
    }
    case 'text': {
      const body = renderMergeTags(block.body ?? '', data)
      const paragraphs = body
        .split(/\n{2,}/)
        .map(
          (paragraph) =>
            `<p style="margin:0 0 12px;">${escapeData(paragraph).replace(/\n/g, '<br/>')}</p>`,
        )
        .join('')
      return `<tr><td style="padding:8px 16px;">${paragraphs}</td></tr>`
    }
    case 'button': {
      const label = escapeData(renderMergeTags(block.label ?? '', data))
      const url = renderMergeTags(block.url ?? '', data)
      const safeUrl = /^https?:\/\//i.test(url) ? escapeHtml(url) : '#'
      return `<tr><td style="padding:12px 16px;"><a href="${safeUrl}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#ffffff;border-radius:8px;text-decoration:none;">${label}</a></td></tr>`
    }
    case 'course_card': {
      const courseName = data.course_name
        ? escapeData(renderMergeTags('{{course_name}}', data))
        : 'Your course'
      const progressUrl = data.progress_url
      const inner = progressUrl
        ? `<a href="${escapeHtml(progressUrl)}" style="text-decoration:none;color:inherit;">${courseName}</a>`
        : courseName
      return `<tr><td style="padding:12px 16px;"><div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;">${inner}</div></td></tr>`
    }
    default:
      return ''
  }
}

export function renderTemplateDocument(
  document: { blocks: TemplateBlockView[] } | null,
  data: MergeTagData,
): RenderedEmail {
  const blocks = document?.blocks ?? []
  const rows = blocks.map((block) => renderBlockToHtml(block, data)).join('')
  const unsubscribeUrl = data.unsubscribe_url ?? '#unsubscribe'
  const footer = `<tr><td style="padding:24px 16px 8px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
    You are receiving this because you are an Abugida Academy student.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a>
  </td></tr>`

  const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;">
      ${rows}${footer}
    </table>
  </body></html>`

  const allText = [
    ...blocks.flatMap((block) => {
      if (block.type === 'hero') return [block.heading, block.subheading ?? '']
      if (block.type === 'text') return [block.body]
      if (block.type === 'button') return [block.label]
      return []
    }),
  ].join(' ')

  return { html, hasUnresolvedTags: hasUnresolvedTags(allText) }
}
