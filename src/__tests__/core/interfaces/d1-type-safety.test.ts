import { describe, expect, it, vi } from 'vitest'

import type { D1AllMeta, D1RunMeta, IDatabaseStore } from '@/core/interfaces/storage'

describe('D1 Type Safety Pattern', () => {
  describe('D1RunMeta', () => {
    it('should handle successful insert with last_row_id', async () => {
      const mockRun = vi.fn().mockResolvedValue({
        meta: { last_row_id: 123, changes: 1, duration: 5 },
        success: true
      })

      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: mockRun })
      })

      const mockDb: IDatabaseStore = {
        prepare: mockPrepare,
        exec: vi.fn(),
        batch: vi.fn(),
        dump: vi.fn()
      }

      const result = await mockDb.prepare('INSERT INTO test VALUES (?)').bind('value').run()
      const meta = result.meta as D1RunMeta

      expect(meta.last_row_id).toBe(123)
      expect(meta.changes).toBe(1)
      expect(meta.duration).toBe(5)
    })

    it('should handle missing last_row_id', async () => {
      const mockRun = vi.fn().mockResolvedValue({
        meta: { changes: 0, duration: 3 }, // No last_row_id
        success: true
      })

      const mockDb = createMockDb(mockRun)

      const result = await mockDb.prepare('UPDATE test SET value = ?').bind('value').run()
      const meta = result.meta as D1RunMeta

      expect(meta.last_row_id).toBeUndefined()
      expect(meta.changes).toBe(0)
    })

    it('should provide type safety for metadata access', () => {
      const meta: D1RunMeta = {
        last_row_id: 1,
        changes: 1,
        duration: 10,
        rows_affected: 1
      }

      // TypeScript should allow these
      expect(meta.last_row_id).toBeDefined()
      expect(meta.changes).toBeDefined()
      expect(meta.duration).toBeDefined()
      expect(meta.rows_affected).toBeDefined()

      // TypeScript should prevent accessing non-existent properties
      // @ts-expect-error - invalid_field doesn't exist
      expect(meta.invalid_field).toBeUndefined()
    })
  })

  describe('D1AllMeta', () => {
    it('should handle metadata from all() queries', async () => {
      const mockAll = vi.fn().mockResolvedValue({
        results: [{ id: 1, name: 'test' }],
        meta: { duration: 8, rows_read: 1, rows_written: 0 }
      })

      const mockDb = createMockDb(undefined, mockAll)

      const result = await mockDb.prepare('SELECT * FROM test').all()
      const meta = result.meta as D1AllMeta

      expect(meta.duration).toBe(8)
      expect(meta.rows_read).toBe(1)
      expect(meta.rows_written).toBe(0)
    })
  })

  describe('Error Handling Pattern', () => {
    it('should throw meaningful error when last_row_id is missing', async () => {
      const service = {
        async createRecord(db: IDatabaseStore, value: string): Promise<number> {
          const result = await db.prepare('INSERT INTO test VALUES (?)').bind(value).run()
          const meta = result.meta as D1RunMeta

          if (!meta.last_row_id) {
            throw new Error('Failed to get last_row_id from database')
          }

          return meta.last_row_id
        }
      }

      const mockDb = createMockDb(
        vi.fn().mockResolvedValue({
          meta: {}, // No last_row_id
          success: true
        })
      )

      await expect(service.createRecord(mockDb, 'test')).rejects.toThrow(
        'Failed to get last_row_id from database'
      )
    })
  })

  describe('Complex Query Types', () => {
    it('should handle JOIN query results with proper types', async () => {
      interface UserRow {
        id: number
        name: string
      }

      interface UserWithPostsRow extends UserRow {
        post_count: number
        last_post_date: string
      }

      const mockAll = vi.fn().mockResolvedValue({
        results: [
          {
            id: 1,
            name: 'John',
            post_count: 5,
            last_post_date: '2025-07-25'
          }
        ],
        meta: { duration: 12, rows_read: 2 }
      })

      const mockDb = createMockDb(undefined, mockAll)

      const { results } = await mockDb.prepare('SELECT ...').all<UserWithPostsRow>()

      // TypeScript knows about all fields
      expect(results[0].id).toBe(1)
      expect(results[0].name).toBe('John')
      expect(results[0].post_count).toBe(5)
      expect(results[0].last_post_date).toBe('2025-07-25')
    })
  })
})

// Helper to create mock database
function createMockDb(
  runMock?: ReturnType<typeof vi.fn>,
  allMock?: ReturnType<typeof vi.fn>
): IDatabaseStore {
  const preparedStatement = {
    bind: vi.fn().mockReturnThis(),
    run: runMock || vi.fn(),
    all: allMock || vi.fn(),
    first: vi.fn()
  }

  // Make bind return the same prepared statement
  preparedStatement.bind.mockReturnValue(preparedStatement)

  return {
    prepare: vi.fn().mockReturnValue(preparedStatement),
    exec: vi.fn(),
    batch: vi.fn(),
    dump: vi.fn()
  }
}
