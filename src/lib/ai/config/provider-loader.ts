import { logger } from '../../logger'
import { AnthropicProvider } from '../adapters/anthropic'
import { CloudflareAIBindingProvider, CloudflareAIProvider } from '../adapters/cloudflare-ai'
import { GoogleAIProvider } from '../adapters/google-ai'
import type { MockProviderConfig } from '../adapters/mock'
import { MockAIProvider } from '../adapters/mock'
import {
  createDeepSeekProvider,
  createOpenAIProvider,
  createXAIProvider
} from '../adapters/openai-compatible'
import { ConfigBasedCostCalculator, RemoteCostCalculator } from '../cost-tracking'
import type { AIProvider, CostCalculator, CostFactors, ProviderConfig } from '../types'

import type { Env } from '@/types/env'

export interface ProvidersConfig {
  providers: Array<{
    id: string
    type: string
    enabled?: boolean
    config?: Record<string, unknown>
  }>
  defaultProvider?: string
  fallbackProviders?: string[]
  costTracking?: {
    enabled: boolean
    configUrl?: string
    config?: Record<string, unknown>
  }
}

/**
 * Load AI providers from environment configuration
 */
export async function loadProvidersFromEnv(
  env: Env,
  tier: 'free' | 'paid' = 'free'
): Promise<{
  providers: AIProvider[]
  defaultProvider: string | null
  fallbackProviders: string[]
  costCalculator?: CostCalculator
}> {
  const providers: AIProvider[] = []
  let defaultProvider: string | null = null
  let fallbackProviders: string[] = []
  let costCalculator: CostCalculator | undefined

  // Check if there's a JSON config
  if (env.AI_PROVIDERS_CONFIG) {
    try {
      const config: ProvidersConfig = JSON.parse(env.AI_PROVIDERS_CONFIG)

      // Load providers from config
      for (const providerConfig of config.providers) {
        if (providerConfig.enabled !== false) {
          const provider = await createProviderFromConfig(providerConfig, env, tier)
          if (provider) {
            providers.push(provider)
          }
        }
      }

      defaultProvider = config.defaultProvider || null
      fallbackProviders = config.fallbackProviders || []

      // Setup cost tracking
      if (config.costTracking?.enabled) {
        costCalculator = await createCostCalculator(config.costTracking, env)
      }
    } catch (error) {
      logger.error('Failed to parse AI_PROVIDERS_CONFIG:', error)
    }
  } else {
    // Fallback to individual environment variables
    // Google AI (Gemini)
    if (env.GEMINI_API_KEY) {
      providers.push(new GoogleAIProvider({ apiKey: env.GEMINI_API_KEY }, tier))
      if (!defaultProvider) defaultProvider = 'google-ai'
    }

    // OpenAI
    if (env.OPENAI_API_KEY) {
      providers.push(createOpenAIProvider(env.OPENAI_API_KEY, undefined, tier))
      if (!defaultProvider) defaultProvider = 'openai'
    }

    // xAI Grok
    if (env.XAI_API_KEY) {
      providers.push(createXAIProvider(env.XAI_API_KEY, undefined, tier))
      if (!defaultProvider) defaultProvider = 'xai'
    }

    // DeepSeek
    if (env.DEEPSEEK_API_KEY) {
      providers.push(createDeepSeekProvider(env.DEEPSEEK_API_KEY, undefined, tier))
      if (!defaultProvider) defaultProvider = 'deepseek'
    }

    // Anthropic Claude
    if (env.ANTHROPIC_API_KEY) {
      providers.push(new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY }, tier))
      if (!defaultProvider) defaultProvider = 'anthropic'
    }

    // Cloudflare AI
    if (env.CLOUDFLARE_AI_ACCOUNT_ID && env.CLOUDFLARE_AI_API_TOKEN) {
      providers.push(
        new CloudflareAIProvider(
          {
            accountId: env.CLOUDFLARE_AI_ACCOUNT_ID,
            apiToken: env.CLOUDFLARE_AI_API_TOKEN
          },
          tier
        )
      )
      if (!defaultProvider) defaultProvider = 'cloudflare-ai'
    }

    // Use AI binding if available (Workers environment)
    const envWithAI = env as Env & { AI?: unknown }
    if (envWithAI.AI) {
      providers.push(
        new CloudflareAIBindingProvider(
          envWithAI.AI as ConstructorParameters<typeof CloudflareAIBindingProvider>[0],
          undefined,
          tier
        )
      )
      if (!defaultProvider) defaultProvider = 'cloudflare-ai-binding'
    }

    // Override default if specified
    if (env.AI_PROVIDER) {
      defaultProvider = env.AI_PROVIDER
    }

    // Setup cost tracking from environment
    if (env.AI_COST_TRACKING_ENABLED) {
      costCalculator = await createCostCalculator(
        {
          enabled: true,
          ...(env.AI_COST_CONFIG_URL && { configUrl: env.AI_COST_CONFIG_URL })
        },
        env
      )
    }
  }

  // Add mock provider in development
  if (env.ENVIRONMENT === 'development') {
    providers.push(new MockAIProvider())
  }

  return {
    providers,
    defaultProvider,
    fallbackProviders,
    ...(costCalculator && { costCalculator })
  }
}

