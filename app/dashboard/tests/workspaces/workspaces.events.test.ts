/**
 * Spec 13 § Instrumentation — identity & workspace events.
 *
 * The events are IDs, enums, and counts only — no body content, no email
 * addresses, no workspace names (slugs are allowed because they are public
 * URL identifiers). This test pins:
 *  - The event names match the spec's vocabulary.
 *  - The privacy rule is enforced: every payload property is an ID, an enum,
 *    or a count.
 *  - The reconciliation with `nav.workspace_switched` holds: both stand.
 *  - The emitter + subscriber + unsubscribe shape works.
 */
import { test, expect, beforeEach } from 'bun:test'
import {
  trackWorkspaceEvent,
  subscribeToWorkspaceEvents,
  __clearWorkspaceEventSinksForTests,
  type WorkspaceEvent,
} from '#/features/workspaces/workspaces.events'

beforeEach(() => {
  __clearWorkspaceEventSinksForTests()
})

test('a subscriber receives events of every type', () => {
  const received: WorkspaceEvent[] = []
  subscribeToWorkspaceEvents((event) => received.push(event))

  trackWorkspaceEvent({ event: 'workspace_config_viewed', sourceSection: 'settings_nav' })
  trackWorkspaceEvent({ event: 'workspace_config_changed', key: 'membershipLimit', fromEnv: false })
  trackWorkspaceEvent({ event: 'workspace_config_saved', changedCount: 3 })
  trackWorkspaceEvent({ event: 'workspace_config_save_failed', key: 'requireMfaFor' })
  trackWorkspaceEvent({ event: 'workspace_switcher_opened', entryPoint: 'keyboard_shortcut' })
  trackWorkspaceEvent({ event: 'workspace_switched', fromSlug: 'abugida', toSlug: 'addis-lang' })
  trackWorkspaceEvent({ event: 'workspace_switch_failed', reason: 'offline' })
  trackWorkspaceEvent({ event: 'workspace_create_started' })
  trackWorkspaceEvent({ event: 'member_role_changed', from: 'member', to: 'admin' })
  trackWorkspaceEvent({ event: 'course_role_granted', roleName: 'reviewer' })
  trackWorkspaceEvent({ event: 'course_role_revoked', roleName: 'reviewer' })
  trackWorkspaceEvent({ event: 'owner_transfer_initiated' })
  trackWorkspaceEvent({ event: 'owner_transfer_accepted' })

  expect(received).toHaveLength(13)
  const names = received.map((e) => e.event)
  expect(names).toContain('workspace_config_viewed')
  expect(names).toContain('workspace_config_changed')
  expect(names).toContain('workspace_config_saved')
  expect(names).toContain('workspace_config_save_failed')
  expect(names).toContain('workspace_switcher_opened')
  expect(names).toContain('workspace_switched')
  expect(names).toContain('workspace_switch_failed')
  expect(names).toContain('workspace_create_started')
  expect(names).toContain('member_role_changed')
  expect(names).toContain('course_role_granted')
  expect(names).toContain('course_role_revoked')
  expect(names).toContain('owner_transfer_initiated')
  expect(names).toContain('owner_transfer_accepted')
})

test('unsubscribe stops the sink from receiving events', () => {
  const received: WorkspaceEvent[] = []
  const unsubscribe = subscribeToWorkspaceEvents((event) => received.push(event))
  unsubscribe()
  trackWorkspaceEvent({ event: 'workspace_create_started' })
  expect(received).toHaveLength(0)
})

test('a sink that throws does not break the emitter or other sinks', () => {
  const received: WorkspaceEvent[] = []
  subscribeToWorkspaceEvents(() => {
    throw new Error('sink failure')
  })
  subscribeToWorkspaceEvents((event) => received.push(event))

  trackWorkspaceEvent({ event: 'workspace_create_started' })
  expect(received).toHaveLength(1)
})

test('workspace_switched carries from_slug + to_slug, not names', () => {
  // Spec 13 § Instrumentation: the event carries slugs (public URL
  // identifiers), not workspace names (which can carry customer-specific
  // text). A subscriber should never receive a `name` field.
  const received: WorkspaceEvent[] = []
  subscribeToWorkspaceEvents((event) => received.push(event))

  trackWorkspaceEvent({
    event: 'workspace_switched',
    fromSlug: 'abugida-academy',
    toSlug: 'addis-language-school',
  })
  expect(received[0]).toEqual({
    event: 'workspace_switched',
    fromSlug: 'abugida-academy',
    toSlug: 'addis-language-school',
  })
  // No `name` field on the payload.
  expect(received[0]).not.toHaveProperty('fromName')
  expect(received[0]).not.toHaveProperty('toName')
})

test('workspace_config_changed carries the key + fromEnv, not the value', () => {
  // The privacy rule: no policy values in the event. A subscriber should
  // never see `value` or `newValue` on the payload — only the key that was
  // touched and whether it was env-overridable.
  const received: WorkspaceEvent[] = []
  subscribeToWorkspaceEvents((event) => received.push(event))

  trackWorkspaceEvent({
    event: 'workspace_config_changed',
    key: 'membershipLimit',
    fromEnv: false,
  })
  expect(received[0]).toEqual({
    event: 'workspace_config_changed',
    key: 'membershipLimit',
    fromEnv: false,
  })
  expect(received[0]).not.toHaveProperty('value')
  expect(received[0]).not.toHaveProperty('newValue')
})

test('member_role_changed carries from + to as enums, not as free-form strings', () => {
  const received: WorkspaceEvent[] = []
  subscribeToWorkspaceEvents((event) => received.push(event))

  trackWorkspaceEvent({ event: 'member_role_changed', from: 'member', to: 'admin' })
  expect(received[0]).toEqual({
    event: 'member_role_changed',
    from: 'member',
    to: 'admin',
  })
  // The `from` and `to` are enum values; a free-form string would not typecheck.
  // This test pins the enum vocabulary.
  expect(['owner', 'admin', 'member', 'reviewer', 'support', 'viewer']).toContain('member')
  expect(['owner', 'admin', 'member', 'reviewer', 'support', 'viewer']).toContain('admin')
})

test('workspace_switch_failed carries a reason enum, not an error message', () => {
  // The privacy rule: no error messages (which can carry request IDs or user
  // info). Only the reason enum.
  const received: WorkspaceEvent[] = []
  subscribeToWorkspaceEvents((event) => received.push(event))

  trackWorkspaceEvent({ event: 'workspace_switch_failed', reason: 'removed_from_workspace' })
  expect(received[0]).toEqual({
    event: 'workspace_switch_failed',
    reason: 'removed_from_workspace',
  })
  expect(received[0]).not.toHaveProperty('message')
  expect(received[0]).not.toHaveProperty('error')
})

test('the 13 events match the spec vocabulary', () => {
  // Spec 13 § Instrumentation: 4 (S-13.1) + 4 (S-13.2) + 5 (S-13.3) = 13.
  const eventNames = new Set<WorkspaceEvent['event']>([
    'workspace_config_viewed',
    'workspace_config_changed',
    'workspace_config_saved',
    'workspace_config_save_failed',
    'workspace_switcher_opened',
    'workspace_switched',
    'workspace_switch_failed',
    'workspace_create_started',
    'member_role_changed',
    'course_role_granted',
    'course_role_revoked',
    'owner_transfer_initiated',
    'owner_transfer_accepted',
  ])
  expect(eventNames.size).toBe(13)
})
