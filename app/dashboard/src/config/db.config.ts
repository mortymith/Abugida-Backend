import { createClient } from '@abugida/database/client'
import { env } from './app.config'

export const db = createClient(env.DATABASE_URL)
