/**
 * AWS RDS/Aurora-based database store (mock implementation)
 */

import type {
  IDatabaseStore,
  IPreparedStatement,
  StatementResult,
  QueryOptions,
} from '../../../../core/interfaces/storage';

class AWSPreparedStatement implements IPreparedStatement {
  constructor(
    private query: string,
    private params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): IPreparedStatement {
    return new AWSPreparedStatement(this.query, values);
  }

  async first<T = unknown>(_column?: string): Promise<T | null> {
    console.info(`[AWS DB] Executing first: ${this.query}`, this.params);
    return null;
  }

  async all<T = unknown>(options?: QueryOptions): Promise<StatementResult<T>> {
    console.info(`[AWS DB] Executing all: ${this.query}`, this.params, options);
    return {
      results: [],
      success: true,
      meta: {},
    };
  }

  async run(): Promise<StatementResult> {
    console.info(`[AWS DB] Executing run: ${this.query}`, this.params);
    return {
      results: [],
      success: true,
      meta: {
        changes: 0,
        last_row_id: 0,
      },
    };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    console.info(`[AWS DB] Executing raw: ${this.query}`, this.params);
    return [];
  }
}

export class AWSDatabaseStore implements IDatabaseStore {
  constructor(private dbName: string) {}

  prepare(query: string): IPreparedStatement {
    return new AWSPreparedStatement(query);
  }

  async exec(query: string): Promise<void> {
    console.info(`[AWS DB] Executing: ${query}`);
  }

  async batch<T = unknown>(statements: IPreparedStatement[]): Promise<T[]> {
    console.info(`[AWS DB] Batch executing ${statements.length} statements`);
    return [];
  }
}
