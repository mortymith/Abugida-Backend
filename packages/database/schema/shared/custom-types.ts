import { customType } from 'drizzle-orm/pg-core'

export const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea'
  },
})

export const tsvector = customType<{ data: string; default: false }>({
  dataType() {
    return 'tsvector'
  },
})
