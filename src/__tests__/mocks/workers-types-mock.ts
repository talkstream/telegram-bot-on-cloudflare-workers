/**
 * Lightweight mock for Cloudflare Workers types in unit tests
 */

// Mock KV namespace
export interface KVNamespace {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

// Mock D1 database
export interface D1Database {
  prepare: (query: string) => D1PreparedStatement;
  batch: <T = unknown>(statements: D1PreparedStatement[]) => Promise<D1Result<T>[]>;
  exec: (query: string) => Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
  run: <T = unknown>() => Promise<D1Result<T>>;
  all: <T = unknown>() => Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// Mock Request/Response using global types
export const Request = globalThis.Request;
export const Response = globalThis.Response;

// Mock crypto
export const crypto = (globalThis as Record<string, unknown>).crypto || {};

// Mock execution context
export interface ExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

// Mock handler types
export interface ExportedHandler<Env = unknown> {
  fetch?: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
  scheduled?: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => Promise<void>;
}

export interface ScheduledController {
  scheduledTime: number;
  cron: string;
  noRetry: () => void;
}
