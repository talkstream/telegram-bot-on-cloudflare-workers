/**
 * Analytics Module
 *
 * Fire-and-forget analytics for Cloudflare Workers
 *
 * @module lib/analytics
 */

export {
  AnalyticsFactory,
  AsyncAnalytics,
  CloudflareAnalytics,
  TrackPerformance,
  createAnalyticsMiddleware,
  type AnalyticsEvent,
  type AsyncAnalyticsOptions
} from './async-analytics'
