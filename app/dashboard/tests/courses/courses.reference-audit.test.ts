/**
 * Spec 12 § 9.4 — reference audit URL extraction.
 *
 * The DB-backed `auditImageAssetsImpl` and the network-backed
 * `auditLinkReachabilityImpl` are exercised by manual + E2E. This test
 * covers the pure URL extractors that have to behave identically across
 * builds:
 *  - `extractImageUrls` finds every `![...](url)` with the right 1-based
 *    line number.
 *  - `extractLinkUrls` finds every `[...](url)` (excluding images) with the
 *    right 1-based line number.
 *  - mailto: and relative URLs are skipped by the link extractor.
 *  - Image titles are stripped from the URL.
 */
import { test, expect } from 'bun:test'
import {
  extractImageUrls,
  extractLinkUrls,
  ASSET_MISSING,
  LINK_UNREACHABLE,
} from '#/features/courses/courses.reference-audit'

test('ASSET_MISSING and LINK_UNREACHABLE are the spec values', () => {
  expect(ASSET_MISSING).toBe('ASSET_MISSING')
  expect(LINK_UNREACHABLE).toBe('LINK_UNREACHABLE')
})

test('extractImageUrls finds a single inline image', () => {
  const urls = extractImageUrls('![alt](https://cdn.example.com/a.png)')
  expect(urls).toEqual([{ url: 'https://cdn.example.com/a.png', line: 1 }])
})

test('extractImageUrls strips the optional title', () => {
  const urls = extractImageUrls('![alt](https://cdn.example.com/a.png "Homepage")')
  expect(urls[0]?.url).toBe('https://cdn.example.com/a.png')
})

test('extractImageUrls reports the correct 1-based line for a mid-document image', () => {
  const markdown = ['Intro paragraph.', '', '![alt](https://a.example/1.png)', '', 'Outro.'].join(
    '\n',
  )
  const urls = extractImageUrls(markdown)
  expect(urls[0]?.line).toBe(3)
})

test('extractImageUrls finds multiple images on different lines', () => {
  const markdown = '![a](https://a.example/1.png)\n\n![b](https://a.example/2.png)'
  const urls = extractImageUrls(markdown)
  expect(urls).toHaveLength(2)
  expect(urls[0]?.url).toBe('https://a.example/1.png')
  expect(urls[1]?.url).toBe('https://a.example/2.png')
  expect(urls[1]?.line).toBe(3)
})

test('extractLinkUrls finds a single inline link', () => {
  const urls = extractLinkUrls('Read the [guide](https://www.example.com/guide).')
  expect(urls).toEqual([{ url: 'https://www.example.com/guide', line: 1 }])
})

test('extractLinkUrls excludes image URLs', () => {
  const markdown = '![alt](https://a.example/1.png) and [a link](https://b.example/page)'
  const urls = extractLinkUrls(markdown)
  expect(urls).toHaveLength(1)
  expect(urls[0]?.url).toBe('https://b.example/page')
})

test('extractLinkUrls skips mailto: and relative URLs', () => {
  const markdown = 'Email [me](mailto:a@b.example) or visit [home](/home).'
  const urls = extractLinkUrls(markdown)
  expect(urls).toEqual([])
})

test('extractLinkUrls reports the correct 1-based line for a mid-document link', () => {
  const markdown = ['Intro paragraph.', '', 'Read the [guide](https://example.com).', ''].join('\n')
  const urls = extractLinkUrls(markdown)
  expect(urls[0]?.line).toBe(3)
})

test('extractLinkUrls finds multiple links on the same line', () => {
  const markdown = 'Read [one](https://a.example/1) and [two](https://b.example/2).'
  const urls = extractLinkUrls(markdown)
  expect(urls).toHaveLength(2)
  expect(urls[0]?.url).toBe('https://a.example/1')
  expect(urls[1]?.url).toBe('https://b.example/2')
  expect(urls[0]?.line).toBe(1)
  expect(urls[1]?.line).toBe(1)
})

test('extractImageUrls returns an empty array when there are no images', () => {
  expect(extractImageUrls('plain text only')).toEqual([])
})

test('extractLinkUrls returns an empty array when there are no links', () => {
  expect(extractLinkUrls('plain text only')).toEqual([])
})
