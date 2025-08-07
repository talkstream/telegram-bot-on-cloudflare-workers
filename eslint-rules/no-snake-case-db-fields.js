/**
 * ESLint rule to prevent direct usage of snake_case database fields
 * Enforces usage of field mappers or camelCase properties
 *
 * @example
 * // BAD
 * const userId = row.user_id;
 * const isActive = row.is_active;
 *
 * // GOOD
 * const user = userMapper.toDomain(row);
 * const userId = user.userId;
 * const isActive = user.isActive;
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct access to snake_case database fields',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowedPatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Patterns for allowed snake_case access (e.g., SQL builders)'
          },
          databaseRowTypes: {
            type: 'array',
            items: { type: 'string' },
            default: ['DatabaseRow', 'DBRow', 'Row'],
            description: 'Type names that indicate database row objects'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      snakeCaseAccess:
        "Avoid direct access to snake_case field '{{field}}'. Use a field mapper or camelCase property instead.",
      suggestMapper: 'Consider using a FieldMapper to transform database rows to domain models.'
    }
  },

  create(context) {
    const options = context.options[0] || {}
    const allowedPatterns = options.allowedPatterns || []
    const databaseRowTypes = options.databaseRowTypes || ['DatabaseRow', 'DBRow', 'Row']

    // Check if identifier is snake_case
    function isSnakeCase(name) {
      return /_[a-z]/.test(name)
    }

    // Check if the current scope suggests database context
    function isInDatabaseContext(node) {
      // Check variable name patterns
      const parent = node.parent
      if (parent && parent.type === 'MemberExpression') {
        const objectName = parent.object.name
        if (objectName && /^(row|record|result|dbRow|dbRecord)/.test(objectName)) {
          return true
        }
      }

      // Check type annotations for database row types
      const typeAnnotation = findTypeAnnotation(node)
      if (typeAnnotation && isDatabaseRowType(typeAnnotation)) {
        return true
      }

      return false
    }

    // Find type annotation for a node
    function findTypeAnnotation(node) {
      let current = node
      while (current) {
        if (current.typeAnnotation) {
          return current.typeAnnotation
        }
        current = current.parent
      }
      return null
    }

    // Check if type indicates database row
    function isDatabaseRowType(typeAnnotation) {
      if (typeAnnotation.type === 'TSTypeAnnotation' && typeAnnotation.typeAnnotation) {
        const typeName = getTypeName(typeAnnotation.typeAnnotation)
        return databaseRowTypes.some(dbType => typeName.includes(dbType))
      }
      return false
    }

    // Extract type name from type annotation
    function getTypeName(typeNode) {
      if (typeNode.type === 'TSTypeReference' && typeNode.typeName) {
        if (typeNode.typeName.type === 'Identifier') {
          return typeNode.typeName.name
        }
        if (typeNode.typeName.type === 'TSQualifiedName') {
          return typeNode.typeName.right.name
        }
      }
      return ''
    }

    // Check if access is allowed by patterns
    function isAllowedPattern(node) {
      const sourceCode = context.getSourceCode()
      const text = sourceCode.getText(node)

      return allowedPatterns.some(pattern => {
        const regex = new RegExp(pattern)
        return regex.test(text)
      })
    }

    return {
      MemberExpression(node) {
        if (node.property && node.property.type === 'Identifier') {
          const propertyName = node.property.name

          if (isSnakeCase(propertyName) && isInDatabaseContext(node) && !isAllowedPattern(node)) {
            context.report({
              node: node.property,
              messageId: 'snakeCaseAccess',
              data: {
                field: propertyName
              }
            })
          }
        }
      },

      // Also check destructuring patterns
      ObjectPattern(node) {
        node.properties.forEach(prop => {
          if (
            prop.type === 'Property' &&
            prop.key.type === 'Identifier' &&
            isSnakeCase(prop.key.name) &&
            isInDatabaseContext(node)
          ) {
            context.report({
              node: prop.key,
              messageId: 'snakeCaseAccess',
              data: {
                field: prop.key.name
              }
            })
          }
        })
      }
    }
  }
}
