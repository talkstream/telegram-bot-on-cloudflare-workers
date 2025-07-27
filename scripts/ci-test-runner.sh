#!/bin/bash

# Run tests in batches to avoid memory exhaustion
echo "🧪 Running tests in batches..."

# Use memory limit from environment or default to 2GB
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

# Run all tests excluding integration
echo "📦 Running unit tests..."
npx vitest run --config vitest.config.ci.ts --exclude='src/__tests__/integration/**' --coverage || exit 1

# Run integration tests separately
echo "🔗 Running integration tests..."
npx vitest run --config vitest.config.ci.ts src/__tests__/integration --coverage || exit 1

# Merge coverage reports
echo "📊 Coverage reports generated successfully!"

echo "✅ All tests passed!"