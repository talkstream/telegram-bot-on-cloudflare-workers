# Sentry Dashboard Configuration Guide

This guide helps you set up comprehensive Sentry dashboards for monitoring your Wireframe bot deployment.

## Prerequisites

1. A Sentry account with a project created
2. The Wireframe bot deployed with `SENTRY_DSN` configured
3. Some production traffic to generate data

## Recommended Dashboards

### 1. Bot Health Overview

Create a dashboard with these widgets:

#### Error Rate

- **Type**: Line Chart
- **Query**: `count()` grouped by `error.type`
- **Time Range**: Last 24 hours
- **Purpose**: Track error trends

#### Command Performance

- **Type**: Table
- **Query**:
  ```
  avg(transaction.duration) by transaction
  WHERE transaction.op:command
  ```
- **Purpose**: Identify slow commands

#### Active Users

- **Type**: Big Number
- **Query**: `count_unique(user.id)`
- **Time Range**: Last hour
- **Purpose**: Monitor user activity

### 2. AI Provider Monitoring

#### Token Usage by Provider

- **Type**: Area Chart
- **Query**:
  ```
  sum(custom.tokensUsed) by custom.provider
  WHERE transaction.op:ai.generate
  ```
- **Purpose**: Track AI resource consumption

#### AI Generation Costs

- **Type**: Line Chart
- **Query**:
  ```
  sum(custom.cost) by custom.provider
  WHERE transaction.op:ai.generate
  ```
- **Purpose**: Monitor spending on AI services

#### AI Response Times

- **Type**: P95 Chart
- **Query**:
  ```
  p95(transaction.duration)
  WHERE transaction.op:ai.generate
  GROUP BY custom.provider
  ```
- **Purpose**: Track AI provider performance

### 3. User Experience Dashboard

#### Command Usage

- **Type**: Bar Chart
- **Query**:
  ```
  count() by transaction.name
  WHERE transaction.op:command
  ```
- **Purpose**: Understand feature usage

#### Error Impact

- **Type**: Table
- **Query**:
  ```
  count_unique(user.id) by error.type
  ORDER BY count DESC
  ```
- **Purpose**: Prioritize fixes by user impact

#### Response Time Distribution

- **Type**: Histogram
- **Query**:
  ```
  histogram(transaction.duration, 10)
  WHERE transaction.op:command
  ```
- **Purpose**: Ensure good user experience

### 4. System Performance

#### Database Query Performance

- **Type**: Line Chart
- **Query**:
  ```
  avg(span.duration)
  WHERE span.op:db.query
  ```
- **Purpose**: Monitor database health

#### Memory Usage Alerts

- **Type**: Alert Rule
- **Condition**:
  ```
  error.type:"JavaScript heap out of memory"
  count() > 5 in 1 hour
  ```
- **Purpose**: Catch memory issues early

#### Event Processing Rate

- **Type**: Line Chart
- **Query**:
  ```
  count() by event.type
  WHERE event.type:telegram.*
  ```
- **Purpose**: Monitor message throughput

## Alert Configuration

### Critical Alerts

1. **High Error Rate**
   - Condition: Error count > 100 in 5 minutes
   - Action: Notify on-call engineer

2. **AI Provider Failure**
   - Condition: AI errors > 10 in 1 minute
   - Action: Switch to fallback provider

3. **Command Timeout**
   - Condition: Transaction duration > 10s
   - Action: Investigate slow operations

### Warning Alerts

1. **Increasing AI Costs**
   - Condition: Hourly cost > $10
   - Action: Review usage patterns

2. **User Drop-off**
   - Condition: Active users decrease by 50%
   - Action: Check for UX issues

## Custom Metrics to Track

Add these custom tags in your code:

```typescript
// Track feature usage
monitoring.addBreadcrumb({
  message: 'Feature used',
  data: {
    feature: 'voice_message',
    userId: ctx.from.id,
  },
});

// Track business metrics
monitoring.captureMessage('Purchase completed', 'info', {
  amount: 100,
  currency: 'USD',
  item: 'premium_subscription',
});
```

## Dashboard Best Practices

1. **Start Simple**: Begin with basic metrics and add complexity as needed
2. **Focus on User Impact**: Prioritize metrics that affect user experience
3. **Set Realistic Thresholds**: Avoid alert fatigue with sensible limits
4. **Review Regularly**: Dashboards should evolve with your application
5. **Share with Team**: Export dashboards for team visibility

## Integration with Other Tools

### Slack Integration

```javascript
// .sentryclirc
[alerts];
slack_webhook = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';
```

### PagerDuty Integration

- Connect critical alerts to PagerDuty for 24/7 monitoring
- Use escalation policies for different severity levels

### Grafana Integration

- Export metrics to Grafana for advanced visualization
- Combine with Prometheus for comprehensive monitoring

## Troubleshooting Common Issues

### No Data Showing

1. Verify `SENTRY_DSN` is correctly configured
2. Check that monitoring is initialized in your code
3. Ensure production traffic is generating events

### Missing Transactions

1. Verify `startTransaction` is called for operations
2. Check that transactions are properly finished
3. Review sampling rate in Sentry settings

### High Cardinality Warnings

1. Avoid dynamic transaction names
2. Use parameterized names (e.g., `/user/{id}` not `/user/12345`)
3. Limit custom tag values to known sets

## Next Steps

1. Create your first dashboard using the templates above
2. Set up critical alerts for your use case
3. Review dashboard data weekly to identify trends
4. Iterate on metrics based on team feedback

Remember: Good monitoring is an iterative process. Start with the basics and refine based on what provides the most value for your team.
