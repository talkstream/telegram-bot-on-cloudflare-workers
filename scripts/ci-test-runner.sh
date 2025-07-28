#!/bin/bash

# Run tests in batches to avoid memory exhaustion
echo "🧪 Running tests with optimized memory management..."

# Use memory limit from environment or default to 4GB for CI
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

# Enable V8 garbage collection for better memory management
export NODE_OPTIONS="$NODE_OPTIONS --expose-gc"

# Configure test environment
export NODE_ENV="test"

# Clear any previous coverage data
rm -rf coverage/

# Detect if we're in CI environment
if [ -n "$CI" ]; then
  echo "🔧 CI environment detected - using Node pool configuration..."
  CONFIG_FILE="vitest.config.ci-node.ts"
else
  CONFIG_FILE="vitest.config.ci.ts"
fi

# For CI with Node pool, run all tests together since we're using single thread
echo "📦 Running all tests with Node.js configuration..."
npx vitest run --config $CONFIG_FILE --coverage || exit 1

# Merge coverage reports
echo "📊 Merging coverage reports..."
npx nyc merge coverage coverage/merged.json || true
npx nyc report --reporter=lcov --reporter=text --reporter=html || true

echo "✅ All tests passed with optimized memory management!"