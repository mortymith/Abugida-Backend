import { customType } from 'drizzle-orm/pg-core'

export const bytea = customType<{ data: Uint8Array; default: false }>({
  dataType() {
    return 'bytea'
  },
})

export const tsvector = customType<{ data: string; default: false }>({
  dataType() {
    return 'tsvector'
  },
})
