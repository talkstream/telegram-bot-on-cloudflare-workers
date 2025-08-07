#!/usr/bin/env tsx
/**
 * CLI tool for generating TypeScript types from SQL schema
 * Standalone version with all code in one file
 * Usage: npm run db:types
 */

import { writeFile as fsWriteFile, mkdir, readdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import chalk from 'chalk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..')

// Types
interface ColumnDefinition {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  isPrimaryKey: boolean
  isUnique: boolean
  isAutoIncrement: boolean
}

interface TableDefinition {
  name: string
  columns: ColumnDefinition[]
}

interface GeneratorOptions {
  booleanPrefixes: string[]
  booleanSuffixes: string[]
  datePatterns: string[]
  optionalForNullable: boolean
}

const defaultOptions: GeneratorOptions = {
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
  ],
  datePatterns: ['_at', '_date', '_time', 'timestamp', 'expires_', 'started_', 'ended_'],
  optionalForNullable: true
}

// SQL Parser
class SQLParser {
  parse(sqlContent: string): TableDefinition[] {
    const tables: TableDefinition[] = []
    const cleanedSql = this.removeComments(sqlContent)
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi
    let match

    while ((match = createTableRegex.exec(cleanedSql)) !== null) {
      const tableName = match[1]
      const tableBody = match[2]
      if (tableName && tableBody) {
        const columns = this.parseColumns(tableBody)

        tables.push({
          name: tableName,
          columns
        })
      }
    }

    return tables
  }

  private removeComments(sql: string): string {
    sql = sql.replace(/--.*$/gm, '')
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '')
    return sql
  }

  private parseColumns(tableBody: string): ColumnDefinition[] {
    const columns: ColumnDefinition[] = []
    const parts = this.splitByComma(tableBody)

    for (const part of parts) {
      const trimmed = part.trim()
      if (this.isTableConstraint(trimmed)) continue

      const column = this.parseColumnDefinition(trimmed)
      if (column) columns.push(column)
    }

    return columns
  }

  private splitByComma(str: string): string[] {
    const parts: string[] = []
    let current = ''
    let depth = 0

    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if (char === '(') depth++
      else if (char === ')') depth--
      else if (char === ',' && depth === 0) {
        parts.push(current)
        current = ''
        continue
      }
      current += char
    }

    if (current) parts.push(current)
    return parts
  }

  private isTableConstraint(line: string): boolean {
    const constraintKeywords = [
      'PRIMARY\\s+KEY',
      'FOREIGN\\s+KEY',
      'UNIQUE\\s*\\(',
      'CHECK\\s*\\(',
      'INDEX',
      'CONSTRAINT'
    ]
    const regex = new RegExp(`^\\s*(${constraintKeywords.join('|')})`, 'i')
    return regex.test(line)
  }

  private parseColumnDefinition(definition: string): ColumnDefinition | null {
    const match = definition.match(/^\s*(\w+)\s+(\w+(?:\([^)]+\))?)(.*)/)
    if (!match) return null

    const [, name, type, constraintsStr] = match
    if (!name || !type) return null

    const constraints = (constraintsStr || '').toUpperCase()

    return {
      name,
      type: type.toUpperCase(),
      nullable: !constraints.includes('NOT NULL'),
      defaultValue: this.extractDefault(constraintsStr || ''),
      isPrimaryKey: constraints.includes('PRIMARY KEY'),
      isUnique: constraints.includes('UNIQUE'),
      isAutoIncrement: constraints.includes('AUTOINCREMENT')
    }
  }

  private extractDefault(constraints: string): string | undefined {
    const match = constraints.match(/DEFAULT\s+([^,\s]+)/i)
    if (match && match[1]) {
      let value = match[1]
      if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
      ) {
        value = value.slice(1, -1)
      }
      return value
    }
    return undefined
  }
}

// Main functions
async function parseSQLFiles(sqlFiles: string[]): Promise<TableDefinition[]> {
  const parser = new SQLParser()
  const allTables: TableDefinition[] = []

  for (const file of sqlFiles) {
    try {
      const content = await readFile(file, 'utf-8')
      const tables = parser.parse(content)
      allTables.push(...tables)
    } catch (error) {
      console.error(`Error parsing ${file}:`, error)
    }
  }

  const uniqueTables = new Map<string, TableDefinition>()
  for (const table of allTables) {
    uniqueTables.set(table.name, table)
  }

  return Array.from(uniqueTables.values())
}

