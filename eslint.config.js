import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import promisePlugin from 'eslint-plugin-promise'
import globals from 'globals'
import dbMappingPlugin from './eslint-rules/index.js'

export default [
  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.wrangler/**',
      '**/migrations/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/coverage/**',
      '**/.husky/**',
      '**/website/**',
      '**/examples/**',
      '**/scripts/**',
      '**/backup/**',
      // Temporarily ignore new connector packages until properly configured
      'packages/connectors/*/src/**'
    ]
  },

  // Base configuration
  js.configs.recommended,

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json', './tsconfig.test.json']
      },
      globals: {
        ...globals.es2022,
        ...globals.node,
        ...globals.worker
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      promise: promisePlugin,
      'db-mapping': dbMappingPlugin
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-function': 'off',

      // General rules
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Using TypeScript's version
      'no-undef': 'off', // TypeScript handles this

      // Import rules
      'import/no-unresolved': 'off', // TypeScript handles this
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always'
        }
      ],

      // Promise rules
      'promise/always-return': 'error',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-native': 'off',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-callback-in-promise': 'warn',
      'promise/avoid-new': 'off',
      'promise/no-new-statics': 'error',
      'promise/no-return-in-finally': 'warn',
      'promise/valid-params': 'warn',

      // Database mapping rules
      'db-mapping/no-snake-case-db-fields': [
        'error',
        {
          allowedPatterns: ['\\.bind\\(', '\\.all\\(', '\\.first\\(', '\\.run\\('],
          databaseRowTypes: ['DatabaseRow', 'DBRow', 'Row', 'DynamoDBRow']
        }
      ],
      'db-mapping/require-boolean-conversion': 'error',
      'db-mapping/require-date-conversion': [
        'error',
        {
          allowNullChecks: true
        }
      ],
      'db-mapping/use-field-mapper': [
        'warn',
        {
          minimumFields: 3
        }
      ]
    }
  },

  // Allow console in specific files
  {
    files: ['**/logger.ts', '**/logger.js'],
    rules: {
      'no-console': 'off'
    }
  },

  // JavaScript files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.es2022,
        ...globals.node,
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        process: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    }
  }
]
