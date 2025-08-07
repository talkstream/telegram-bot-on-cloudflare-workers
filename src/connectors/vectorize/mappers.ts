/**
 * Shared field mappers for Vectorize connector
 *
 * Centralizes all data transformation logic for vector database operations
 * @module connectors/vectorize/mappers
 */

import { FieldMapper } from '@/core/database/field-mapper'

/**
 * Database representation of index information from Cloudflare Vectorize API
 */
export interface IndexResultDb {
  name: string
  config: {
    dimensions: number
    metric: string
  }
  vectors_count?: number
  status?: string
}

/**
 * Domain representation of index information
 */
export interface IndexInfoDomain {
  name: string
  dimensions: number
  metric: string
  totalVectors: number
  status: 'ready' | 'initializing' | 'error'
}

/**
 * FieldMapper for transforming index information between API and domain models
 *
 * Handles:
 * - Nested config extraction (dimensions, metric)
 * - Default values for optional fields
 * - snake_case to camelCase conversion
 */
export const indexInfoMapper = new FieldMapper<IndexResultDb, IndexInfoDomain>([
  {
    dbField: 'name',
    domainField: 'name'
  },
  {
    dbField: 'config',
    domainField: 'dimensions',
    toDomain: config => config.dimensions,
    toDb: dimensions => ({ dimensions, metric: '' })
  },
  {
    dbField: 'config',
    domainField: 'metric',
    toDomain: config => config.metric,
    toDb: metric => ({ dimensions: 0, metric })
  },
  {
    dbField: 'vectors_count',
    domainField: 'totalVectors',
    toDomain: count => count ?? 0,
    toDb: total => total
  },
  {
    dbField: 'status',
    domainField: 'status',
    toDomain: status => (status as 'ready' | 'initializing' | 'error') ?? 'ready',
    toDb: status => status
  }
])

/**
 * Vector search result from Cloudflare API
 */
export interface VectorSearchResultDb {
  id: string
  score: number
  values?: number[]
  metadata?: Record<string, unknown>
}

/**
 * Domain representation of vector search match
 */
export interface VectorMatchDomain {
  id: string
  score: number
  values?: number[]
  metadata?: Record<string, unknown>
}

/**
 * FieldMapper for vector search results
 *
 * Currently a simple 1:1 mapping but prepared for future transformations
 */
export const vectorMatchMapper = new FieldMapper<VectorSearchResultDb, VectorMatchDomain>([
  { dbField: 'id', domainField: 'id' },
  { dbField: 'score', domainField: 'score' },
  { dbField: 'values', domainField: 'values' },
  { dbField: 'metadata', domainField: 'metadata' }
])

/**
 * Stats result from API
 */
export interface StatsResultDb {
  vector_count?: number
  index_fullness?: number
  dimensions?: number
}

/**
 * Domain representation of index statistics
 */
export interface IndexStatsDomain {
  vectorCount: number
  indexFullness: number
  dimensions: number
}

/**
 * FieldMapper for index statistics
 */
export const indexStatsMapper = new FieldMapper<StatsResultDb, IndexStatsDomain>([
  {
    dbField: 'vector_count',
    domainField: 'vectorCount',
    toDomain: count => count ?? 0,
    toDb: count => count
  },
  {
    dbField: 'index_fullness',
    domainField: 'indexFullness',
    toDomain: fullness => fullness ?? 0,
    toDb: fullness => fullness
  },
  {
    dbField: 'dimensions',
    domainField: 'dimensions',
    toDomain: dims => dims ?? 0,
    toDb: dims => dims
  }
])
