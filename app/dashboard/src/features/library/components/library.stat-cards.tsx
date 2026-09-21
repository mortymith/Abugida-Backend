import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { formatInteger } from '#/lib/format'
import { formatStorageUsed } from '../library.asset-category'
import type { LibraryStats } from '../library.types'

/**
 * S-3.1 Stats Row: total / videos / PDFs / images cards with storage used
 * per category (audio folds into the total per wireframe emphasis).
 */
export function LibraryStatCards({ stats }: { stats: LibraryStats | undefined }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="gap-3 py-5">
            <CardHeader className="px-5">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="flex items-baseline justify-between gap-2 px-5">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    { label: 'Total Assets', stat: stats.total },
    { label: 'Videos', stat: stats.video },
    { label: 'PDFs', stat: stats.document },
    { label: 'Images', stat: stats.image },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="list" aria-label="Library stats">
      {cards.map((card) => (
        <Card key={card.label} className="gap-1 py-5" role="listitem">
          <CardHeader className="px-5">
            <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between gap-2 px-5">
            <p className="text-2xl font-bold tabular-nums">{formatInteger(card.stat.count)}</p>
            <p className="text-xs text-muted-foreground">{formatStorageUsed(card.stat.bytes)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
