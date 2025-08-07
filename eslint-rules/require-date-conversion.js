/**
 * ESLint rule to enforce proper date conversion for database timestamp fields
 * Database stores dates as ISO strings, this rule ensures proper conversion to Date objects
 *
 * @example
 * // BAD
 * const createdAt = row.created_at;
 * const date = user.updated_at;
 * if (row.deleted_at) { }
 *
 * // GOOD
 * const createdAt = new Date(row.created_at);
 * const date = new Date(user.updated_at);
 * if (row.deleted_at) { } // OK - checking for null/undefined
 * const deletedAt = row.deleted_at ? new Date(row.deleted_at) : null;
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explicit date conversion for database timestamp fields',
      category: 'Best Practices',
      recommended: true
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          dateFieldPatterns: {
            type: 'array',
            items: { type: 'string' },
            default: ['*_at', '*_date', '*_time', 'timestamp*', 'date_*', 'time_*'],
            description: 'Patterns that indicate date/time fields (supports wildcards)'
          },
          allowNullChecks: {
            type: 'boolean',
            default: true,
            description: 'Allow date fields in null/undefined checks without conversion'
          },
          databaseContextPatterns: {
            type: 'array',
            items: { type: 'string' },
            default: ['row', 'record', 'result', 'dbRow', 'dbRecord'],
            description: 'Variable name patterns indicating database context'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      missingDateConversion:
        "Database date field '{{field}}' should be converted to Date object using 'new Date()'",
      stringDateUsage:
        'Avoid using database date string directly. Convert to Date object for proper date handling.'
    }
  },

  create(context) {
    const options = context.options[0] || {}
    const dateFieldPatterns = options.dateFieldPatterns || [
      '*_at',
      '*_date',
      '*_time',
      'timestamp*',
      'date_*',
      'time_*'
    ]
    const allowNullChecks = options.allowNullChecks !== false
    const dbContextPatterns = options.databaseContextPatterns || [
      'row',
      'record',
      'result',
      'dbRow',
      'dbRecord'
    ]

    // Convert wildcard patterns to regex
    function patternToRegex(pattern) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = escaped.replace(/\\\*/g, '.*')
      return new RegExp(`^${regex}$`)
    }

    // Check if field name indicates date/time
    function isDateField(name) {
      return dateFieldPatterns.some(pattern => {
        const regex = patternToRegex(pattern)
        return regex.test(name)
      })
    }

    // Check if we're in database context
    function isInDatabaseContext(node) {
      if (node.parent && node.parent.type === 'MemberExpression') {
        const objectName = node.parent.object.name
        return (
          objectName &&
          dbContextPatterns.some(pattern => new RegExp(`^${pattern}`, 'i').test(objectName))
        )
      }
      return false
    }

    // Check if node has proper date conversion
    function hasProperDateConversion(node) {
      const parent = node.parent

      // Check if it's wrapped in new Date()
      if (parent && parent.type === 'NewExpression') {
        return parent.callee.name === 'Date' && parent.arguments[0] === node
      }

      // Check if it's in a conditional for null check
      if (allowNullChecks && isInNullCheck(node)) {
        return true
      }

      // Check if it's in a mapper transformation
      if (isInMapperTransformation(node)) {
        return true
      }

      // Check if it's being passed to a date parsing function
      if (parent && parent.type === 'CallExpression') {
        const callee = parent.callee
        if (callee.type === 'Identifier' && ['parseISO', 'parse', 'toDate'].includes(callee.name)) {
          return true
        }
      }

      return false
    }

    // Check if node is in a null/undefined check
    function isInNullCheck(node) {
      const parent = node.parent

      // Direct conditional: if (row.created_at)
      if (parent && parent.type === 'IfStatement' && parent.test === node) {
        return true
      }

      // Ternary condition: row.created_at ? ... : ...
      if (parent && parent.type === 'ConditionalExpression' && parent.test === node) {
        return true
      }

      // Logical expressions: row.created_at && ..., row.created_at || ...
      if (parent && parent.type === 'LogicalExpression' && parent.left === node) {
        return true
      }

      // Equality null check: row.created_at === null, row.created_at == null
      if (
        parent &&
        parent.type === 'BinaryExpression' &&
        ['===', '!==', '==', '!='].includes(parent.operator)
      ) {
        const other = parent.left === node ? parent.right : parent.left
        return other.type === 'Literal' && (other.value === null || other.value === undefined)
      }

      return false
    }

    // Check if node is inside a mapper transformation
    function isInMapperTransformation(node) {
      let current = node
      while (current) {
        // Check for transformation functions
        if (
          current.type === 'Property' &&
          (current.key.name === 'toDomain' || current.key.name === 'toDb')
        ) {
          return true
        }

        // Check for common date transformers
        if (current.type === 'MemberExpression' && current.property.name === 'isoDate') {
          return true
        }

        current = current.parent
      }
      return false
    }

    return {
      MemberExpression(node) {
        if (
          node.property &&
          node.property.type === 'Identifier' &&
          isDateField(node.property.name) &&
          isInDatabaseContext(node) &&
          !hasProperDateConversion(node)
        ) {
          // Special case: allow in return statements of date getter functions
          let parent = node.parent
          while (
            parent &&
            parent.type !== 'FunctionDeclaration' &&
            parent.type !== 'ArrowFunctionExpression'
          ) {
            if (parent.type === 'ReturnStatement') {
              // Check if function name suggests date getter
              const func = parent.parent
              if (func && func.parent && func.parent.type === 'MethodDefinition') {
                const methodName = func.parent.key.name
                if (methodName.startsWith('get') && isDateField(methodName.slice(3))) {
                  return // Allow raw return in getter
                }
              }
            }
            parent = parent.parent
          }

          context.report({
            node,
            messageId: 'missingDateConversion',
            data: {
              field: node.property.name
            },
            fix(fixer) {
              const sourceCode = context.getSourceCode()
              const nodeText = sourceCode.getText(node)

              // Don't auto-fix if in a complex expression
              if (
                node.parent.type === 'MemberExpression' ||
                node.parent.type === 'CallExpression'
              ) {
                return null
              }

              return fixer.replaceText(node, `new Date(${nodeText})`)
            }
          })
        }
      },

      // Check assignments to ensure dates aren't stored as strings
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.property &&
          isDateField(node.left.property.name) &&
          node.right.type === 'MemberExpression' &&
          node.right.property &&
          isDateField(node.right.property.name) &&
          !hasProperDateConversion(node.right)
        ) {
          context.report({
            node: node.right,
            messageId: 'stringDateUsage'
          })
        }
      }
    }
  }
}
