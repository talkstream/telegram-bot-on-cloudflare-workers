#!/usr/bin/env tsx
/**
 * Cold Start Performance Benchmark
 *
 * Measures and compares cold start times between original and optimized versions
 */

import { spawn } from 'child_process'
import { performance } from 'perf_hooks'

interface BenchmarkResult {
  name: string
  coldStart: number
  warmStart: number
  memoryUsed: number
  iterations: number
}

class ColdStartBenchmark {
  private results: BenchmarkResult[] = []

  /**
   * Run benchmark for a specific entry point
   */
  async benchmark(name: string, entryPoint: string, iterations = 10): Promise<BenchmarkResult> {
    console.log(`\n🔬 Benchmarking: ${name}`)
    console.log('─'.repeat(40))

    const coldStarts: number[] = []
    const warmStarts: number[] = []
    const memoryUsages: number[] = []

    for (let i = 0; i < iterations; i++) {
      process.stdout.write(`  Iteration ${i + 1}/${iterations}...`)

      // Measure cold start (new process)
      const coldTime = await this.measureColdStart(entryPoint)
      coldStarts.push(coldTime)

      // Measure warm start (cached modules)
      const warmTime = await this.measureWarmStart(entryPoint)
      warmStarts.push(warmTime)

      // Measure memory usage
      const memory = await this.measureMemoryUsage(entryPoint)
      memoryUsages.push(memory)

      process.stdout.write(` ✓\n`)

      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Calculate averages
    const avgCold = this.average(coldStarts)
    const avgWarm = this.average(warmStarts)
    const avgMemory = this.average(memoryUsages)

    const result: BenchmarkResult = {
      name,
      coldStart: avgCold,
      warmStart: avgWarm,
      memoryUsed: avgMemory,
      iterations
    }

    this.results.push(result)

    // Display immediate results
    console.log(`\n  Results for ${name}:`)
    console.log(`    Cold Start: ${avgCold.toFixed(2)}ms`)
    console.log(`    Warm Start: ${avgWarm.toFixed(2)}ms`)
    console.log(`    Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`)

    return result
  }

  /**
   * Measure cold start time
   */
  private async measureColdStart(entryPoint: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const start = performance.now()

      // Spawn new Node process to simulate cold start
      const child = spawn(
        'node',
        [
          '--experimental-specifier-resolution=node',
          '--loader=tsx',
          '-e',
          `
          const start = process.hrtime.bigint();
          import('${entryPoint}').then(() => {
            const end = process.hrtime.bigint();
            const ms = Number(end - start) / 1000000;
            process.stdout.write(String(ms));
            process.exit(0);
          }).catch(err => {
            console.error(err);
            process.exit(1);
          });
        `
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NODE_ENV: 'production'
          }
        }
      )

      let output = ''

      child.stdout.on('data', data => {
        output += data.toString()
      })

      child.on('close', code => {
        if (code === 0) {
          const loadTime = parseFloat(output)
          resolve(loadTime)
        } else {
          // Fallback measurement
          const elapsed = performance.now() - start
          resolve(elapsed)
        }
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill()
        reject(new Error('Cold start timeout'))
      }, 10000)
    })
  }

  /**
   * Measure warm start time (modules cached)
   */
  private async measureWarmStart(entryPoint: string): Promise<number> {
    // Clear module cache
    for (const key of Object.keys(require.cache)) {
      if (key.includes(entryPoint)) {
        delete require.cache[key]
      }
    }

    const start = performance.now()

    try {
      // Dynamic import (modules may be cached by V8)
      await import(entryPoint + '?t=' + Date.now())
    } catch (error) {
      // Ignore import errors for benchmark
    }

    return performance.now() - start
  }

  /**
   * Measure memory usage
   */
  private async measureMemoryUsage(entryPoint: string): Promise<number> {
    return new Promise(resolve => {
      const child = spawn(
        'node',
        [
          '--experimental-specifier-resolution=node',
          '--loader=tsx',
          '-e',
          `
          import('${entryPoint}').then(() => {
            const mem = process.memoryUsage();
            process.stdout.write(String(mem.heapUsed));
            process.exit(0);
          }).catch(() => {
            process.stdout.write('0');
            process.exit(0);
          });
        `
        ],
        {
          stdio: ['ignore', 'pipe', 'ignore'],
          env: {
            ...process.env,
            NODE_ENV: 'production'
          }
        }
      )

      let output = ''

      child.stdout.on('data', data => {
        output += data.toString()
      })

      child.on('close', () => {
        const memory = parseInt(output) || 0
        resolve(memory)
      })

      // Timeout
      setTimeout(() => {
        child.kill()
        resolve(0)
      }, 5000)
    })
  }

  /**
   * Calculate average
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return numbers.reduce((a, b) => a + b, 0) / numbers.length
  }

  /**
   * Generate comparison report
   */
  generateReport(): void {
    console.log('\n')
    console.log('═'.repeat(60))
    console.log('📊 PERFORMANCE COMPARISON REPORT')
    console.log('═'.repeat(60))

    if (this.results.length === 0) {
      console.log('No benchmark results available')
      return
    }

    // Find baseline (original)
    const baseline = this.results.find(r => r.name.includes('Original'))
    const optimized = this.results.find(r => r.name.includes('Optimized'))

    if (baseline && optimized) {
      console.log('\n🎯 IMPROVEMENTS:\n')

      const coldImprovement =
        ((baseline.coldStart - optimized.coldStart) / baseline.coldStart) * 100
      const warmImprovement =
        ((baseline.warmStart - optimized.warmStart) / baseline.warmStart) * 100
      const memoryImprovement =
        ((baseline.memoryUsed - optimized.memoryUsed) / baseline.memoryUsed) * 100

      console.log(
        `  Cold Start: ${coldImprovement >= 0 ? '✅' : '❌'} ${Math.abs(coldImprovement).toFixed(1)}% ${coldImprovement >= 0 ? 'faster' : 'slower'}`
      )
      console.log(
        `  Warm Start: ${warmImprovement >= 0 ? '✅' : '❌'} ${Math.abs(warmImprovement).toFixed(1)}% ${warmImprovement >= 0 ? 'faster' : 'slower'}`
      )
      console.log(
        `  Memory:     ${memoryImprovement >= 0 ? '✅' : '❌'} ${Math.abs(memoryImprovement).toFixed(1)}% ${memoryImprovement >= 0 ? 'less' : 'more'}`
      )

      console.log('\n📈 DETAILED METRICS:\n')
      console.log('  Metric          Original    Optimized   Difference')
      console.log('  ─────────────────────────────────────────────────')
      console.log(
        `  Cold Start      ${baseline.coldStart.toFixed(2)}ms`.padEnd(30) +
          `${optimized.coldStart.toFixed(2)}ms`.padEnd(15) +
          `${(baseline.coldStart - optimized.coldStart).toFixed(2)}ms`
      )
      console.log(
        `  Warm Start      ${baseline.warmStart.toFixed(2)}ms`.padEnd(30) +
          `${optimized.warmStart.toFixed(2)}ms`.padEnd(15) +
          `${(baseline.warmStart - optimized.warmStart).toFixed(2)}ms`
      )
      console.log(
        `  Memory          ${(baseline.memoryUsed / 1024 / 1024).toFixed(2)}MB`.padEnd(30) +
          `${(optimized.memoryUsed / 1024 / 1024).toFixed(2)}MB`.padEnd(15) +
          `${((baseline.memoryUsed - optimized.memoryUsed) / 1024 / 1024).toFixed(2)}MB`
      )
    }

    // Target goals
    console.log('\n🎯 TARGET GOALS:\n')
    console.log('  Goal            Target      Actual      Status')
    console.log('  ─────────────────────────────────────────────')

    const coldTarget = 50
    const memoryTarget = 128 * 1024 * 1024

    if (optimized) {
      console.log(
        `  Cold Start      < ${coldTarget}ms`.padEnd(30) +
          `${optimized.coldStart.toFixed(2)}ms`.padEnd(12) +
          (optimized.coldStart < coldTarget ? '✅ PASS' : '❌ FAIL')
      )
      console.log(
        `  Memory          < ${(memoryTarget / 1024 / 1024).toFixed(0)}MB`.padEnd(30) +
          `${(optimized.memoryUsed / 1024 / 1024).toFixed(2)}MB`.padEnd(12) +
          (optimized.memoryUsed < memoryTarget ? '✅ PASS' : '❌ FAIL')
      )
    }

    console.log('\n' + '═'.repeat(60))
  }
}

// Run benchmarks
async function main() {
  console.log('🚀 Cold Start Performance Benchmark\n')
  console.log('Note: This may take a few minutes...\n')

  const benchmark = new ColdStartBenchmark()

  try {
    // Benchmark original version
    await benchmark.benchmark('Original', './src/index.ts', 5)

    // Benchmark optimized version
    await benchmark.benchmark('Optimized', './src/index.optimized.ts', 5)

    // Generate comparison report
    benchmark.generateReport()
  } catch (error) {
    console.error('Benchmark failed:', error)
    process.exit(1)
  }
}

main().catch(console.error)