/**
 * Create a provider from configuration
 */
async function createProviderFromConfig(
  config: ProviderConfig & { type: string },
  env: Env,
  tier: 'free' | 'paid'
): Promise<AIProvider | null> {
  try {
    switch (config.type) {
      case 'google-ai':
        return new GoogleAIProvider(
          {
            apiKey: (config.config?.apiKey as string) || env.GEMINI_API_KEY || '',
            model: config.config?.model as string
          },
          tier
        )

      case 'openai':
        return createOpenAIProvider(
          (config.config?.apiKey as string) || env.OPENAI_API_KEY || '',
          config.config?.model as string,
          tier
        )

      case 'xai':
        return createXAIProvider(
          (config.config?.apiKey as string) || env.XAI_API_KEY || '',
          config.config?.model as string,
          tier
        )

      case 'deepseek':
        return createDeepSeekProvider(
          (config.config?.apiKey as string) || env.DEEPSEEK_API_KEY || '',
          config.config?.model as string,
          tier
        )

      case 'cloudflare-ai':
        return new CloudflareAIProvider(
          {
            accountId: (config.config?.accountId as string) || env.CLOUDFLARE_AI_ACCOUNT_ID || '',
            apiToken: (config.config?.apiToken as string) || env.CLOUDFLARE_AI_API_TOKEN || '',
            model: config.config?.model as string
          },
          tier
        )

      case 'cloudflare-ai-binding': {
        const envWithBinding = env as Env & { AI?: unknown }
        if (envWithBinding.AI) {
          return new CloudflareAIBindingProvider(
            envWithBinding.AI as ConstructorParameters<typeof CloudflareAIBindingProvider>[0],
            config.config?.model as string,
            tier
          )
        }
        return null
      }

      case 'anthropic':
        return new AnthropicProvider(
          {
            apiKey: (config.config?.apiKey as string) || env.ANTHROPIC_API_KEY || '',
            model: config.config?.model as string,
            baseURL: config.config?.baseURL as string
          },
          tier
        )

      case 'mock':
        return new MockAIProvider(config.config as MockProviderConfig)

      default:
        logger.warn(`Unknown provider type: ${config.type}`)
        return null
    }
  } catch (error) {
    logger.error(`Failed to create provider ${config.id}:`, error)
    return null
  }
}

/**
 * Create cost calculator from configuration
 */
async function createCostCalculator(
  config: { enabled: boolean; configUrl?: string; config?: Record<string, unknown> },
  _env: Env
): Promise<CostCalculator | undefined> {
  if (!config.enabled) {
    return undefined
  }

  if (config.configUrl) {
    return new RemoteCostCalculator(config.configUrl)
  }

  if (config.config) {
    // Convert simple config to CostFactors format
    const costFactors: Record<string, CostFactors> = {}
    for (const [providerId, costs] of Object.entries(
      config.config as Record<string, Record<string, number>>
    )) {
      costFactors[providerId] = {
        inputUnitCost: costs.inputUnitCost || 0,
        outputUnitCost: costs.outputUnitCost || 0,
        computeUnitCost: costs.computeUnitCost || 0,
        customCosts:
          typeof costs.customCosts === 'object' && costs.customCosts !== null
            ? costs.customCosts
            : {},
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'config'
      }
    }
    return new ConfigBasedCostCalculator(costFactors)
  }

  // Default: empty config-based calculator
  return new ConfigBasedCostCalculator()
}
