#!/bin/bash

# Run tests in batches to avoid memory exhaustion
echo "🧪 Running tests with optimized memory management..."

# Use memory limit from environment or default to 3GB for CI
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"

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

# Run tests in smaller batches to reduce memory pressure
echo "📦 Running unit tests (batch 1: core)..."
npx vitest run --config $CONFIG_FILE \
  'src/__tests__/core/**/*.test.ts' \
  'src/__tests__/events/**/*.test.ts' \
  'src/__tests__/services/**/*.test.ts' \
  --coverage || exit 1

echo "📦 Running unit tests (batch 2: connectors)..."
npx vitest run --config $CONFIG_FILE \
  'src/__tests__/connectors/**/*.test.ts' \
  --coverage || exit 1

echo "📦 Running unit tests (batch 3: remaining)..."
npx vitest run --config $CONFIG_FILE \
  'src/__tests__/**/*.test.ts' \
  --exclude='src/__tests__/core/**/*.test.ts' \
  --exclude='src/__tests__/events/**/*.test.ts' \
  --exclude='src/__tests__/services/**/*.test.ts' \
  --exclude='src/__tests__/connectors/**/*.test.ts' \
  --exclude='src/__tests__/integration/**/*.test.ts' \
  --coverage || exit 1

# Run integration tests separately with increased timeout
echo "🔗 Running integration tests..."
npx vitest run --config $CONFIG_FILE \
  'src/__tests__/integration/**/*.test.ts' \
  --testTimeout=60000 \
  --coverage || exit 1

# Merge coverage reports
echo "📊 Merging coverage reports..."
npx nyc merge coverage coverage/merged.json || true
npx nyc report --reporter=lcov --reporter=text --reporter=html || true

echo "✅ All tests passed with optimized memory management!"