// Helper functions
function toCamelCase(snakeCase: string): string {
  return snakeCase.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function toPascalCase(snakeCase: string): string {
  return snakeCase
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

// Generate database types
function generateDatabaseTypes(tables: TableDefinition[]): string {
  const interfaces: string[] = []

  for (const table of tables) {
    const interfaceName = `${toPascalCase(table.name)}DatabaseRow`
    const fields = table.columns.map(col => {
      const optional = col.nullable && defaultOptions.optionalForNullable ? '?' : ''
      const type = sqlTypeToTsType(col.type, false)
      return `  ${col.name}${optional}: ${type};`
    })

    interfaces.push(`export interface ${interfaceName} {\n${fields.join('\n')}\n}`)
  }

  return `/**
 * Generated database types from SQL schema
 * DO NOT EDIT MANUALLY - Generated by db:types command
 */

${interfaces.join('\n\n')}
`
}

// Generate domain types
function generateDomainTypes(tables: TableDefinition[]): string {
  const interfaces: string[] = []

  for (const table of tables) {
    const interfaceName = toPascalCase(table.name).replace(/s$/, '')
    const fields = table.columns.map(col => {
      const fieldName = toCamelCase(col.name)
      const optional = col.nullable && defaultOptions.optionalForNullable ? '?' : ''
      const type = getDomainType(col)
      return `  ${fieldName}${optional}: ${type};`
    })

    interfaces.push(`export interface ${interfaceName} {\n${fields.join('\n')}\n}`)
  }

  return `/**
 * Generated domain model types from SQL schema
 * DO NOT EDIT MANUALLY - Generated by db:types command
 */

${interfaces.join('\n\n')}
`
}

// SQL to TypeScript type conversion
function sqlTypeToTsType(sqlType: string, forDomain: boolean): string {
  const upperType = sqlType.toUpperCase()
  const baseType = upperType.replace(/\([^)]+\)/, '')

  switch (baseType) {
    case 'INTEGER':
    case 'INT':
    case 'SMALLINT':
    case 'BIGINT':
    case 'NUMERIC':
    case 'DECIMAL':
    case 'REAL':
    case 'DOUBLE':
    case 'FLOAT':
      return 'number'
    case 'TEXT':
    case 'VARCHAR':
    case 'CHAR':
    case 'BLOB':
    case 'CLOB':
      return 'string'
    case 'BOOLEAN':
    case 'BOOL':
      return forDomain ? 'boolean' : 'number'
    case 'DATE':
    case 'DATETIME':
    case 'TIMESTAMP':
      return forDomain ? 'Date' : 'string'
    case 'JSON':
    case 'JSONB':
      return 'any'
    default:
      return 'any'
  }
}

// Get domain type for column
function getDomainType(column: ColumnDefinition): string {
  if (isBooleanField(column.name)) return 'boolean'
  if (isDateField(column.name) || isDateType(column.type)) return 'Date'
  return sqlTypeToTsType(column.type, true)
}

// Check field patterns
function isBooleanField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase()
  return (
    defaultOptions.booleanPrefixes.some(p => lower.startsWith(p)) ||
    defaultOptions.booleanSuffixes.some(s => lower.endsWith(s))
  )
}

function isDateField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase()
  return defaultOptions.datePatterns.some(p => lower.includes(p))
}

function isDateType(sqlType: string): boolean {
  const dateTypes = ['DATE', 'DATETIME', 'TIMESTAMP']
  return dateTypes.includes(sqlType.toUpperCase().replace(/\([^)]+\)/, ''))
}

// Generate mapper configurations
function generateMappers(tables: TableDefinition[]): string {
  const mappers = tables
    .map(table => {
      const dbTypeName = `${toPascalCase(table.name)}DatabaseRow`
      const domainTypeName = toPascalCase(table.name).replace(/s$/, '')
      const mapperName = `${domainTypeName.charAt(0).toLowerCase()}${domainTypeName.slice(1)}Mapper`

      const mappings = table.columns
        .map(col => {
          const dbField = col.name
          const domainField = toCamelCase(dbField)
          let transformer = null

          if (isBooleanField(col.name)) {
            transformer = 'CommonTransformers.sqliteBoolean'
          } else if (isDateField(col.name) || isDateType(col.type)) {
            transformer = 'CommonTransformers.isoDate'
          } else if (col.type.toUpperCase().startsWith('JSON')) {
            transformer = 'CommonTransformers.json()'
          }

          if (transformer) {
            return `  {\n    dbField: '${dbField}',\n    domainField: '${domainField}',\n    ...${transformer}\n  }`
          }
          return `  { dbField: '${dbField}', domainField: '${domainField}' }`
        })
        .join(',\n')

      return `export const ${mapperName} = new FieldMapper<DB.${dbTypeName}, Domain.${domainTypeName}>([\n${mappings}\n]);`
    })
    .join('\n\n')

  return `/**
 * Generated FieldMapper configurations from SQL schema
 * DO NOT EDIT MANUALLY - Generated by db:types command
 */

import { FieldMapper, CommonTransformers } from '@/core/database/field-mapper';
import type * as DB from '../types/generated/database';
import type * as Domain from '../types/generated/models';

${mappers}
`
}

