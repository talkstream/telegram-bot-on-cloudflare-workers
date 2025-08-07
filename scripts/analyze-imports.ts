#!/usr/bin/env tsx
/**
 * Import Analysis Tool
 *
 * Analyzes module load times and identifies optimization opportunities
 * for cold start performance improvements
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { performance } from 'perf_hooks'

interface ImportMetrics {
  module: string
  loadTime: number
  size: number
  dependencies: string[]
  isHeavy: boolean
}

interface FileImports {
  file: string
  imports: string[]
  dynamicImports: string[]
}

class ImportAnalyzer {
  private projectRoot: string
  private metrics: Map<string, ImportMetrics> = new Map()
  private fileImports: FileImports[] = []

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  /**
   * Analyze all TypeScript files in the project
   */
  async analyze(): Promise<void> {
    console.log('🔍 Analyzing imports in project...\n')

    // Scan all TypeScript files
    const files = this.getAllTypeScriptFiles(this.projectRoot)

    for (const file of files) {
      this.analyzeFile(file)
    }

    // Measure actual load times for key modules
    await this.measureLoadTimes()

    // Generate report
    this.generateReport()
  }

  /**
   * Get all TypeScript files recursively
   */
  private getAllTypeScriptFiles(dir: string, files: string[] = []): string[] {
    const entries = readdirSync(dir)

    for (const entry of entries) {
      const fullPath = join(dir, entry)

      // Skip node_modules and build directories
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') {
        continue
      }

      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        this.getAllTypeScriptFiles(fullPath, files)
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        files.push(fullPath)
      }
    }

    return files
  }

  /**
   * Analyze imports in a single file
   */
  private analyzeFile(filePath: string): void {
    const content = readFileSync(filePath, 'utf-8')
    const relPath = relative(this.projectRoot, filePath)

    // Extract static imports
    const staticImports = this.extractStaticImports(content)

    // Extract dynamic imports
    const dynamicImports = this.extractDynamicImports(content)

    this.fileImports.push({
      file: relPath,
      imports: staticImports,
      dynamicImports
    })
  }

  /**
   * Extract static import statements
   */
  private extractStaticImports(content: string): string[] {
    const imports: string[] = []

    // Match import statements
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    return imports
  }

  /**
   * Extract dynamic import() calls
   */
  private extractDynamicImports(content: string): string[] {
    const imports: string[] = []

    // Match dynamic import() calls
    const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    let match

    while ((match = dynamicRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    return imports
  }

  /**
   * Measure actual load times for heavy modules
   */
  private async measureLoadTimes(): Promise<void> {
    const heavyModules = ['grammy', 'zod', 'dayjs', '@cloudflare/ai', 'hono', 'date-fns']

    console.log('⏱️  Measuring module load times...\n')

    for (const moduleName of heavyModules) {
      try {
        const start = performance.now()

        // Dynamically import the module
        await import(moduleName)

        const loadTime = performance.now() - start

        // Get module size (approximate)
        const modulePath = require.resolve(moduleName)
        const stat = statSync(modulePath)

        this.metrics.set(moduleName, {
          module: moduleName,
          loadTime,
          size: stat.size,
          dependencies: [],
          isHeavy: loadTime > 50 // Consider heavy if > 50ms
        })

        console.log(`  ✓ ${moduleName}: ${loadTime.toFixed(2)}ms`)
      } catch (error) {
        // Module might not be installed or is internal
      }
    }

    console.log('')
  }

  /**
   * Generate optimization report
   */
  private generateReport(): void {
    console.log('📊 Import Analysis Report\n')
    console.log('='.repeat(60))

    // Heavy modules that should be lazy loaded
    console.log('\n🏋️ Heavy Modules (candidates for lazy loading):\n')

    const heavyModules = Array.from(this.metrics.values())
      .filter(m => m.isHeavy)
      .sort((a, b) => b.loadTime - a.loadTime)

    if (heavyModules.length > 0) {
      for (const module of heavyModules) {
        console.log(`  • ${module.module}`)
        console.log(`    Load time: ${module.loadTime.toFixed(2)}ms`)
        console.log(`    Size: ${(module.size / 1024).toFixed(2)}KB`)
        console.log('')
      }
    } else {
      console.log('  No heavy modules detected\n')
    }

    // Files with most imports
    console.log('📦 Files with most imports:\n')

    const sortedFiles = this.fileImports
      .filter(f => f.imports.length > 10)
      .sort((a, b) => b.imports.length - a.imports.length)
      .slice(0, 10)

    for (const file of sortedFiles) {
      console.log(`  • ${file.file}`)
      console.log(`    Static imports: ${file.imports.length}`)
      console.log(`    Dynamic imports: ${file.dynamicImports.length}`)

      // Show heavy imports in this file
      const heavyImports = file.imports.filter(imp =>
        heavyModules.some(h => imp.includes(h.module))
      )

      if (heavyImports.length > 0) {
        console.log(`    ⚠️  Heavy imports: ${heavyImports.join(', ')}`)
      }
      console.log('')
    }

    // Optimization suggestions
    console.log('💡 Optimization Suggestions:\n')

    // Find entry points that import heavy modules
    const entryPoints = this.fileImports.filter(
      f => f.file.includes('index.ts') || f.file.includes('main.ts') || f.file.includes('worker.ts')
    )

    for (const entry of entryPoints) {
      const heavyImports = entry.imports.filter(imp =>
        heavyModules.some(h => imp.includes(h.module))
      )

      if (heavyImports.length > 0) {
        console.log(`  ⚠️  ${entry.file} imports heavy modules at startup:`)
        console.log(`     Consider lazy loading: ${heavyImports.join(', ')}`)
        console.log('')
      }
    }

    // Count total static vs dynamic imports
    const totalStatic = this.fileImports.reduce((sum, f) => sum + f.imports.length, 0)
    const totalDynamic = this.fileImports.reduce((sum, f) => sum + f.dynamicImports.length, 0)

    console.log('📈 Statistics:\n')
    console.log(`  Total files analyzed: ${this.fileImports.length}`)
    console.log(`  Total static imports: ${totalStatic}`)
    console.log(`  Total dynamic imports: ${totalDynamic}`)
    console.log(
      `  Dynamic import ratio: ${((totalDynamic / (totalStatic + totalDynamic)) * 100).toFixed(1)}%`
    )

    // Recommended refactoring
    console.log('\n🔧 Recommended Refactoring:\n')

    if (heavyModules.length > 0) {
      console.log('  1. Convert heavy module imports to lazy loading:')
      console.log('     ```typescript')
      console.log('     // Before')
      console.log('     import { Grammy } from "grammy";')
      console.log('')
      console.log('     // After')
      console.log('     const loadGrammy = async () => {')
      console.log('       const { Grammy } = await import("grammy");')
      console.log('       return Grammy;')
      console.log('     };')
      console.log('     ```\n')
    }

    console.log('  2. Use import type for type-only imports:')
    console.log('     ```typescript')
    console.log('     import type { SomeType } from "./types";')
    console.log('     ```\n')

    console.log('  3. Split code by routes/features:')
    console.log('     ```typescript')
    console.log('     // Lazy load features')
    console.log('     if (feature === "admin") {')
    console.log('       const { AdminPanel } = await import("./admin");')
    console.log('     }')
    console.log('     ```\n')
  }
}

// Run analyzer
const analyzer = new ImportAnalyzer(process.cwd())
analyzer.analyze().catch(console.error)
