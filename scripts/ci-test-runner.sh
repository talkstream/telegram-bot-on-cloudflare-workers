#!/bin/bash

# Run tests in batches to avoid memory exhaustion
echo "🧪 Running tests in batches..."

# Use memory limit from environment or default to 2GB
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

# Run tests in smaller batches
echo "📦 Running core tests..."
npx vitest run --config vitest.config.ci.ts 'src/core/**/*.test.ts' --coverage || exit 1

echo "🔌 Running connector tests..."
npx vitest run --config vitest.config.ci.ts 'src/connectors/**/*.test.ts' --coverage || exit 1

echo "🛠️ Running pattern and middleware tests..."
npx vitest run --config vitest.config.ci.ts 'src/patterns/**/*.test.ts' 'src/middleware/**/*.test.ts' --coverage || exit 1

echo "📱 Running adapter and other tests..."
npx vitest run --config vitest.config.ci.ts 'src/adapters/**/*.test.ts' 'src/__tests__/**/*.test.ts' --exclude 'src/__tests__/integration/**' --coverage || exit 1

# Run integration tests separately
echo "🔗 Running integration tests..."
npx vitest run --config vitest.config.ci.ts 'src/__tests__/integration/**' --coverage || exit 1

echo "🧪 Running omnichannel tests..."
npx vitest run --config vitest.config.ci.ts 'tests/**/*.test.ts' --coverage || exit 1

# Merge coverage reports
echo "📊 Coverage reports generated successfully!"

echo "✅ All tests passed!"