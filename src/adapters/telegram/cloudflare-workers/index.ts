/**
 * Cloudflare Workers optimized adapters for Telegram bots
 *
 * These adapters provide tier-specific optimizations for running
 * Telegram bots on Cloudflare Workers infrastructure
 */

export { LightweightAdapter as FreeTierAdapter, createTierAwareBot } from './free-tier-adapter'

// Future: export { PaidTierAdapter } from './paid-tier-adapter';
