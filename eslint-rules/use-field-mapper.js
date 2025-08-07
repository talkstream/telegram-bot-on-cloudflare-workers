/**
 * ESLint rule to encourage using FieldMapper for database transformations
 * Detects manual field mapping and suggests using the FieldMapper utility
 *
 * @example
 * // BAD - Manual mapping
 * function mapUser(row) {
 *   return {
 *     userId: row.user_id,
 *     firstName: row.first_name,
 *     isActive: row.is_active === 1,
 *     createdAt: new Date(row.created_at)
 *   };
 * }
 *
 * // GOOD - Using FieldMapper
 * const userMapper = new FieldMapper([...]);
 * const user = userMapper.toDomain(row);
 */

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Suggest using FieldMapper for database field transformations',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          minimumFields: {
            type: 'number',
            default: 3,
            description: 'Minimum number of fields to trigger the suggestion'
          },
          mapperImportPath: {
            type: 'string',
            default: '@/core/database/field-mapper',
            description: 'Import path for FieldMapper'
          },
          ignorePatterns: {
            type: 'array',
            items: { type: 'string' },
            default: ['test', 'mock', 'stub'],
            description: 'Function name patterns to ignore'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      useFieldMapper:
        'Consider using FieldMapper instead of manual field mapping. Found {{count}} field transformations.',
      duplicateMapping:
        'This mapping logic appears to be duplicated. Consider creating a shared FieldMapper.'
    }
  },

  create(context) {
    const options = context.options[0] || {}
    const minimumFields = options.minimumFields || 3
    const ignorePatterns = options.ignorePatterns || ['test', 'mock', 'stub']
    const fieldMappingPatterns = []

    // Check if function name should be ignored
    function shouldIgnoreFunction(name) {
      if (!name) return false
      const lowerName = name.toLowerCase()
      return ignorePatterns.some(pattern => lowerName.includes(pattern))
    }

    // Detect if a property is a field mapping
    function isFieldMapping(property) {
      if (property.type !== 'Property' || property.computed) {
        return false
      }

      const key = property.key.name
      const value = property.value

      // Check for snake_case to camelCase transformation
      if (value.type === 'MemberExpression' && value.property) {
        const sourceField = value.property.name
        if (isSnakeToCamelMapping(sourceField, key)) {
          return { type: 'rename', source: sourceField, target: key }
        }
      }

      // Check for boolean conversion (row.is_active === 1)
      if (
        value.type === 'BinaryExpression' &&
        value.operator === '===' &&
        value.right.type === 'Literal' &&
        [0, 1].includes(value.right.value) &&
        value.left.type === 'MemberExpression'
      ) {
        return { type: 'boolean', source: value.left.property.name, target: key }
      }

      // Check for date conversion (new Date(row.created_at))
      if (
        value.type === 'NewExpression' &&
        value.callee.name === 'Date' &&
        value.arguments[0] &&
        value.arguments[0].type === 'MemberExpression'
      ) {
        return { type: 'date', source: value.arguments[0].property.name, target: key }
      }

      // Check for conditional mapping (row.field ? transform(row.field) : null)
      if (value.type === 'ConditionalExpression' && value.test.type === 'MemberExpression') {
        return { type: 'conditional', source: value.test.property.name, target: key }
      }

      return false
    }

    // Check if source field maps to target using snake_case to camelCase
    function isSnakeToCamelMapping(source, target) {
      if (!source || !target) return false
      const expectedCamelCase = source.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      return expectedCamelCase === target
    }

    // Analyze function for mapping patterns
    function analyzeMappingFunction(node) {
      const functionName = node.id ? node.id.name : '<anonymous>'

      if (shouldIgnoreFunction(functionName)) {
        return
      }

      // Look for return statements with object expressions
      const returnStatements = []
      findReturnStatements(node.body, returnStatements)

      returnStatements.forEach(returnStmt => {
        if (returnStmt.argument && returnStmt.argument.type === 'ObjectExpression') {
          const mappings = []
          returnStmt.argument.properties.forEach(prop => {
            const mapping = isFieldMapping(prop)
            if (mapping) {
              mappings.push(mapping)
            }
          })

          if (mappings.length >= minimumFields) {
            const signature = createMappingSignature(mappings)

            // Check for duplicate mapping patterns
            if (fieldMappingPatterns.some(pattern => pattern.signature === signature)) {
              context.report({
                node: returnStmt.argument,
                messageId: 'duplicateMapping'
              })
            } else {
              fieldMappingPatterns.push({ signature, node: returnStmt.argument })

              context.report({
                node: returnStmt.argument,
                messageId: 'useFieldMapper',
                data: {
                  count: mappings.length
                }
              })
            }
          }
        }
      })
    }

    // Find all return statements in a function
    function findReturnStatements(node, returns, visited = new Set()) {
      if (!node || visited.has(node)) return
      visited.add(node)

      if (node.type === 'ReturnStatement') {
        returns.push(node)
        return
      }

      // Don't traverse into nested functions
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        return
      }

      // Traverse child nodes - only standard AST properties
      const astKeys = [
        'body',
        'consequent',
        'alternate',
        'init',
        'test',
        'update',
        'argument',
        'arguments',
        'callee',
        'expression',
        'expressions',
        'left',
        'right',
        'object',
        'property',
        'properties',
        'elements',
        'value',
        'cases',
        'discriminant',
        'block',
        'handler',
        'finalizer'
      ]

      for (const key of astKeys) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(child => findReturnStatements(child, returns, visited))
          } else {
            findReturnStatements(node[key], returns, visited)
          }
        }
      }
    }

    // Create a signature for mapping pattern comparison
    function createMappingSignature(mappings) {
      return mappings
        .map(m => `${m.type}:${m.source}→${m.target}`)
        .sort()
        .join('|')
    }

    return {
      FunctionDeclaration: analyzeMappingFunction,
      FunctionExpression: analyzeMappingFunction,
      ArrowFunctionExpression: analyzeMappingFunction,

      // Also check object methods
      MethodDefinition(node) {
        if (node.value) {
          analyzeMappingFunction(node.value)
        }
      },

      // Check inline object transformations
      CallExpression(node) {
        // Detect patterns like: rows.map(row => ({ ... }))
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'map' &&
          node.arguments[0] &&
          (node.arguments[0].type === 'ArrowFunctionExpression' ||
            node.arguments[0].type === 'FunctionExpression')
        ) {
          const mapFunction = node.arguments[0]
          if (mapFunction.body.type === 'ObjectExpression') {
            const mappings = []

            mapFunction.body.properties.forEach(prop => {
              const mapping = isFieldMapping(prop)
              if (mapping) {
                mappings.push(mapping)
              }
            })

            if (mappings.length >= minimumFields) {
              context.report({
                node: mapFunction.body,
                messageId: 'useFieldMapper',
                data: {
                  count: mappings.length
                }
              })
            }
          }
        }
      }
    }
  }
}
