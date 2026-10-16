/**
 * Spec 13 § Instrumentation — identity & workspace events.
 *
 * Every property is an ID, an enum, or a count. **No body content, no prompt
 * text, no PII** — including no email addresses and no workspace names. The
 * `slug` is a public identifier (the same one in the URL), so it is allowed;
 * the workspace `name` is not, because it can carry customer-specific text.
 *
 * The events are split by surface:
 *
 *  - S-13.1 Workspace Configuration: `workspace_config_viewed`,
 *    `workspace_config_changed`, `workspace_config_saved`,
 *    `workspace_config_save_failed`.
 *  - S-13.2 Workspace Switcher: `workspace_switcher_opened`,
 *    `workspace_switched`, `workspace_switch_failed`,
 *    `workspace_create_started`.
 *  - S-13.3 Role Assignment: `member_role_changed`, `course_role_granted`,
 *    `course_role_revoked`, `owner_transfer_initiated`,
 *    `owner_transfer_accepted`.
 *
 * Reconciled with the existing `nav.workspace_switched` event (spec 11 nav
 * instrumentation): that event fires on every workspace switch from the
 * shell. `workspace_switched` here is the spec-13 sibling that carries the
 * `{ from_slug, to_slug }` pair the spec calls for. Both stand — the nav
 * event is the shell's own telemetry, the spec-13 event is the identity
 * surface's. See `DESIGN.md` § 15 for the reconciliation register.
 *
 * The emitter is deliberately minimal: a typed `trackWorkspaceEvent` function
 * that pushes to an in-memory sink. A downstream consumer (analytics,
 * observability) can subscribe. Same shape as the spec-12 lesson-editor
 * emitter.
 */

/** The S-13.1 entry point that opened the workspace-config screen. */
export type WorkspaceConfigEntryPoint = 'settings_nav' | 'deep_link' | 'audit_log'

/** The S-13.2 entry point that opened the workspace switcher. */
export type WorkspaceSwitcherEntryPoint = 'header' | 'avatar_menu' | 'keyboard_shortcut' | 'command_palette'

/** The S-13.2 reason a workspace switch failed. */
export type WorkspaceSwitchFailReason =
  | 'offline'
  | 'session_expired'
  | 'removed_from_workspace'
  | 'server_error'

/** The S-13.3 role a member was changed from / to. */
export type MemberRoleValue = 'owner' | 'admin' | 'member' | 'reviewer' | 'support' | 'viewer'

/** The S-13.3 scope of an owner transfer. */
export type OwnerTransferScope = 'initiate' | 'accept' | 'cancel'

/** The union of all identity & workspace event payloads. */
export type WorkspaceEvent =
  | {
      event: 'workspace_config_viewed'
      sourceSection: WorkspaceConfigEntryPoint
    }
  | {
      event: 'workspace_config_changed'
      /** The policy key that was changed. */
      key: string
      /** Whether the key is env-overridable (read-only on the UI). */
      fromEnv: boolean
    }
  | {
      event: 'workspace_config_saved'
      /** The number of policies changed in this save. */
      changedCount: number
    }
  | {
      event: 'workspace_config_save_failed'
      /** The policy key that triggered the failure. */
      key: string
    }
  | {
      event: 'workspace_switcher_opened'
      entryPoint: WorkspaceSwitcherEntryPoint
    }
  | {
      event: 'workspace_switched'
      fromSlug: string
      toSlug: string
    }
  | {
      event: 'workspace_switch_failed'
      reason: WorkspaceSwitchFailReason
    }
  | {
      event: 'workspace_create_started'
    }
  | {
      event: 'member_role_changed'
      from: MemberRoleValue
      to: MemberRoleValue
    }
  | {
      event: 'course_role_granted'
      roleName: string
    }
  | {
      event: 'course_role_revoked'
      roleName: string
    }
  | {
      event: 'owner_transfer_initiated'
    }
  | {
      event: 'owner_transfer_accepted'
    }

/** A subscriber that receives every identity & workspace event. */
export type WorkspaceEventSink = (event: WorkspaceEvent) => void

const sinks: Set<WorkspaceEventSink> = new Set()

/**
 * Subscribe to identity & workspace events. Returns an unsubscribe function.
 */
export function subscribeToWorkspaceEvents(sink: WorkspaceEventSink): () => void {
  sinks.add(sink)
  return () => {
    sinks.delete(sink)
  }
}

/**
 * Emit an identity & workspace event. Every property has been verified to be
 * an ID, an enum, or a count — no body content, no email addresses, no
 * workspace names (slugs are allowed because they are public URL identifiers).
 */
export function trackWorkspaceEvent(event: WorkspaceEvent): void {
  for (const sink of sinks) {
    try {
      sink(event)
    } catch {
      // A sink failure must not break the editor. The sink is responsible for
      // its own error handling; this guard is the last line of defence.
    }
  }
}

/** Test-only: clear all subscribers. */
export function __clearWorkspaceEventSinksForTests(): void {
  sinks.clear()
}
