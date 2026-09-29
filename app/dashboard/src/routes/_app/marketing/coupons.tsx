import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CouponsView } from '#/features/marketing'

/** S-8.3 Discount & Coupon Codes. */
const couponsSearchSchema = z.object({
  status: z.enum(['all', 'active', 'expired', 'deactivated', 'exhausted']).default('all'),
})

export const Route = createFileRoute('/_app/marketing/coupons')({
  validateSearch: couponsSearchSchema,
  component: CouponsPage,
})

function CouponsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CouponsView
      status={search.status}
      onStatusChange={(status) =>
        void navigate({ search: (prev) => ({ ...prev, status: status as typeof prev.status }) })
      }
    />
  )
}
