import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { formatInteger } from '#/lib/format'
import type { StudentDirectoryStats } from '../students.types'

/**
 * S-4.1 Stats Row: Total Students, Active This Week, Inactive This Week,
 * Courses Avg/User. "Inactive" counts students enrolled 7+ days ago with no
 * activity in the last 7 days.
 */
export function StudentsStatCards({ stats }: { stats: StudentDirectoryStats | undefined }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="gap-3 py-5">
            <CardHeader className="px-5">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="px-5">
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    { label: 'Total Students', value: formatInteger(stats.totalStudents) },
    { label: 'Active This Week', value: formatInteger(stats.activeThisWeek) },
    { label: 'Inactive This Week', value: formatInteger(stats.inactiveThisWeek) },
    {
      label: 'Courses Avg/User',
      value: stats.avgCoursesPerUser == null ? '—' : stats.avgCoursesPerUser.toFixed(1),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="list" aria-label="Student stats">
      {cards.map((card) => (
        <Card key={card.label} className="gap-1 py-5" role="listitem">
          <CardHeader className="px-5">
            <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-bold tabular-nums">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
