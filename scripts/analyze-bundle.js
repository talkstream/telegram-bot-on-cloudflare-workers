#!/usr/bin/env node

/**
 * Bundle size analysis and tree-shaking optimization script
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🔍 Analyzing bundle size and tree-shaking opportunities...\n')

// Build the project
console.log('📦 Building project with esbuild...')
const buildDir = join(rootDir, 'dist')

if (!existsSync(buildDir)) {
  mkdirSync(buildDir, { recursive: true })
}

try {
  // Use esbuild to analyze bundle
  execSync(
    `npx esbuild src/index.ts \
    --bundle \
    --platform=browser \
    --target=es2022 \
    --format=esm \
    --tree-shaking=true \
    --minify \
    --metafile=dist/meta.json \
    --outfile=dist/bundle.js \
    --external:node:* \
    --external:cloudflare:* \
    --external:@cloudflare/* \
    --alias:@=./src`,
    {
      cwd: rootDir,
      stdio: 'inherit'
    }
  )

  // Analyze the metafile
  const metaFile = JSON.parse(readFileSync(join(buildDir, 'meta.json'), 'utf-8'))

  console.log('\n📊 Bundle Analysis Results:\n')

  // Get total bundle size
  const outputs = Object.values(metaFile.outputs)
  const mainOutput = outputs[0]
  const totalSize = mainOutput.bytes

  console.log(`Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`)
  console.log(`Minified: ${(totalSize / 1024 / 1024).toFixed(3)} MB`)

  // Analyze imports
  const imports = mainOutput.inputs
  const sortedImports = Object.entries(imports)
    .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
    .slice(0, 20)

  console.log('\n📦 Top 20 largest modules:\n')
  sortedImports.forEach(([path, info]) => {
    const relativePath = path.replace(rootDir + '/', '')
    const size = (info.bytesInOutput / 1024).toFixed(2)
    console.log(`  ${size.padStart(8)} KB  ${relativePath}`)
  })

  // Find unused exports
  console.log('\n🌳 Tree-shaking opportunities:\n')

  // Check for side-effect-free modules
  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
  if (!packageJson.sideEffects === false) {
    console.log('⚠️  Add "sideEffects": false to package.json for better tree-shaking')
  }

  // Analyze dependencies
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}

  console.log('\n📚 Dependency analysis:\n')

  // Check for heavy dependencies
  const heavyDeps = ['lodash', 'moment', 'jquery', 'axios']
  Object.keys(dependencies).forEach(dep => {
    if (heavyDeps.some(heavy => dep.includes(heavy))) {
      console.log(`⚠️  Heavy dependency detected: ${dep} - consider lighter alternatives`)
    }
  })

  // Generate recommendations
  console.log('\n💡 Optimization recommendations:\n')

  const recommendations = [
    '1. Use dynamic imports for code splitting',
    '2. Mark pure functions with /* #__PURE__ */ comments',
    '3. Use barrel exports carefully - they can prevent tree-shaking',
    '4. Consider using Rollup for better tree-shaking',
    '5. Analyze with webpack-bundle-analyzer for visual insights'
  ]

  recommendations.forEach(rec => console.log(`  ${rec}`))

  // Create a detailed report
  const report = {
    timestamp: new Date().toISOString(),
    totalSize: totalSize,
    sizeKB: totalSize / 1024,
    sizeMB: totalSize / 1024 / 1024,
    largestModules: sortedImports.map(([path, info]) => ({
      path: path.replace(rootDir + '/', ''),
      sizeKB: info.bytesInOutput / 1024
    })),
    recommendations
  }

  writeFileSync(join(buildDir, 'bundle-analysis.json'), JSON.stringify(report, null, 2))

  console.log('\n✅ Analysis complete! Report saved to dist/bundle-analysis.json')
} catch (error) {
  console.error('❌ Build failed:', error.message)
  process.exit(1)
}
