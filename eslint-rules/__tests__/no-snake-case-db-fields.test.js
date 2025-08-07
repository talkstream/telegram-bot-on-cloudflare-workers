import { RuleTester } from 'eslint'
import rule from '../no-snake-case-db-fields.js'

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

ruleTester.run('no-snake-case-db-fields', rule, {
  valid: [
    // Accessing camelCase properties is fine
    {
      code: 'const id = user.userId;'
    },
    // Snake case in non-database context is fine
    {
      code: 'const MY_CONSTANT = some_function();'
    },
    // Snake case in SQL strings is fine
    {
      code: 'const query = "SELECT user_id FROM users";'
    },
    // Using a mapper is the recommended approach
    {
      code: 'const user = userMapper.toDomain(row);'
    },
    // Allowed patterns
    {
      code: 'db.prepare("SELECT user_id FROM users").bind(row.user_id)',
      options: [
        {
          allowedPatterns: ['\\.bind\\(.*\\)']
        }
      ]
    }
  ],

  invalid: [
    // Direct access to snake_case fields
    {
      code: 'const userId = row.user_id;',
      errors: [
        {
          messageId: 'snakeCaseAccess',
          data: { field: 'user_id' }
        }
      ]
    },
    // Destructuring snake_case fields
    {
      code: 'const { user_id, first_name } = row;',
      errors: [
        {
          messageId: 'snakeCaseAccess',
          data: { field: 'user_id' }
        },
        {
          messageId: 'snakeCaseAccess',
          data: { field: 'first_name' }
        }
      ]
    },
    // Accessing nested snake_case
    {
      code: 'const name = result.first_name;',
      errors: [
        {
          messageId: 'snakeCaseAccess',
          data: { field: 'first_name' }
        }
      ]
    },
    // Database record patterns
    {
      code: 'const active = dbRow.is_active;',
      errors: [
        {
          messageId: 'snakeCaseAccess',
          data: { field: 'is_active' }
        }
      ]
    }
  ]
})
