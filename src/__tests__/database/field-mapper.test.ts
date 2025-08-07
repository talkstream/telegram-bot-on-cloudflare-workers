import { describe, expect, it } from 'vitest'

import { CommonTransformers, createAutoMapper, FieldMapper } from '@/core/database/field-mapper'

describe('FieldMapper', () => {
  describe('Basic field mapping', () => {
    interface TestDbRow {
      user_id: number
      user_name: string
      is_active: number
    }

    interface TestModel {
      userId: number
      userName: string
      isActive: boolean
    }

    const mapper = new FieldMapper<TestDbRow, TestModel>([
      { dbField: 'user_id', domainField: 'userId' },
      { dbField: 'user_name', domainField: 'userName' },
      {
        dbField: 'is_active',
        domainField: 'isActive',
        toDomain: v => v === 1,
        toDb: v => (v ? 1 : 0)
      }
    ])

    it('should map database row to domain model', () => {
      const dbRow: TestDbRow = {
        user_id: 123,
        user_name: 'testuser',
        is_active: 1
      }

      const result = mapper.toDomain(dbRow)

      expect(result).toEqual({
        userId: 123,
        userName: 'testuser',
        isActive: true
      })
    })

    it('should map domain model to database row', () => {
      const model: TestModel = {
        userId: 123,
        userName: 'testuser',
        isActive: true
      }

      const result = mapper.toDatabase(model)

      expect(result).toEqual({
        user_id: 123,
        user_name: 'testuser',
        is_active: 1
      })
    })

    it('should handle undefined values', () => {
      const partialRow: Partial<TestDbRow> = {
        user_id: 123
      }

      const result = mapper.toDomain(partialRow as TestDbRow)

      expect(result).toEqual({
        userId: 123
      })
    })
  })

  describe('SQL generation', () => {
    interface UserDb {
      telegram_id: number
      first_name: string
      created_at: string
    }

    interface User {
      telegramId: number
      firstName: string
      createdAt: Date
    }

    const mapper = new FieldMapper<UserDb, User>([
      { dbField: 'telegram_id', domainField: 'telegramId' },
      { dbField: 'first_name', domainField: 'firstName' },
      { dbField: 'created_at', domainField: 'createdAt' }
    ])

    it('should generate SELECT SQL with aliases', () => {
      const sql = mapper.generateSelectSQL()
      expect(sql).toBe(
        'telegram_id as telegramId, first_name as firstName, created_at as createdAt'
      )
    })

    it('should generate SELECT SQL with table prefix', () => {
      const sql = mapper.generateSelectSQL('u')
      expect(sql).toBe(
        'u.telegram_id as telegramId, u.first_name as firstName, u.created_at as createdAt'
      )
    })

    it('should not alias fields with same name', () => {
      const simpleMapper = new FieldMapper<{ id: number }, { id: number }>([
        { dbField: 'id', domainField: 'id' }
      ])

      const sql = simpleMapper.generateSelectSQL()
      expect(sql).toBe('id')
    })

    it('should generate INSERT SQL components', () => {
      const { fields, placeholders } = mapper.generateInsertSQL()

      expect(fields).toEqual(['telegram_id', 'first_name', 'created_at'])
      expect(placeholders).toEqual(['?', '?', '?'])
    })
  })

  describe('CommonTransformers', () => {
    it('should transform SQLite boolean correctly', () => {
      expect(CommonTransformers.sqliteBoolean.toDomain(1)).toBe(true)
      expect(CommonTransformers.sqliteBoolean.toDomain(0)).toBe(false)
      expect(CommonTransformers.sqliteBoolean.toDb(true)).toBe(1)
      expect(CommonTransformers.sqliteBoolean.toDb(false)).toBe(0)
    })

    it('should transform ISO date strings', () => {
      const dateStr = '2024-01-01T00:00:00.000Z'
      const date = new Date(dateStr)

      const result = CommonTransformers.isoDate.toDomain(dateStr)
      expect(result).toEqual(date)
      expect(CommonTransformers.isoDate.toDb(date)).toBe(dateStr)
    })

    it('should transform Unix timestamps', () => {
      const timestamp = 1704067200 // 2024-01-01 00:00:00 UTC
      const date = new Date(timestamp * 1000)

      const result = CommonTransformers.unixTimestamp.toDomain(timestamp)
      expect(result).toEqual(date)
      expect(CommonTransformers.unixTimestamp.toDb(date)).toBe(timestamp)
    })

    it('should handle JSON transformations', () => {
      const obj = { foo: 'bar', baz: 123 }
      const json = JSON.stringify(obj)

      const transformer = CommonTransformers.json<typeof obj>()
      expect(transformer.toDomain(json)).toEqual(obj)
      expect(transformer.toDb(obj)).toBe(json)
    })

    it('should handle CSV arrays', () => {
      expect(CommonTransformers.csvArray.toDomain('a,b,c')).toEqual(['a', 'b', 'c'])
      expect(CommonTransformers.csvArray.toDomain('a, b, c')).toEqual(['a', 'b', 'c'])
      expect(CommonTransformers.csvArray.toDomain(null)).toEqual([])
      expect(CommonTransformers.csvArray.toDb(['a', 'b', 'c'])).toBe('a,b,c')
    })
  })

  describe('createAutoMapper', () => {
    interface DbRow {
      user_id: number
      first_name: string
      is_premium: number
      created_at: string
    }

    interface Model {
      userId: number
      firstName: string
      isPremium: boolean
      createdAt: Date
    }

    it('should create mapper with automatic snake_case to camelCase conversion', () => {
      const mapper = createAutoMapper<DbRow, Model>(
        ['user_id', 'first_name', 'is_premium', 'created_at'],
        {
          is_premium: CommonTransformers.sqliteBoolean,
          created_at: CommonTransformers.isoDate
        }
      )

      const dbRow: DbRow = {
        user_id: 123,
        first_name: 'Test',
        is_premium: 1,
        created_at: '2024-01-01T00:00:00.000Z'
      }

      const result = mapper.toDomain(dbRow)

      expect(result).toEqual({
        userId: 123,
        firstName: 'Test',
        isPremium: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z')
      })
    })

    it('should allow custom field overrides', () => {
      const mapper = createAutoMapper<{ old_name: string }, { newName: string }>(['old_name'], {
        old_name: { domainField: 'newName' }
      })

      const result = mapper.toDomain({ old_name: 'test' })
      expect(result).toEqual({ newName: 'test' })
    })
  })

  describe('Complex scenarios', () => {
    it('should handle nested transformations', () => {
      interface DbRow {
        id: number
        settings_json: string
        tags: string
      }

      interface Model {
        id: number
        settings: {
          theme: string
          notifications: boolean
        }
        tags: string[]
      }

      const mapper = new FieldMapper<DbRow, Model>([
        { dbField: 'id', domainField: 'id' },
        {
          dbField: 'settings_json',
          domainField: 'settings',
          toDomain: v => JSON.parse(v),
          toDb: v => JSON.stringify(v)
        },
        {
          dbField: 'tags',
          domainField: 'tags',
          toDomain: v => v.split(','),
          toDb: v => v.join(',')
        }
      ])

      const dbRow: DbRow = {
        id: 1,
        settings_json: '{"theme":"dark","notifications":true}',
        tags: 'important,urgent'
      }

      const model = mapper.toDomain(dbRow)
      expect(model).toEqual({
        id: 1,
        settings: { theme: 'dark', notifications: true },
        tags: ['important', 'urgent']
      })

      const backToDb = mapper.toDatabase(model)
      expect(backToDb).toEqual(dbRow)
    })

    it('should get ordered database values', () => {
      const mapper = new FieldMapper<
        { a: number; b: string; c: boolean },
        { a: number; b: string; c: boolean }
      >([
        { dbField: 'a', domainField: 'a' },
        { dbField: 'b', domainField: 'b' },
        { dbField: 'c', domainField: 'c', toDb: v => (v ? 1 : 0) }
      ])

      const values = mapper.getDatabaseValues({ a: 1, b: 'test', c: true })
      expect(values).toEqual([1, 'test', 1])
    })
  })
})
