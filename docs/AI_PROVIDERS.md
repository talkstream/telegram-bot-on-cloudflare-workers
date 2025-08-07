# 🤖 AI Providers in Wireframe

## Overview

Wireframe v1.3 includes a sophisticated multi-provider AI system that allows you to:

- **Switch between providers** without code changes
- **Add custom models** including new Gemini variants
- **Track costs** across all providers
- **Implement fallbacks** for reliability
- **Mock providers** for testing

## Current Architecture

### Provider System

The AI functionality is implemented through a provider pattern:

```
src/
├── lib/ai/
│   ├── adapters/          # Provider implementations
│   │   ├── base.ts        # Base provider class
│   │   ├── google-ai.ts   # Google Gemini (uses gemini-service.ts)
│   │   ├── openai.ts      # OpenAI GPT models
│   │   ├── anthropic.ts   # Anthropic Claude models
│   │   ├── xai.ts         # xAI Grok
│   │   ├── deepseek.ts    # DeepSeek
│   │   ├── cloudflare.ts  # Cloudflare Workers AI
│   │   └── mock.ts        # Mock provider for testing
│   ├── registry.ts        # Provider registry
│   ├── types.ts           # TypeScript interfaces
│   └── cost-tracking.ts   # Usage and cost tracking
├── services/
│   ├── ai-service.ts      # Main AI service (uses providers)
│   └── gemini-service.ts  # Gemini-specific implementation
```

### How It Works

1. **AIService** is the main entry point
2. It uses the **provider registry** to manage available providers
3. **GoogleAIProvider** wraps the existing `gemini-service.ts`
4. All providers implement the same interface for consistency

## Supported Providers

| Provider      | Models                                     | Default              | Notes                                |
| ------------- | ------------------------------------------ | -------------------- | ------------------------------------ |
| Google Gemini | gemini-2.0-flash-exp, gemini-1.5-pro, etc. | gemini-2.0-flash-exp | Free tier available                  |
| OpenAI        | gpt-4o, gpt-4, gpt-3.5-turbo               | gpt-4o               | Requires API key                     |
| Anthropic     | claude-opus-4, claude-sonnet-4             | claude-sonnet-4      | Best coding model, extended thinking |
| xAI           | grok-1, grok-2                             | grok-2               | Requires API key                     |
| DeepSeek      | deepseek-v2                                | deepseek-v2          | Cost-effective option                |
| Cloudflare AI | Various models                             | @cf/meta/llama-2     | Integrated with Workers              |

## Configuration

### Basic Configuration

In your `.dev.vars` or environment:

```env
# Default provider
AI_PROVIDER=google-ai

# Provider API keys
GEMINI_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
XAI_API_KEY=your-key-here
DEEPSEEK_API_KEY=your-key-here
```

### Advanced Configuration

For custom models or multiple providers, use `AI_CONFIG`:

```env
AI_CONFIG={
  "providers": [
    {
      "id": "google-ai-lite",
      "type": "google-ai",
      "displayName": "Gemini 2.0 Flash Lite",
      "config": {
        "apiKey": "${GEMINI_API_KEY}",
        "model": "gemini-2.0-flash-exp"
      }
    },
    {
      "id": "google-ai-pro",
      "type": "google-ai",
      "displayName": "Gemini Pro",
      "config": {
        "apiKey": "${GEMINI_API_KEY}",
        "model": "gemini-1.5-pro"
      }
    }
  ],
  "default": "google-ai-lite",
  "fallback": ["google-ai-pro", "openai"]
}
```

## Adding Custom Models

### Method 1: Configuration (Recommended)

To add a new Gemini model like `gemini-2.0-flash-lite`:

```javascript
// In your bot initialization or .dev.vars
const aiConfig = {
  providers: [
    {
      id: 'gemini-lite',
      type: 'google-ai',
      displayName: 'Gemini 2.0 Flash Lite',
      config: {
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.0-flash-lite' // Your custom model
      }
    }
  ],
  default: 'gemini-lite'
}
```

### Method 2: Custom Provider

For more control, create a custom provider:

```typescript
// src/lib/ai/adapters/gemini-lite.ts
import { GoogleAIProvider } from './google-ai'

export class GeminiLiteProvider extends GoogleAIProvider {
  constructor(apiKey: string) {
    super({
      apiKey,
      model: 'gemini-2.0-flash-exp'
    })
  }

  // Override methods if needed for custom behavior
  async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    // Custom implementation or call super
    return super.doComplete(request)
  }
}
```

Then register it:

```typescript
// In your bot initialization
import { getProviderRegistry } from '@/lib/ai/registry'
import { GeminiLiteProvider } from '@/lib/ai/adapters/gemini-lite'

const registry = getProviderRegistry()
registry.register(
  'gemini-lite',
  {
    id: 'gemini-lite',
    type: 'google-ai',
    displayName: 'Gemini Lite',
    config: { apiKey: process.env.GEMINI_API_KEY }
  },
  GeminiLiteProvider
)
```

## Using AI in Your Bot

### Basic Usage

```typescript
// In your command handler
import { AIService } from '@/services/ai-service'

const ai = new AIService()
const response = await ai.complete('What is the weather today?')
await ctx.reply(response.content)
```

### With Specific Provider

```typescript
const response = await ai.complete('Translate to Spanish: Hello', {
  provider: 'gemini-lite' // Use your custom model
})
```

### With Fallbacks

```typescript
const ai = new AIService({
  defaultProvider: 'gemini-lite',
  fallbackProviders: ['google-ai', 'openai']
})
```

## Understanding gemini-service.ts

The `gemini-service.ts` file is **NOT legacy**. It's actively used by the GoogleAIProvider:

1. Provides Gemini-specific optimizations
2. Handles tier-based timeouts (free vs paid)
3. Implements retry logic
4. Used by GoogleAIProvider internally

You don't need to use it directly - the provider system handles it for you.

## Cost Tracking

Enable cost tracking to monitor usage:

```typescript
import { CostCalculator } from '@/lib/ai/cost-tracking'

const ai = new AIService({
  costTracking: {
    enabled: true,
    calculator: new CostCalculator()
  }
})

// Get usage stats
const stats = ai.getUsageStats()
console.log(`Total cost: $${stats.totalCost}`)
```

## Best Practices

1. **Use environment variables** for API keys
2. **Configure fallbacks** for production reliability
3. **Set appropriate timeouts** based on your Cloudflare plan
4. **Monitor costs** if using paid providers
5. **Test with mock provider** during development

## Troubleshooting

### Model not available

If you get "model not available" errors:

1. Check if the model name is correct
2. Verify your API key has access to the model
3. Some models may be in limited preview

### Timeout errors

For Cloudflare Workers free tier (10ms CPU limit):

- Use lightweight models
- Reduce max tokens
- Consider caching responses

### Cost concerns

- Start with free tiers (Gemini free quota)
- Use cost tracking to monitor usage
- Implement caching for repeated queries

## Future Enhancements

The AI system is designed for extensibility:

- Streaming responses (coming soon)
- Image generation providers
- Embedding models
- Local model support

---

For more details, see the implementation in `/src/lib/ai/` and `/src/services/ai-service.ts`.
