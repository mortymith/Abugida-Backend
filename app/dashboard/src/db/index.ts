import { createClient } from '@abugida/database/client'

export const db = createClient(process.env.DATABASE_URL!)
