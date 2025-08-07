/**
 * ESBuild configuration for optimized production builds
 */

import { build } from 'esbuild'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  outfile: 'dist/index.js',

  // Optimization settings
  minify: true,
  treeShaking: true,
  splitting: false,

  // Mark packages as external to reduce bundle size
  external: ['node:*', 'cloudflare:*', '@cloudflare/*'],

  // Path aliases
  alias: {
    '@': './src'
  },

  // Drop console.log in production
  drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],

  // Define global constants for dead code elimination
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'globalThis.DEBUG': 'false'
  },

  // Pure functions for better tree-shaking
  pure: ['console.log', 'console.debug', 'console.info', 'console.warn'],

  // Inject shims for Node.js built-ins
  inject: [],

  // Generate metafile for analysis
  metafile: true,

  // Custom plugins
  plugins: [
    {
      name: 'zod-locale-filter',
      setup(build) {
        // Filter out unused Zod locales
        build.onResolve({ filter: /^zod\/v4\/locales\// }, args => {
          // Only include English locale
          if (!args.path.includes('/en')) {
            return { path: args.path, external: true }
          }
        })
      }
    },
    {
      name: 'lazy-load-heavy-deps',
      setup(build) {
        // Convert heavy imports to dynamic imports
        build.onLoad({ filter: /\.(ts|js)$/ }, async args => {
          const fs = await import('fs')
          let contents = await fs.promises.readFile(args.path, 'utf8')

          // Replace direct Grammy imports with lazy loading
          if (contents.includes("from 'grammy'") && !args.path.includes('node_modules')) {
            contents = contents.replace(
              /import\s+{([^}]+)}\s+from\s+['"]grammy['"]/g,
              "const { $1 } = await import('grammy')"
            )
          }

          return { contents, loader: 'ts' }
        })
      }
    }
  ]
}

// Build function
async function buildBundle() {
  try {
    const result = await build(config)

    // Write metafile for analysis
    if (result.metafile) {
      const fs = await import('fs')
      await fs.promises.writeFile('dist/meta.json', JSON.stringify(result.metafile, null, 2))

      // Calculate and display bundle size
      const outputs = Object.values(result.metafile.outputs)
      const totalSize = outputs.reduce((acc, output) => acc + output.bytes, 0)

      console.log('✅ Build successful!')
      console.log(`📦 Bundle size: ${(totalSize / 1024).toFixed(2)} KB`)
      console.log(`📊 Metafile saved to dist/meta.json`)
    }
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

// Run build if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildBundle()
}

export { buildBundle, config }
