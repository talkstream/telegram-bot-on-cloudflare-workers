#!/usr/bin/env node

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Function to get all test files recursively
function getTestFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('coverage')) {
      getTestFiles(fullPath, files);
    } else if (item.endsWith('.test.ts')) {
      files.push(relative(rootDir, fullPath));
    }
  }
  
  return files;
}

// Get all test files
const testDir = join(rootDir, 'src', '__tests__');
const allTestFiles = getTestFiles(testDir);

console.log(`Found ${allTestFiles.length} test files`);

// Split test files into chunks
const chunkSize = Math.ceil(allTestFiles.length / 4); // Run in 4 parts
const chunks = [];

for (let i = 0; i < allTestFiles.length; i += chunkSize) {
  chunks.push(allTestFiles.slice(i, i + chunkSize));
}

// Run tests in chunks
for (let i = 0; i < chunks.length; i++) {
  console.log(`\n🔍 Running coverage for part ${i + 1}/${chunks.length} (${chunks[i].length} files)...`);
  
  const testPattern = chunks[i].map(file => `"${file}"`).join(' ');
  const command = `NODE_OPTIONS='--max-old-space-size=4096' vitest run --coverage --config vitest.config.coverage.ts ${testPattern}`;
  
  try {
    execSync(command, { 
      stdio: 'inherit',
      cwd: rootDir,
      env: {
        ...process.env,
        FORCE_COLOR: '1'
      }
    });
    console.log(`✅ Part ${i + 1} completed successfully`);
  } catch (error) {
    console.error(`❌ Part ${i + 1} failed`);
    process.exit(1);
  }
}

console.log('\n✅ All coverage parts completed successfully!');
console.log('📊 Coverage report is available in the coverage/ directory');