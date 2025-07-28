#!/usr/bin/env node

/**
 * Memory-efficient test runner for Wireframe
 * Runs tests in batches to prevent memory exhaustion
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Configuration
const BATCH_SIZE = 5; // Number of test files per batch
const MAX_MEMORY = 1024; // MB per batch
const TEST_DIR = path.join(__dirname, '..', 'src');

// Find all test files
function findTestFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.includes('node_modules')) {
      findTestFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Categorize tests
function categorizeTests(testFiles) {
  const unit = [];
  const integration = [];
  const worker = [];
  
  for (const file of testFiles) {
    if (file.includes('.integration.test.') || file.includes('/integration/')) {
      integration.push(file);
    } else if (file.includes('.worker.test.') || 
               file.includes('/commands/') || 
               file.includes('/middleware/') ||
               file.includes('/connectors/')) {
      worker.push(file);
    } else {
      unit.push(file);
    }
  }
  
  return { unit, integration, worker };
}

// Run tests in batch
async function runBatch(files, config, batchName) {
  return new Promise((resolve, reject) => {
    const filePattern = files.map(f => path.relative(process.cwd(), f)).join(' ');
    
    console.log(chalk.blue(`\n📦 Running ${batchName} (${files.length} files)...`));
    
    const args = [
      'vitest',
      'run',
      '--config', config,
      ...files.map(f => path.relative(process.cwd(), f))
    ];
    
    const env = {
      ...process.env,
      NODE_OPTIONS: `--max-old-space-size=${MAX_MEMORY} --expose-gc`,
      NODE_ENV: 'test'
    };
    
    const child = spawn('npx', args, {
      env,
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ ${batchName} completed successfully`));
        resolve();
      } else {
        reject(new Error(`${batchName} failed with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Main execution
async function main() {
  console.log(chalk.bold('🧪 Memory-Efficient Test Runner'));
  console.log(chalk.gray(`Batch size: ${BATCH_SIZE} files, Memory limit: ${MAX_MEMORY}MB\n`));
  
  // Find and categorize tests
  const testFiles = findTestFiles(TEST_DIR);
  const { unit, integration, worker } = categorizeTests(testFiles);
  
  console.log(chalk.cyan(`Found ${testFiles.length} test files:`));
  console.log(chalk.gray(`  - Unit tests: ${unit.length}`));
  console.log(chalk.gray(`  - Integration tests: ${integration.length}`));
  console.log(chalk.gray(`  - Worker tests: ${worker.length}`));
  
  let failedBatches = [];
  
  try {
    // Run unit tests in batches
    if (unit.length > 0) {
      console.log(chalk.yellow('\n🔬 Running Unit Tests...'));
      for (let i = 0; i < unit.length; i += BATCH_SIZE) {
        const batch = unit.slice(i, i + BATCH_SIZE);
        const batchName = `Unit Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(unit.length / BATCH_SIZE)}`;
        
        try {
          await runBatch(batch, 'vitest.config.unit.ts', batchName);
        } catch (err) {
          failedBatches.push(batchName);
          console.error(chalk.red(`❌ ${batchName} failed`));
        }
      }
    }
    
    // Run integration tests (smaller batches)
    if (integration.length > 0) {
      console.log(chalk.yellow('\n🌐 Running Integration Tests...'));
      const integrationBatchSize = Math.max(1, Math.floor(BATCH_SIZE / 2));
      
      for (let i = 0; i < integration.length; i += integrationBatchSize) {
        const batch = integration.slice(i, i + integrationBatchSize);
        const batchName = `Integration Batch ${Math.floor(i / integrationBatchSize) + 1}/${Math.ceil(integration.length / integrationBatchSize)}`;
        
        try {
          await runBatch(batch, 'vitest.config.integration.ts', batchName);
        } catch (err) {
          failedBatches.push(batchName);
          console.error(chalk.red(`❌ ${batchName} failed`));
        }
      }
    }
    
    // Run worker tests (one at a time due to high memory usage)
    if (worker.length > 0) {
      console.log(chalk.yellow('\n⚙️ Running Worker Tests...'));
      
      for (let i = 0; i < worker.length; i++) {
        const batch = [worker[i]];
        const batchName = `Worker Test ${i + 1}/${worker.length}`;
        
        try {
          await runBatch(batch, 'vitest.config.integration.ts', batchName);
        } catch (err) {
          failedBatches.push(batchName);
          console.error(chalk.red(`❌ ${batchName} failed`));
        }
      }
    }
    
    // Summary
    console.log(chalk.bold('\n📊 Test Summary:'));
    if (failedBatches.length === 0) {
      console.log(chalk.green('✅ All tests passed!'));
      process.exit(0);
    } else {
      console.log(chalk.red(`❌ ${failedBatches.length} batches failed:`));
      failedBatches.forEach(batch => console.log(chalk.red(`   - ${batch}`)));
      process.exit(1);
    }
    
  } catch (err) {
    console.error(chalk.red('\n💥 Test runner failed:'), err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}