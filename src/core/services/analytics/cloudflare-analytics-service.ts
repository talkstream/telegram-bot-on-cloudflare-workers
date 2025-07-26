/**
 * Cloudflare Analytics Engine implementation
 */

import type {
  IAnalyticsDataPoint,
  IAnalyticsQueryOptions,
  IAnalyticsResult,
  IAnalyticsBatchOptions,
} from '../../interfaces/analytics';
import type { EventBus } from '../../events/event-bus';

import { BaseAnalyticsService } from './base-analytics-service';

/**
 * Cloudflare Analytics Engine binding interface
 */
interface AnalyticsEngineDataset {
  writeDataPoint(dataPoint: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

/**
 * Environment with Analytics Engine bindings
 */
interface AnalyticsEnv {
  [key: string]: AnalyticsEngineDataset | unknown;
}

/**
 * Cloudflare Analytics Engine service
 */
export class CloudflareAnalyticsService extends BaseAnalyticsService {
  private env: AnalyticsEnv;
  private datasetName: string;

  constructor(
    env: AnalyticsEnv,
    datasetName: string,
    options?: IAnalyticsBatchOptions,
    eventBus?: EventBus,
  ) {
    super(options, eventBus);
    this.env = env;
    this.datasetName = datasetName;
  }

  /**
   * Get Analytics Engine dataset
   */
  private getDataset(): AnalyticsEngineDataset {
    const dataset = this.env[this.datasetName];
    if (!dataset || typeof (dataset as AnalyticsEngineDataset).writeDataPoint !== 'function') {
      throw new Error(`Analytics Engine dataset ${this.datasetName} not found or not bound`);
    }
    return dataset as AnalyticsEngineDataset;
  }

  /**
   * Write data points to Analytics Engine
   */
  protected async doWrite(dataPoints: IAnalyticsDataPoint[]): Promise<void> {
    const dataset = this.getDataset();

    for (const point of dataPoints) {
      const cfDataPoint = this.convertToCloudflareFormat(point);
      dataset.writeDataPoint(cfDataPoint);
    }
  }

  /**
   * Query analytics data
   */
  async query(options: IAnalyticsQueryOptions): Promise<IAnalyticsResult> {
    // Analytics Engine uses SQL API for queries
    // This would typically be done through the REST API
    const sql = this.buildSQL(options);

    // For now, return a mock result structure
    // In production, this would make an HTTP request to Analytics Engine SQL API
    console.info(`Analytics query SQL: ${sql}`);

    return {
      data: [],
      metadata: {
        startTime: options.startTime.getTime(),
        endTime: options.endTime.getTime(),
        granularity: options.granularity,
        totalPoints: 0,
      },
    };
  }

  /**
   * Convert data point to Cloudflare format
   */
  private convertToCloudflareFormat(point: IAnalyticsDataPoint): {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  } {
    const blobs: string[] = [point.metric];
    const doubles: number[] = [point.value, point.timestamp || Date.now()];
    const indexes: string[] = [];

    // Add dimensions as blobs
    if (point.dimensions) {
      for (const [key, value] of Object.entries(point.dimensions)) {
        blobs.push(`${key}:${value}`);
        indexes.push(`${key}:${value}`);
      }
    }

    // Add metadata as JSON blob
    if (point.metadata) {
      blobs.push(JSON.stringify(point.metadata));
    }

    return { blobs, doubles, indexes };
  }

  /**
   * Build SQL query for Analytics Engine
   */
  private buildSQL(options: IAnalyticsQueryOptions): string {
    const {
      startTime,
      endTime,
      metrics,
      filters,
      groupBy,
      granularity,
      aggregation = 'sum',
    } = options;

    // Base query structure
    let sql = 'SELECT ';

    // Time grouping
    if (granularity) {
      sql += `toStartOfInterval(timestamp, INTERVAL 1 ${granularity}) as time_bucket, `;
    }

    // Metrics selection
    sql += metrics
      .map((metric) => `${aggregation}(IF(blob1 = '${metric}', double1, 0)) as ${metric}`)
      .join(', ');

    // Dimensions in group by
    if (groupBy && groupBy.length > 0) {
      sql += ', ' + groupBy.map((dim) => `blob2 as ${dim}`).join(', ');
    }

    // FROM clause
    sql += ` FROM ${this.datasetName}`;

    // WHERE clause
    const conditions: string[] = [
      `timestamp >= ${startTime.getTime()}`,
      `timestamp < ${endTime.getTime()}`,
    ];

    if (metrics.length > 0) {
      conditions.push(`blob1 IN (${metrics.map((m) => `'${m}'`).join(', ')})`);
    }

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          conditions.push(`blob2 IN (${value.map((v) => `'${key}:${v}'`).join(', ')})`);
        } else {
          conditions.push(`blob2 = '${key}:${value}'`);
        }
      }
    }

    sql += ` WHERE ${conditions.join(' AND ')}`;

    // GROUP BY clause
    if (granularity || (groupBy && groupBy.length > 0)) {
      const groupByColumns: string[] = [];
      if (granularity) {
        groupByColumns.push('time_bucket');
      }
      if (groupBy) {
        groupByColumns.push(...groupBy);
      }
      sql += ` GROUP BY ${groupByColumns.join(', ')}`;
    }

    // ORDER BY clause
    if (granularity) {
      sql += ' ORDER BY time_bucket';
    }

    // LIMIT clause
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    return sql;
  }
}
