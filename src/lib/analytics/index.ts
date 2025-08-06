/**
 * Analytics Module
 *
 * Fire-and-forget analytics for Cloudflare Workers
 *
 * @module lib/analytics
 */

export {
  AsyncAnalytics,
  CloudflareAnalytics,
  AnalyticsFactory,
  TrackPerformance,
  createAnalyticsMiddleware,
  type AnalyticsEvent,
  type AsyncAnalyticsOptions,
} from './async-analytics';
