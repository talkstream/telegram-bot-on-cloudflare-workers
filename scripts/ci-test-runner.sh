#!/bin/bash

# Run tests in batches to avoid memory exhaustion
echo "🧪 Running tests in batches..."

# Set memory limit
export NODE_OPTIONS="--max-old-space-size=2048"

# Run unit tests first
echo "📦 Running unit tests..."
npx vitest run --config vitest.config.ci.ts 'src/**/*.test.ts' --coverage || exit 1

# Run integration tests separately
echo "🔗 Running integration tests..."
npx vitest run --config vitest.config.ci.ts 'src/__tests__/integration/**/*.test.ts' --coverage || exit 1

# Merge coverage reports
echo "📊 Coverage reports generated successfully!"

echo "✅ All tests passed!"