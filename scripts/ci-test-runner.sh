#!/bin/bash

# Run tests with optimized memory management
echo "🧪 Running tests with optimized memory management..."

# Use memory limit from environment or default to 1GB
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024}"

# Enable V8 garbage collection for better memory management
export NODE_OPTIONS="$NODE_OPTIONS --expose-gc"

# Configure test environment
export NODE_ENV="test"

# Clear any previous coverage data
rm -rf coverage/

# Use memory-efficient test runner
echo "🚀 Using memory-efficient test runner..."
node scripts/memory-efficient-test-runner.cjs

# Check if tests passed
if [ $? -eq 0 ]; then
  echo "✅ All tests passed with optimized memory management!"
  
  # Generate coverage report if coverage data exists
  if [ -d "coverage" ]; then
    echo "📊 Generating coverage report..."
    npx nyc report --reporter=lcov --reporter=text --reporter=html || true
  fi
  
  exit 0
else
  echo "❌ Some tests failed"
  exit 1
fi