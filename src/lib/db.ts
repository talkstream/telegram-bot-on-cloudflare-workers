import { D1Database } from '@cloudflare/workers-types'

export function getDb(env: { DB: D1Database }) {
  return env.DB
}
