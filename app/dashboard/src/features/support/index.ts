export { HelpPanel } from './components/support.help-panel'
export { submitSupportTicket } from './server/support.ticket'
export { supportTicketSchema, type SupportTicketInput } from './schemas/support.schema'
export {
  HELP_ARTICLES,
  POPULAR_ARTICLE_LIMIT,
  moduleForPath,
  popularArticlesForModule,
  searchHelpArticles,
  type HelpArticle,
  type HelpModule,
} from './support.kb'
