import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * Analytics section layout (spec 07 / Section 5). Auth is enforced by the
 * `_app` layout; per-screen RBAC is server-enforced in every impl module
 * (all staff roles may read analytics per the spec 11 matrix).
 */
export const Route = createFileRoute('/_app/analytics')({
  component: Outlet,
})
