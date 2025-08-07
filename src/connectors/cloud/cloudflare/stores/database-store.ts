/**
 * Cloudflare D1 implementation of IDatabaseStore
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'

import type { IDatabaseStore, IPreparedStatement } from '../../../../core/interfaces/storage'

export class CloudflareDatabaseStore implements IDatabaseStore {
  constructor(private db: D1Database) {}

  prepare(query: string): IPreparedStatement {
    const statement = this.db.prepare(query)
    return new CloudflarePreparedStatement(statement)
  }

  async exec(query: string): Promise<void> {
    await this.db.exec(query)
  }

  async batch<T = unknown>(statements: IPreparedStatement[]): Promise<T[]> {
    // Convert our prepared statements back to D1 statements
    const d1Statements = statements.map(stmt => {
      if (stmt instanceof CloudflarePreparedStatement) {
        return stmt.getD1Statement()
      }
      throw new Error('Invalid statement type for Cloudflare D1 batch')
    })

    const results = await this.db.batch(d1Statements)
    return results as T[]
  }
}

class CloudflarePreparedStatement implements IPreparedStatement {
  constructor(private statement: D1PreparedStatement) {}

  bind(...values: unknown[]): IPreparedStatement {
    this.statement = this.statement.bind(...values)
    return this
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    if (colName) {
      return (await this.statement.first(colName)) as T | null
    }
    return (await this.statement.first()) as T | null
  }

  async all<T = unknown>(): Promise<{ results: T[]; meta: unknown }> {
    const result = await this.statement.all()
    return {
      results: result.results as T[],
      meta: result.meta
    }
  }

  async run(): Promise<{ meta: unknown }> {
    const result = await this.statement.run()
    return { meta: result.meta }
  }

  /**
   * Get the underlying D1 statement (for batch operations)
   */
  getD1Statement(): D1PreparedStatement {
    return this.statement
  }
}
