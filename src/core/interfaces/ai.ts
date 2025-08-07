import type { Connector } from './connector.js'

/**
 * AI connector interface for LLM providers
 */
export interface AIConnector extends Connector {
  /**
   * Generate text completion
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>

  /**
   * Stream text completion
   */
  stream?(request: CompletionRequest): AsyncIterator<StreamChunk>

  /**
   * Generate embeddings
   */
  embeddings?(texts: string | string[]): Promise<Embedding[]>

  /**
   * Process vision input
   */
  vision?(images: VisionInput[], prompt: string): Promise<VisionResponse>

  /**
   * Process audio input
   */
  audio?(audio: AudioInput, options?: AudioOptions): Promise<AudioResponse>

  /**
   * List available models
   */
  listModels?(): Promise<Model[]>

  /**
   * Get model information
   */
  getModelInfo(modelId: string): Promise<ModelInfo>

  /**
   * Calculate cost for usage
   */
  calculateCost(usage: Usage): Cost

  /**
   * Validate API credentials
   */
  validateCredentials(): Promise<boolean>

  /**
   * Get AI-specific capabilities
   */
  getAICapabilities(): AICapabilities
}

export interface CompletionRequest {
  /**
   * The model to use
   */
  model: string

  /**
   * The prompt or messages
   */
  messages: Message[]

  /**
   * Maximum tokens to generate
   */
  max_tokens?: number

  /**
   * Temperature for randomness
   */
  temperature?: number

  /**
   * Top-p nucleus sampling
   */
  top_p?: number

  /**
   * Stop sequences
   */
  stop?: string[]

  /**
   * System prompt
   */
  system?: string

  /**
   * Response format
   */
  response_format?: ResponseFormat

  /**
   * Tools/functions available
   */
  tools?: Tool[]

  /**
   * Additional parameters
   */
  [key: string]: unknown
}

export interface Message {
  role: MessageRole
  content: string | MessageContent[]
  name?: string
  function_call?: FunctionCall
  tool_calls?: ToolCall[]
}

export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  FUNCTION = 'function',
  TOOL = 'tool'
}

export interface MessageContent {
  type: 'text' | 'image_url' | 'image' | 'audio' | 'video'
  text?: string
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' }
  image?: Buffer
  audio?: Buffer
  video?: Buffer
}

export interface CompletionResponse {
  id: string
  model: string
  content: string
  role: MessageRole
  finish_reason?: FinishReason
  usage?: Usage
  tool_calls?: ToolCall[]
  metadata?: Record<string, unknown>
}

export enum FinishReason {
  STOP = 'stop',
  LENGTH = 'length',
  TOOL_CALLS = 'tool_calls',
  CONTENT_FILTER = 'content_filter',
  ERROR = 'error'
}

export interface StreamChunk {
  id: string
  delta: {
    content?: string
    role?: MessageRole
    tool_calls?: ToolCall[]
  }
  finish_reason?: FinishReason
  usage?: Usage
}

export interface Usage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

export interface Cost {
  total: number
  currency: string
  breakdown?: {
    prompt: number
    completion: number
    cache_hit?: number
    cache_miss?: number
  }
}

export interface Embedding {
  embedding: number[]
  index: number
  metadata?: Record<string, unknown>
}

export interface VisionInput {
  type: 'url' | 'base64' | 'buffer'
  data: string | Buffer
  mime_type?: string
}

export interface VisionResponse {
  content: string
  usage?: Usage
  metadata?: Record<string, unknown>
}

export interface AudioInput {
  type: 'url' | 'base64' | 'buffer'
  data: string | Buffer
  mime_type?: string
}

export interface AudioOptions {
  language?: string
  task?: 'transcribe' | 'translate'
  temperature?: number
  format?: 'json' | 'text' | 'srt' | 'vtt'
}

export interface AudioResponse {
  text: string
  language?: string
  duration?: number
  segments?: AudioSegment[]
  metadata?: Record<string, unknown>
}

export interface AudioSegment {
  start: number
  end: number
  text: string
  confidence?: number
}

export interface Model {
  id: string
  name: string
  description?: string
  context_window: number
  max_output_tokens?: number
  input_cost?: number // per 1K tokens
  output_cost?: number // per 1K tokens
  capabilities?: ModelCapabilities
  deprecated?: boolean
}

export interface ModelInfo extends Model {
  vendor: string
  version?: string
  release_date?: string
  training_cutoff?: string
  languages?: string[]
  specialties?: string[]
}

export interface ModelCapabilities {
  chat: boolean
  completion: boolean
  embeddings: boolean
  vision: boolean
  audio: boolean
  function_calling: boolean
  json_mode: boolean
  streaming: boolean
}

export interface ResponseFormat {
  type: 'text' | 'json_object' | 'json_schema'
  json_schema?: Record<string, unknown>
}

export interface Tool {
  type: 'function'
  function: FunctionDefinition
}

export interface FunctionDefinition {
  name: string
  description?: string
  parameters?: Record<string, unknown> // JSON Schema
}

export interface FunctionCall {
  name: string
  arguments: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: FunctionCall
}

export interface AICapabilities {
  /**
   * Available models
   */
  models: string[]

  /**
   * Maximum context window
   */
  maxContextWindow: number

  /**
   * Maximum output tokens
   */
  maxOutputTokens: number

  /**
   * Supports streaming
   */
  supportsStreaming: boolean

  /**
   * Supports embeddings
   */
  supportsEmbeddings: boolean

  /**
   * Supports vision
   */
  supportsVision: boolean

  /**
   * Supports audio
   */
  supportsAudio: boolean

  /**
   * Supports function calling
   */
  supportsFunctionCalling: boolean

  /**
   * Supports JSON mode
   */
  supportsJsonMode: boolean

  /**
   * Rate limits
   */
  rateLimits?: {
    requests_per_minute?: number
    tokens_per_minute?: number
    requests_per_day?: number
  }

  /**
   * Custom capabilities
   */
  custom?: Record<string, unknown>
}
