/**
 * Context types for CLI template generation
 */

import type { UnifiedMessage, MessageContent } from '@/core/interfaces/messaging';
import type { ICloudPlatformConnector } from '@/core/interfaces/cloud-platform';

/**
 * Command handler context for bot commands
 */
export interface CommandContext {
  /**
   * The incoming message
   */
  message: UnifiedMessage;

  /**
   * Reply to the message
   */
  reply: (content: MessageContent | string) => Promise<void>;

  /**
   * Platform identifier
   */
  platform: string;

  /**
   * Cloud platform instance
   */
  cloud: ICloudPlatformConnector;
}

/**
 * Create user input data
 */
export interface CreateUserInput {
  telegramId?: number;
  discordId?: string;
  slackId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Location data structure
 */
export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance?: number;
  address?: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

/**
 * AWS Lambda handler types
 * Will be replaced with @types/aws-lambda when installed
 */
export interface AWSEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  queryStringParameters?: Record<string, string>;
}

export interface AWSContext {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis: () => number;
}
