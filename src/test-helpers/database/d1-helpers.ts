import { vi } from 'vitest';
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';

/**
 * Enhanced D1 mock with better type safety and query tracking
 */
export interface MockD1Database extends D1Database {
  _queries: Array<{ sql: string; params?: unknown[] }>;
  _setQueryResult: (sql: string | RegExp, result: unknown) => void;
  _setMultipleResults: (results: Map<string | RegExp, unknown>) => void;
  _reset: () => void;
}

/**
 * Create a fully-featured mock D1 database for testing
 */
export function createMockD1Database(): MockD1Database {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const queryResults = new Map<string | RegExp, unknown>();

  const createStatement = (sql: string, initialParams?: unknown[]): D1PreparedStatement => {
    const boundParams: unknown[] = initialParams || [];

    const executeQuery = async (method: 'first' | 'all' | 'run' | 'raw') => {
      queries.push({ sql, params: boundParams.length > 0 ? boundParams : undefined });

      // Find matching result
      for (const [pattern, result] of queryResults) {
        const matches = typeof pattern === 'string' ? sql.includes(pattern) : pattern.test(sql);

        if (matches) {
          if (method === 'first') {
            return Array.isArray(result) ? result[0] || null : result;
          } else if (method === 'all') {
            return {
              results: Array.isArray(result) ? result : [result],
              success: true,
              meta: { duration: 0.1, rows_read: 1, rows_written: 0 },
            };
          } else if (method === 'run') {
            return {
              success: true,
              meta: {
                duration: 0.1,
                last_row_id: 1,
                changes: 1,
                rows_read: 0,
                rows_written: 1,
              },
            };
          } else if (method === 'raw') {
            return Array.isArray(result) ? result : [result];
          }
        }
      }

      // Default responses
      if (method === 'first') return null;
      if (method === 'all') return { results: [], success: true, meta: {} };
      if (method === 'run') return { success: true, meta: { changes: 0 } };
      return [];
    };

    return {
      bind: vi.fn((...params: unknown[]) => {
        return createStatement(sql, params);
      }),
      first: vi.fn(async () => executeQuery('first')),
      all: vi.fn(async () => executeQuery('all')),
      run: vi.fn(async () => executeQuery('run')),
      raw: vi.fn(async () => executeQuery('raw')),
    } as unknown as D1PreparedStatement;
  };

  const mockDb = {
    prepare: vi.fn((sql: string) => createStatement(sql)),

    batch: vi.fn(async (statements: D1PreparedStatement[]) => {
      const results: D1Result[] = [];
      for (const stmt of statements) {
        const result = await stmt.run();
        results.push(result);
      }
      return results;
    }),

    exec: vi.fn(async (sql: string) => {
      queries.push({ sql });
      return {
        count: 0,
        duration: 0.1,
      } as D1ExecResult;
    }),

    // Test helpers
    _queries: queries,

    _setQueryResult: (pattern: string | RegExp, result: unknown) => {
      queryResults.set(pattern, result);
    },

    _setMultipleResults: (results: Map<string | RegExp, unknown>) => {
      queryResults.clear();
      for (const [pattern, result] of results) {
        queryResults.set(pattern, result);
      }
    },

    _reset: () => {
      queries.length = 0;
      queryResults.clear();
      vi.clearAllMocks();
    },
  };

  // Add missing methods required by D1Database interface
  const fullMockDb: MockD1Database = {
    ...mockDb,
    withSession: vi.fn(() => ({
      ...mockDb,
      prepare: mockDb.prepare,
      batch: mockDb.batch,
      exec: mockDb.exec,
      dump: vi.fn(async () => new ArrayBuffer(0)),
      withSession: vi.fn(),
      getBookmark: vi.fn(() => 'mock-bookmark'),
      setQueries: mockDb.setQueries,
      getQueries: mockDb.getQueries,
      setQueryResult: mockDb.setQueryResult,
      reset: mockDb.reset,
    })),
    dump: vi.fn(async () => new ArrayBuffer(0)),
  } as MockD1Database;

  return fullMockDb as MockD1Database;
}

/**
 * Helper to create D1 result objects
 */
export function createD1Result<T>(
  data: T[],
  options?: {
    duration?: number;
    rowsRead?: number;
    rowsWritten?: number;
  },
): D1Result<T> {
  return {
    results: data,
    success: true,
    meta: {
      duration: options?.duration ?? 0.1,
      rows_read: options?.rowsRead ?? data.length,
      rows_written: options?.rowsWritten ?? 0,
      size_after: 0,
      last_row_id: 0,
      changed_db: false,
      changes: 0,
    } as D1MetaData,
  };
}

/**
 * Helper for creating run results
 */
export function createD1RunResult(options?: {
  success?: boolean;
  changes?: number;
  lastRowId?: number;
  duration?: number;
}): D1Result {
  return {
    results: [],
    success: true as true,
    meta: {
      duration: options?.duration ?? 0.1,
      last_row_id: options?.lastRowId ?? 1,
      changes: options?.changes ?? 1,
      rows_read: 0,
      rows_written: options?.changes ?? 1,
      size_after: 0,
      changed_db: true,
    } as D1MetaData,
  };
}

/**
 * SQL query matcher for flexible testing
 */
export class SQLMatcher {
  private patterns: Array<{ pattern: RegExp; result: unknown }> = [];

  when(pattern: string | RegExp): SQLMatcherResult {
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern.replace(/\s+/g, '\\s+'), 'i') : pattern;

    const resultHolder = new SQLMatcherResult();
    this.patterns.push({ pattern: regex, result: resultHolder });
    return resultHolder;
  }

  match(sql: string): unknown | null {
    for (const { pattern, result } of this.patterns) {
      if (pattern.test(sql)) {
        return (result as SQLMatcherResult).result;
      }
    }
    return null;
  }
}

class SQLMatcherResult {
  private _result: unknown;

  thenReturn(result: unknown): void {
    this._result = result;
  }

  get result(): unknown {
    return this._result;
  }
}