// CLI interface
interface CLIOptions {
  input: string
  output: string
  tables?: string[]
  watch: boolean
  dryRun: boolean
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2)
  const options: CLIOptions = {
    input: './migrations',
    output: './src/types/generated',
    watch: false,
    dryRun: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--input' && args[i + 1]) {
      const inputArg = args[++i]
      if (inputArg) options.input = inputArg
    } else if (arg === '--output' && args[i + 1]) {
      const outputArg = args[++i]
      if (outputArg) options.output = outputArg
    } else if (arg === '--tables' && args[i + 1]) {
      const tableArg = args[++i]
      if (tableArg) {
        options.tables = tableArg.split(',')
      }
    } else if (arg === '--watch') {
      options.watch = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

function printHelp() {
  console.info(`
${chalk.bold('Database Type Generator')}

Generate TypeScript types from SQL schema files.

${chalk.bold('Usage:')}
  npm run db:types [options]

${chalk.bold('Options:')}
  --input <dir>     Input directory with SQL files (default: ./migrations)
  --output <dir>    Output directory for generated types (default: ./src/types/generated)
  --tables <list>   Comma-separated list of tables to generate (default: all)
  --watch          Watch for changes and regenerate
  --dry-run        Show what would be generated without writing files
  --help, -h       Show this help message

${chalk.bold('Examples:')}
  npm run db:types
  npm run db:types -- --input=./schema --output=./src/types
  npm run db:types -- --tables=users,posts --watch
`)
}

async function findSQLFiles(dir: string): Promise<string[]> {
  const fullPath = join(rootDir, dir)
  const entries = await readdir(fullPath, { withFileTypes: true })

  const sqlFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => join(fullPath, entry.name))
    .sort()

  return sqlFiles
}

async function writeFile(path: string, content: string, dryRun: boolean) {
  const fullPath = join(rootDir, path)

  if (dryRun) {
    console.info(chalk.yellow(`[DRY RUN] Would write to: ${path}`))
    console.info(chalk.gray('Content preview:'))
    console.info(content.split('\n').slice(0, 10).join('\n'))
    console.info(chalk.gray('...'))
    return
  }

  await mkdir(dirname(fullPath), { recursive: true })
  await fsWriteFile(fullPath, content, 'utf-8')
  console.info(chalk.green(`✓ Generated: ${path}`))
}

async function generate(options: CLIOptions) {
  console.info(chalk.bold('\n🔧 Generating TypeScript types from SQL schema...\n'))

  try {
    // Find SQL files
    const sqlFiles = await findSQLFiles(options.input)
    if (sqlFiles.length === 0) {
      console.error(chalk.red(`No SQL files found in ${options.input}`))
      process.exit(1)
    }

    console.info(chalk.blue(`Found ${sqlFiles.length} SQL files:`))
    sqlFiles.forEach(file => {
      console.info(chalk.gray(`  - ${file.replace(rootDir, '.')}`))
    })

    // Parse SQL files
    console.info(chalk.blue('\nParsing SQL files...'))
    let tables = await parseSQLFiles(sqlFiles)

    // Filter tables if specified
    if (options.tables) {
      tables = tables.filter(table => options.tables?.includes(table.name) ?? false)
      console.info(chalk.blue(`Filtering to tables: ${options.tables.join(', ')}`))
    }

    if (tables.length === 0) {
      console.error(chalk.red('No tables found to generate types for'))
      process.exit(1)
    }

    console.info(chalk.green(`✓ Found ${tables.length} tables:`))
    tables.forEach(table => {
      console.info(chalk.gray(`  - ${table.name} (${table.columns.length} columns)`))
    })

    // Generate types
    console.info(chalk.blue('\nGenerating types...'))

    const dbTypes = generateDatabaseTypes(tables)
    await writeFile(join(options.output, 'database.ts'), dbTypes, options.dryRun)

    const domainTypes = generateDomainTypes(tables)
    await writeFile(join(options.output, 'models.ts'), domainTypes, options.dryRun)

    const mappers = generateMappers(tables)
    await writeFile(
      join(options.output, '..', '..', 'database', 'mappers', 'generated', 'index.ts'),
      mappers,
      options.dryRun
    )

    if (!options.dryRun) {
      console.info(chalk.bold.green('\n✅ Type generation completed successfully!\n'))
      console.info(chalk.gray('Generated files:'))
      console.info(chalk.gray(`  - ${options.output}/database.ts`))
      console.info(chalk.gray(`  - ${options.output}/models.ts`))
      console.info(chalk.gray(`  - src/database/mappers/generated/index.ts`))
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error generating types:'), error)
    process.exit(1)
  }
}

async function main() {
  const options = parseArgs()

  if (options.watch) {
    console.info(chalk.yellow('\n👀 Watch mode not implemented yet\n'))
    await generate(options)
  } else {
    await generate(options)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error)
    process.exit(1)
  })
}
