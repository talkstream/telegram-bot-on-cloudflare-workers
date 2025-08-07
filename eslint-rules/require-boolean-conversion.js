/**
 * ESLint rule to enforce proper boolean conversion for SQLite database fields
 * SQLite stores booleans as 0/1, this rule ensures proper conversion
 *
 * @example
 * // BAD
 * const isActive = row.is_active;
 * if (row.has_access) { }
 * user.isBlocked = dbRow.is_blocked;
 *
 * // GOOD
 * const isActive = row.is_active === 1;
 * if (row.has_access === 1) { }
 * user.isBlocked = dbRow.is_blocked === 1;
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explicit boolean conversion for SQLite boolean fields',
      category: 'Best Practices',
      recommended: true
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          booleanPrefixes: {
            type: 'array',
            items: { type: 'string' },
            default: ['is_', 'has_', 'can_', 'should_', 'will_', 'did_', 'was_', 'are_'],
            description: 'Prefixes that indicate boolean fields'
          },
          booleanSuffixes: {
            type: 'array',
            items: { type: 'string' },
            default: ['_enabled', '_disabled', '_active', '_inactive', '_visible', '_hidden'],
            description: 'Suffixes that indicate boolean fields'
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
      missingBooleanConversion:
        "SQLite boolean field '{{field}}' must be explicitly converted using '=== 1' or '=== 0'",
      useStrictEquality: 'Use strict equality (===) for boolean conversion instead of {{operator}}'
    }
  },

  create(context) {
    const options = context.options[0] || {}
    const booleanPrefixes = options.booleanPrefixes || [
      'is_',
      'has_',
      'can_',
      'should_',
      'will_',
      'did_',
      'was_',
      'are_'
    ]
    const booleanSuffixes = options.booleanSuffixes || [
      '_enabled',
      '_disabled',
      '_active',
      '_inactive',
      '_visible',
      '_hidden'
    ]
    const dbContextPatterns = options.databaseContextPatterns || [
      'row',
      'record',
      'result',
      'dbRow',
      'dbRecord'
    ]

    // Check if field name indicates boolean
    function isBooleanField(name) {
      const hasPrefix = booleanPrefixes.some(prefix => name.startsWith(prefix))
      const hasSuffix = booleanSuffixes.some(suffix => name.endsWith(suffix))
      return hasPrefix || hasSuffix
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

    // Check if node has proper boolean conversion
    function hasProperBooleanConversion(node) {
      const parent = node.parent

      // Check if it's part of a comparison
      if (parent && parent.type === 'BinaryExpression') {
        const isComparison = ['===', '!=='].includes(parent.operator)
        const hasNumericLiteral =
          (parent.left === node &&
            parent.right.type === 'Literal' &&
            [0, 1].includes(parent.right.value)) ||
          (parent.right === node &&
            parent.left.type === 'Literal' &&
            [0, 1].includes(parent.left.value))

        return isComparison && hasNumericLiteral
      }

      // Check if it's being converted in a ternary
      if (parent && parent.type === 'ConditionalExpression' && parent.test === node) {
        // Allow in ternary test position if the result is boolean
        return false // Still report for consistency
      }

      // Check if it's in a field mapper transformation
      if (isInMapperTransformation(node)) {
        return true
      }

      return false
    }

    // Check if node is inside a mapper transformation
    function isInMapperTransformation(node) {
      let current = node
      while (current) {
        // Check for mapper patterns
        if (current.type === 'CallExpression') {
          const callee = current.callee
          if (callee.type === 'MemberExpression' && callee.property.name === 'toDomain') {
            return true
          }
        }

        // Check for transformation functions
        if (
          current.type === 'Property' &&
          (current.key.name === 'toDomain' || current.key.name === 'toDb')
        ) {
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
          isBooleanField(node.property.name) &&
          isInDatabaseContext(node) &&
          !hasProperBooleanConversion(node)
        ) {
          context.report({
            node,
            messageId: 'missingBooleanConversion',
            data: {
              field: node.property.name
            },
            fix(fixer) {
              return fixer.replaceText(node, `${context.getSourceCode().getText(node)} === 1`)
            }
          })
        }
      },

      // Check loose equality operators
      BinaryExpression(node) {
        if (['==', '!='].includes(node.operator)) {
          const left = node.left
          const right = node.right

          // Check if comparing boolean field with number
          const isBooleanComparison =
            (left.type === 'MemberExpression' &&
              left.property &&
              isBooleanField(left.property.name) &&
              right.type === 'Literal' &&
              [0, 1].includes(right.value)) ||
            (right.type === 'MemberExpression' &&
              right.property &&
              isBooleanField(right.property.name) &&
              left.type === 'Literal' &&
              [0, 1].includes(left.value))

          if (isBooleanComparison) {
            context.report({
              node,
              messageId: 'useStrictEquality',
              data: {
                operator: node.operator
              },
              fix(fixer) {
                const newOperator = node.operator === '==' ? '===' : '!=='
                return fixer.replaceText(
                  node,
                  `${context.getSourceCode().getText(left)} ${newOperator} ${context.getSourceCode().getText(right)}`
                )
              }
            })
          }
        }
      }
    }
  }
}
