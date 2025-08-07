/**
 * Vectorize Connector for Cloudflare Workers
 *
 * Provides vector database capabilities for semantic search and RAG
 * Integrates with Cloudflare Vectorize for efficient similarity search
 * @module connectors/vectorize/vectorize-connector
 */

import { indexInfoMapper, type IndexInfoDomain, type IndexResultDb } from './mappers'

import { BaseConnector } from '@/connectors/base/base-connector'
import { EventBus } from '@/core/events/event-bus'
import type {
  ConnectorCapabilities,
  ConnectorConfig,
  HealthStatus,
  ValidationResult
} from '@/core/interfaces/connector'
import { ConnectorType } from '@/core/interfaces/connector'
import { logger } from '@/lib/logger'

export interface VectorizeConfig extends ConnectorConfig {
  accountId: string
  apiToken?: string
  baseUrl?: string
  indexName: string
  dimensions?: number
  metric?: 'euclidean' | 'cosine' | 'dot-product'
  eventBus?: EventBus
}

export interface Vector {
  id: string
  values: number[]
  metadata?: Record<string, unknown>
}

export interface VectorSearchQuery {
  vector?: number[]
  topK?: number
  filter?: Record<string, unknown>
  includeValues?: boolean
  includeMetadata?: boolean
}

export interface VectorMatch {
  id: string
  score: number
  values?: number[]
  metadata?: Record<string, unknown>
}

// Re-export from mappers for backward compatibility
export type VectorizeIndex = IndexInfoDomain

export class VectorizeConnector extends BaseConnector {
  id = 'vectorize-connector'
  name = 'Cloudflare Vectorize Connector'
  version = '1.0.0'
  type = ConnectorType.DATABASE

  private accountId!: string
  private apiToken?: string
  private baseUrl: string
  private indexName!: string
  private dimensions: number
  private metric: string

  constructor(config?: VectorizeConfig) {
    super()
    if (config) {
      this.accountId = config.accountId
      this.apiToken = config.apiToken
      this.baseUrl = config.baseUrl || 'https://api.cloudflare.com/client/v4'
      this.indexName = config.indexName
      this.dimensions = config.dimensions || 1536 // Default for OpenAI embeddings
      this.metric = config.metric || 'cosine'
      if (config.eventBus) {
        this.eventBus = config.eventBus
      }
    } else {
      this.baseUrl = 'https://api.cloudflare.com/client/v4'
      this.dimensions = 1536
      this.metric = 'cosine'
    }
  }

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const vectorConfig = config as VectorizeConfig

    this.accountId = vectorConfig.accountId
    this.apiToken = vectorConfig.apiToken
    this.baseUrl = vectorConfig.baseUrl || this.baseUrl
    this.indexName = vectorConfig.indexName
    this.dimensions = vectorConfig.dimensions || this.dimensions
    this.metric = vectorConfig.metric || this.metric

    logger.info('[VectorizeConnector] Initializing Vectorize connector', {
      accountId: this.accountId,
      indexName: this.indexName,
      dimensions: this.dimensions,
      metric: this.metric
    })

    // Create or verify index exists
    await this.ensureIndex()

