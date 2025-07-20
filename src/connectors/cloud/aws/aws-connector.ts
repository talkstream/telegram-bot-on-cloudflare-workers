/**
 * AWS platform connector
 * Adapts AWS services to our platform-agnostic interfaces
 */

import type {
  ICloudPlatformConnector,
  IKeyValueStore,
  IDatabaseStore,
  IObjectStore,
  ICacheStore,
} from '../../../core/interfaces';

import { AWSKeyValueStore } from './storage/aws-kv-store';
import { AWSDatabaseStore } from './storage/aws-database-store';

export interface AWSConfig {
  env: {
    AWS_REGION?: string;
    AWS_ACCESS_KEY_ID?: string;
    AWS_SECRET_ACCESS_KEY?: string;

    // Service mappings
    DYNAMODB_TABLES?: Record<string, string>;
    S3_BUCKETS?: Record<string, string>;

    [key: string]: unknown;
  };
}

export class AWSConnector implements ICloudPlatformConnector {
  readonly platform = 'aws';

  constructor(private config: AWSConfig) {
    // TODO: Initialize AWS SDK
  }

  getKeyValueStore(namespace: string): IKeyValueStore {
    // Return mock DynamoDB-based key-value store
    const tableName = this.config.env.DYNAMODB_TABLES?.[namespace] || namespace;
    return new AWSKeyValueStore(tableName);
  }

  getDatabaseStore(name: string): IDatabaseStore {
    // Return mock RDS/Aurora-based database store
    return new AWSDatabaseStore(name);
  }

  getObjectStore(_bucket: string): IObjectStore {
    // TODO: Return S3-based object store
    throw new Error('AWS object store not implemented yet');
  }

  getCacheStore(): ICacheStore {
    // TODO: Return ElastiCache/CloudFront-based cache store
    throw new Error('AWS cache store not implemented yet');
  }

  getEnv(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(this.config.env)) {
      if (typeof value === 'string') {
        env[key] = value;
      }
    }
    return env;
  }

  getFeatures() {
    return {
      hasEdgeCache: true, // CloudFront
      hasWebSockets: true, // API Gateway WebSocket
      hasCron: true, // EventBridge
      hasQueues: true, // SQS
      maxRequestDuration: 900000, // 15 minutes for Lambda
      maxMemory: 10240, // 10 GB for Lambda
    };
  }
}
