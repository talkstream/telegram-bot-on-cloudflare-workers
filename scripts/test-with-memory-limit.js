#!/usr/bin/env node

/**
 * Run tests with memory monitoring and limits
 * This script helps identify memory-hungry tests
 */

const { spawn } = require('child_process');
const path = require('path');

// Set memory limit to 2GB
process.env.NODE_OPTIONS = '--max-old-space-size=2048';

console.log('🧪 Running tests with memory limit: 2GB');
console.log('📊 Memory usage will be monitored...\n');

// Track initial memory
const initialMemory = process.memoryUsage();
console.log('Initial memory:', {
  rss: `${Math.round(initialMemory.rss / 1024 / 1024)}MB`,
  heapUsed: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
});

// Run vitest with coverage
const vitest = spawn('npx', ['vitest', 'run', '--coverage', '--reporter=verbose'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});

// Monitor memory every 5 seconds
const memoryInterval = setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`\n⚡ Memory: RSS ${Math.round(usage.rss / 1024 / 1024)}MB, Heap ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 5000);

vitest.on('close', (code) => {
  clearInterval(memoryInterval);
  
  const finalMemory = process.memoryUsage();
  console.log('\nFinal memory:', {
    rss: `${Math.round(finalMemory.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
  });
  
  if (code !== 0) {
    console.error(`\n❌ Tests failed with code ${code}`);
    process.exit(code);
  } else {
    console.log('\n✅ All tests passed!');
  }
});

vitest.on('error', (error) => {
  console.error('Failed to start test process:', error);
  process.exit(1);
});