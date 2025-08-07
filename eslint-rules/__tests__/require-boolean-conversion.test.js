import { RuleTester } from 'eslint'
import rule from '../require-boolean-conversion.js'

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

ruleTester.run('require-boolean-conversion', rule, {
  valid: [
    // Proper boolean conversion
    {
      code: 'const isActive = row.is_active === 1;'
    },
    {
      code: 'const isDisabled = row.is_active === 0;'
    },
    {
      code: 'if (row.has_access === 1) { }'
    },
    // Boolean field in non-database context
    {
      code: 'const isReady = config.is_ready;'
    },
    // Inside mapper transformation
    {
      code: `
        const mapper = new FieldMapper([
          {
            dbField: 'is_active',
            domainField: 'isActive',
            toDomain: (v) => v === 1,
          }
        ]);
      `
    }
  ],

  invalid: [
    // Missing boolean conversion
    {
      code: 'const isActive = row.is_active;',
      errors: [
        {
          messageId: 'missingBooleanConversion',
          data: { field: 'is_active' }
        }
      ],
      output: 'const isActive = row.is_active === 1;'
    },
    // Boolean field in condition without conversion
    {
      code: 'if (row.has_access) { }',
      errors: [
        {
          messageId: 'missingBooleanConversion',
          data: { field: 'has_access' }
        }
      ],
      output: 'if (row.has_access === 1) { }'
    },
    // Using loose equality
    {
      code: 'const isActive = row.is_active == 1;',
      errors: [
        {
          messageId: 'useStrictEquality',
          data: { operator: '==' }
        }
      ],
      output: 'const isActive = row.is_active === 1;'
    },
    // Assignment without conversion
    {
      code: 'user.isBlocked = dbRow.is_blocked;',
      errors: [
        {
          messageId: 'missingBooleanConversion',
          data: { field: 'is_blocked' }
        }
      ],
      output: 'user.isBlocked = dbRow.is_blocked === 1;'
    },
    // Multiple boolean fields
    {
      code: 'const status = { active: row.is_active, visible: row.is_visible };',
      errors: [
        {
          messageId: 'missingBooleanConversion',
          data: { field: 'is_active' }
        },
        {
          messageId: 'missingBooleanConversion',
          data: { field: 'is_visible' }
        }
      ]
    }
  ]
})
