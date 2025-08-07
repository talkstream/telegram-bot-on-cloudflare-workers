# Bundle Size Optimization Guide

## Overview

This guide explains how to optimize bundle size in the Wireframe platform for production deployments.

## Current Status

- **Base bundle size**: ~570 KB minified
- **Main contributors**:
  - Grammy: 76 KB
  - Zod (with all locales): 150+ KB
  - Sentry: 30+ KB

## Optimization Strategies

### 1. Tree Shaking

Tree shaking is enabled by default with:

- `"sideEffects": false` in package.json
- ESBuild with `treeShaking: true`
- TypeScript `"module": "ESNext"`

### 2. Use Specific Imports

Instead of barrel exports:

```typescript
// ❌ Bad - imports everything
import { EventBus, ServiceContainer, RoleService } from '@/core';

// ✅ Good - imports only what's needed
import { EventBus } from '@/core/event-bus/event-bus';
import { ServiceContainer } from '@/core/services/service-container';
```

### 3. Lazy Loading

Use dynamic imports for heavy dependencies:

```typescript
// Lazy load Grammy only when needed
const { Bot } = await import('grammy');

// Use the optimized imports helper
import { loadGrammy } from '@/lib/optimized-imports';
const grammy = await loadGrammy();
```

### 4. Exclude Unused Locales

Zod includes all locales by default. Use only what you need:

```typescript
// Import Zod without locales
import { z } from 'zod/v4/core/api';

// Load specific locale if needed
import { zodI18nMap } from 'zod/v4/locales/en';
```

### 5. Production Build Commands

```bash
# Analyze bundle size
npm run build:analyze

# Build optimized bundle
npm run build

# Deploy with optimizations
NODE_ENV=production npm run deploy
```

## Build Configuration

The `esbuild.config.js` provides:

- Minification
- Tree shaking
- Dead code elimination
- Console stripping in production
- Locale filtering for Zod
- Bundle analysis

## Monitoring Bundle Size

1. **Regular analysis**: Run `npm run build:analyze` before deployments
2. **Check report**: Review `dist/bundle-analysis.json`
3. **Set limits**: Keep bundle under 1MB for Cloudflare Workers

## Best Practices

### DO ✅

- Use specific imports from source files
- Lazy load heavy dependencies
- Mark pure functions with `/* #__PURE__ */`
- Use dynamic imports for code splitting
- Regular bundle analysis

### DON'T ❌

- Use barrel exports (`index.ts` with many re-exports)
- Import entire libraries when you need one function
- Include development dependencies in production
- Use heavy libraries (moment.js, lodash) without tree shaking

## Cloudflare Workers Limits

- **Free tier**: 1MB compressed script size
- **Paid tier**: 10MB compressed script size
- **Memory**: 128MB
- **CPU time**: 10ms (free) / 30s (paid)

## Tools

- **ESBuild**: Fast bundler with tree shaking
- **Bundle Analyzer**: `npm run build:analyze`
- **Size Limit**: Can be added to CI/CD

## Example Optimization

Before optimization:

```typescript
import * as zod from 'zod';
import { Bot, Context } from 'grammy';
import * as Sentry from '@sentry/cloudflare';
// Bundle: 850KB
```

After optimization:

```typescript
import { z } from 'zod/v4/core/api';
const { Bot } = await import('grammy');
const Sentry = await import('@sentry/cloudflare');
// Bundle: 350KB
```

## Continuous Monitoring

Add to CI/CD pipeline:

```yaml
- name: Check bundle size
  run: |
    npm run build
    size=$(stat -f%z dist/index.js)
    if [ $size -gt 1048576 ]; then
      echo "Bundle too large: $size bytes"
      exit 1
    fi
```

## Further Optimizations

1. **Code splitting**: Split routes/features into separate bundles
2. **Compression**: Use Brotli/Gzip compression
3. **CDN**: Serve static assets from CDN
4. **Preload**: Use link preload for critical resources
5. **Service Worker**: Cache assets for offline support