    this.emitEvent('vectorize:connector:initialized', {
      connector: this.id,
      indexName: this.indexName,
      dimensions: this.dimensions
    })
  }

  protected doValidateConfig(config: ConnectorConfig): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = []
    const vectorConfig = config as VectorizeConfig

    if (!vectorConfig.accountId) {
      errors?.push({
        field: 'accountId',
        message: 'Cloudflare account ID is required',
        code: 'REQUIRED_FIELD'
      })
    }

    if (!vectorConfig.indexName) {
      errors?.push({
        field: 'indexName',
        message: 'Index name is required',
        code: 'REQUIRED_FIELD'
      })
    }

    if (
      vectorConfig.dimensions &&
      (vectorConfig.dimensions < 1 || vectorConfig.dimensions > 3072)
    ) {
      errors?.push({
        field: 'dimensions',
        message: 'Dimensions must be between 1 and 3072',
        code: 'INVALID_VALUE'
      })
    }

    const validMetrics = ['euclidean', 'cosine', 'dot-product']
    if (vectorConfig.metric && !validMetrics.includes(vectorConfig.metric)) {
      errors?.push({
        field: 'metric',
        message: `Metric must be one of: ${validMetrics.join(', ')}`,
        code: 'INVALID_VALUE'
      })
    }

    return errors
  }

  protected checkReadiness(): boolean {
    return !!(this.accountId && this.indexName)
  }

  protected async checkHealth(): Promise<Partial<HealthStatus>> {
    try {
      const index = await this.getIndexInfo()

      return {
        status: index.status === 'ready' ? 'healthy' : 'degraded',
        message:
          index.status === 'ready' ? 'Vectorize connector is operational' : 'Index not ready',
        details: {
          indexName: index.name,
          status: index.status,
          totalVectors: index.totalVectors
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Failed to check index status',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  protected async doDestroy(): Promise<void> {
    logger.info('[VectorizeConnector] Destroying Vectorize connector')

    this.emitEvent('vectorize:connector:destroyed', {
      connector: this.id,
      indexName: this.indexName
    })
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsAsync: true,
      supportsSync: true,
      supportsBatching: true,
      supportsStreaming: false,
      maxBatchSize: 1000,
      maxConcurrent: 10,
      features: [
        'vector-search',
        'semantic-search',
        'metadata-filtering',
        'batch-upsert',
        'namespace-support',
        'hybrid-search'
      ]
    }
  }

  /**
   * Ensure the index exists, create if it doesn't
   */
  private async ensureIndex(): Promise<void> {
    try {
      // Check if index exists
      await this.getIndexInfo()
      logger.info('[VectorizeConnector] Index exists', { indexName: this.indexName })
    } catch (_error) {
      // Index doesn't exist, create it
      logger.info('[VectorizeConnector] Creating index', { indexName: this.indexName })
      await this.createIndex()
    }
  }

  /**
   * Create a new vector index
   */
  async createIndex(): Promise<void> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/vectorize/indexes`

    const payload = {
      name: this.indexName,
      config: {
        dimensions: this.dimensions,
        metric: this.metric
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.apiToken ? `Bearer ${this.apiToken}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create index: ${response.status} - ${error}`)
    }

    logger.info('[VectorizeConnector] Index created successfully', { indexName: this.indexName })

    this.emitEvent('vectorize:index:created', {
      indexName: this.indexName,
      dimensions: this.dimensions,
      metric: this.metric
    })
  }

  /**
   * Get index information
   */
  async getIndexInfo(): Promise<VectorizeIndex> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/vectorize/indexes/${this.indexName}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: this.apiToken ? `Bearer ${this.apiToken}` : ''
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get index info: ${response.status} - ${error}`)
    }

    const data = (await response.json()) as { result: IndexResultDb }

    // Use shared FieldMapper for consistent transformation
    return indexInfoMapper.toDomain(data.result)
  }

  /**
   * Insert or update vectors
   */
  async upsert(vectors: Vector[]): Promise<void> {
    try {
      logger.info('[VectorizeConnector] Upserting vectors', {
        count: vectors.length,
        indexName: this.indexName
      })

      const url = `${this.baseUrl}/accounts/${this.accountId}/vectorize/indexes/${this.indexName}/insert`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.apiToken ? `Bearer ${this.apiToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vectors })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to upsert vectors: ${response.status} - ${error}`)
      }

      logger.info('[VectorizeConnector] Vectors upserted successfully', {
        count: vectors.length
      })

      this.emitEvent('vectorize:vectors:upserted', {
        indexName: this.indexName,
        count: vectors.length
      })
    } catch (error) {
      logger.error('[VectorizeConnector] Failed to upsert vectors', error)

      this.emitEvent('vectorize:vectors:error', {
        indexName: this.indexName,
        operation: 'upsert',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * Search for similar vectors
   */
  async search(query: VectorSearchQuery): Promise<VectorMatch[]> {
    try {
      logger.info('[VectorizeConnector] Searching vectors', {
        indexName: this.indexName,
        topK: query.topK || 10,
        hasFilter: !!query.filter
      })

      const url = `${this.baseUrl}/accounts/${this.accountId}/vectorize/indexes/${this.indexName}/query`

      const payload = {
        vector: query.vector,
        topK: query.topK || 10,
        filter: query.filter,
        returnValues: query.includeValues || false,
        returnMetadata: query.includeMetadata !== false
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.apiToken ? `Bearer ${this.apiToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to search vectors: ${response.status} - ${error}`)
      }

      const data = (await response.json()) as { result: { matches: VectorMatch[] } }
      const matches: VectorMatch[] = data.result.matches || []

      logger.info('[VectorizeConnector] Search completed', {
        matchCount: matches.length,
        topScore: matches[0]?.score
      })

      this.emitEvent('vectorize:search:completed', {
        indexName: this.indexName,
        matchCount: matches.length,
        topK: query.topK
      })

      return matches
    } catch (error) {
      logger.error('[VectorizeConnector] Search failed', error)

      this.emitEvent('vectorize:search:error', {
        indexName: this.indexName,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * Delete vectors by ID
   */
  async delete(ids: string[]): Promise<void> {
    try {
      logger.info('[VectorizeConnector] Deleting vectors', {
        count: ids.length,
        indexName: this.indexName
      })

      const url = `${this.baseUrl}/accounts/${this.accountId}/vectorize/indexes/${this.indexName}/delete`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.apiToken ? `Bearer ${this.apiToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to delete vectors: ${response.status} - ${error}`)
      }

      logger.info('[VectorizeConnector] Vectors deleted successfully', {
        count: ids.length
      })

      this.emitEvent('vectorize:vectors:deleted', {
        indexName: this.indexName,
        count: ids.length
      })
    } catch (error) {
      logger.error('[VectorizeConnector] Failed to delete vectors', error)

      this.emitEvent('vectorize:vectors:error', {
        indexName: this.indexName,
        operation: 'delete',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * Get vector by ID
   */
  async get(ids: string[]): Promise<Vector[]> {
    try {
      logger.info('[VectorizeConnector] Getting vectors by ID', {
        count: ids.length,
        indexName: this.indexName
      })

      const url = `${this.baseUrl}/accounts/${this.accountId}/vectorize/indexes/${this.indexName}/get`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.apiToken ? `Bearer ${this.apiToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to get vectors: ${response.status} - ${error}`)
      }

      const data = (await response.json()) as { result: { vectors: Vector[] } }
      return data.result.vectors || []
    } catch (error) {
      logger.error('[VectorizeConnector] Failed to get vectors', error)
      throw error
    }
  }

  /**
   * Create embeddings for text (helper method)
   * Note: This would typically use an AI connector to generate embeddings
   */
  async createEmbedding(_text: string, _model?: string): Promise<number[]> {
    // This is a placeholder - in real implementation, you would use
    // an AI connector (like OpenAI or Cohere) to generate embeddings
    logger.warn(
      '[VectorizeConnector] createEmbedding is a placeholder - integrate with AI connector'
    )

    // Return dummy embedding for now
    return new Array(this.dimensions).fill(0).map(() => Math.random())
  }

  /**
   * Perform hybrid search (keyword + vector)
   */
  async hybridSearch(
    query: string,
    vectorQuery?: VectorSearchQuery,
    _keywordWeight = 0.5
  ): Promise<VectorMatch[]> {
    // This would combine keyword search with vector search
    // For now, just perform vector search if available
    if (vectorQuery?.vector) {
      return this.search(vectorQuery)
    }

    // Generate embedding for query text
    const embedding = await this.createEmbedding(query)

    return this.search({
      ...vectorQuery,
      vector: embedding
    })
  }
}
