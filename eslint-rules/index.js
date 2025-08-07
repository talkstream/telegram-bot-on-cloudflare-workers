/**
 * Custom ESLint rules for database field mapping
 *
 * These rules help prevent common errors when working with database fields:
 * - Enforce proper conversion between snake_case and camelCase
 * - Ensure boolean fields are properly converted from 0/1
 * - Require date strings to be converted to Date objects
 * - Encourage using FieldMapper for consistent transformations
 */

// Load rules synchronously for now
import noSnakeCaseDbFields from './no-snake-case-db-fields.js'
import requireBooleanConversion from './require-boolean-conversion.js'
import requireDateConversion from './require-date-conversion.js'
import useFieldMapper from './use-field-mapper.js'

const plugin = {
  rules: {
    'no-snake-case-db-fields': noSnakeCaseDbFields,
    'require-boolean-conversion': requireBooleanConversion,
    'require-date-conversion': requireDateConversion,
    'use-field-mapper': useFieldMapper
  },

  configs: {
    recommended: {
      plugins: ['db-mapping'],
      rules: {
        'db-mapping/no-snake-case-db-fields': 'error',
        'db-mapping/require-boolean-conversion': 'error',
        'db-mapping/require-date-conversion': 'error',
        'db-mapping/use-field-mapper': 'warn'
      }
    },
    strict: {
      plugins: ['db-mapping'],
      rules: {
        'db-mapping/no-snake-case-db-fields': [
          'error',
          {
            databaseRowTypes: ['DatabaseRow', 'DBRow', 'Row', 'Record']
          }
        ],
        'db-mapping/require-boolean-conversion': [
          'error',
          {
            booleanPrefixes: [
              'is_',
              'has_',
              'can_',
              'should_',
              'will_',
              'did_',
              'was_',
              'are_',
              'does_',
              'do_'
            ],
            booleanSuffixes: [
              '_enabled',
              '_disabled',
              '_active',
              '_inactive',
              '_visible',
              '_hidden',
              '_required',
              '_optional'
            ]
          }
        ],
        'db-mapping/require-date-conversion': [
          'error',
          {
            dateFieldPatterns: [
              '*_at',
              '*_date',
              '*_time',
              'timestamp*',
              'date_*',
              'time_*',
              'expires_*',
              'started_*',
              'ended_*'
            ],
            allowNullChecks: true
          }
        ],
        'db-mapping/use-field-mapper': [
          'error',
          {
            minimumFields: 2
          }
        ]
      }
    }
  }
}

export default plugin
