export type NotificationType =
  'enrollment' | 'payment' | 'publish' | 'mention' | 'system' | 'team_invite' | 'review'

export type NotificationsTab = 'all' | 'mentions' | 'system'

export interface NotificationItem {
  publicId: string
  type: NotificationType
  title: string
  body: string | null
  linkEntityType: string | null
  linkEntityPublicId: string | null
  isRead: boolean
  createdAt: string
  url: string
  exists: boolean
}

export interface NotificationsPage {
  items: NotificationItem[]
  tab: NotificationsTab
  page: number
  pageSize: number
  hasMore: boolean
  unreadCount: number
}
