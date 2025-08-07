# Anthropic Claude AI Provider

This guide explains how to use Anthropic's Claude 4 models with Wireframe.

## Features

- **Claude Opus 4** - Most powerful model, best for complex tasks
- **Claude Sonnet 4** - Balanced performance model (default)
- **Extended Thinking** - Advanced reasoning capability for complex problems
- **Streaming Support** - Real-time response streaming
- **System Prompts** - Define assistant behavior
- **Vision Support** - Process images with text
- **Function Calling** - Structured outputs
- **Large Output** - Up to 64K output tokens (128K with beta header)

## Setup

### 1. Get API Key

1. Sign up at [Anthropic Console](https://console.anthropic.com)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key (starts with `sk-ant-`)

### 2. Configure Environment

Add to your `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

### 3. Set as Default Provider (Optional)

```env
AI_PROVIDER=anthropic
```

## Usage

### Basic Usage

The provider is automatically loaded when `ANTHROPIC_API_KEY` is set:

```typescript
// Automatically uses Anthropic if it's the default
const response = await aiService.complete('Explain quantum computing')
```

### Explicit Provider Selection

```typescript
const response = await aiService.complete('Write a haiku', {
  provider: 'anthropic'
})
```

### With System Prompt

```typescript
const response = await aiService.complete([
  { role: 'system', content: 'You are a helpful coding assistant.' },
  { role: 'user', content: 'Write a TypeScript function to sort an array' }
])
```

### Streaming Responses

```typescript
const stream = aiService.stream('Tell me a story', {
  provider: 'anthropic'
})

for await (const chunk of stream) {
  console.log(chunk)
}
```

## Available Models

### Claude Opus 4

- Model ID: `claude-opus-4-20250514`
- Best for: Complex tasks requiring deep reasoning, code generation
- Context: 200K tokens
- Output: Up to 64K tokens
- Pricing: $15 per million input tokens, $75 per million output tokens
- Strengths: Most powerful model, best at coding (72.5% on SWE-bench), extended thinking

### Claude Sonnet 4 (Default)

- Model ID: `claude-sonnet-4-20250514`
- Best for: Most AI use cases, user-facing assistants, high-volume tasks
- Context: 200K tokens
- Output: Up to 64K tokens
- Pricing: $3 per million input tokens, $15 per million output tokens
- Strengths: Balanced performance and cost, practical for production use

## Configuration Options

### Using Specific Model

```env
AI_PROVIDERS_CONFIG='{
  "providers": [{
    "id": "anthropic",
    "type": "anthropic",
    "config": {
      "model": "claude-opus-4-20250514"
    }
  }],
  "defaultProvider": "anthropic"
}'
```

### Custom Base URL

For enterprise or proxy setups:

```env
AI_PROVIDERS_CONFIG='{
  "providers": [{
    "id": "anthropic",
    "type": "anthropic",
    "config": {
      "baseURL": "https://your-proxy.com/anthropic"
    }
  }]
}'
```

## Advanced Options

### Temperature Control

```typescript
const response = await aiService.complete('Be creative', {
  provider: 'anthropic',
  temperature: 0.9 // 0-1, higher = more creative
})
```

### Max Tokens

```typescript
const response = await aiService.complete('Write a summary', {
  provider: 'anthropic',
  maxTokens: 500 // Limit response length
})
```

### Top-P Sampling

```typescript
const response = await aiService.complete('Generate ideas', {
  provider: 'anthropic',
  topP: 0.95 // Nucleus sampling parameter
})
```

### Stop Sequences

```typescript
const response = await aiService.complete('List items', {
  provider: 'anthropic',
  stopSequences: ['\n\n', 'END']
})
```

## Error Handling

The provider handles common errors:

- **Rate Limits**: Automatic retry with exponential backoff
- **Invalid API Key**: Clear error message
- **Context Length**: Handles up to 200K tokens
- **Network Issues**: Retries for transient failures

## Best Practices

1. **System Prompts**: Use them to define consistent behavior
2. **Temperature**: Use 0-0.3 for factual tasks, 0.7-1.0 for creative
3. **Streaming**: Use for long responses to improve UX
4. **Model Selection**: Use Sonnet 4 for most tasks, Opus 4 for complex reasoning
5. **Extended Thinking**: Let the model use extended thinking for complex problems

## Extended Thinking

Claude 4 models support extended thinking for complex problems:

```typescript
// Extended thinking is automatically used when the model needs more time
// to reason through complex problems
const response = await aiService.complete('Solve this complex algorithm problem...', {
  provider: 'anthropic',
  model: 'claude-opus-4-20250514'
})
```

## Cost Considerations

Anthropic charges per token (input + output):

- **Claude Opus 4**: $15/$75 per million tokens (input/output) - Premium model
- **Claude Sonnet 4**: $3/$15 per million tokens (input/output) - Balanced pricing

Enable cost tracking to monitor usage:

```env
AI_COST_TRACKING_ENABLED=true
```

## Troubleshooting

### "Invalid API Key"

- Verify key starts with `sk-ant-`
- Check key isn't expired/revoked
- Ensure no extra spaces in .env

### "Rate limit exceeded"

- Anthropic has per-minute limits
- Use exponential backoff
- Consider upgrading plan

### "Context length exceeded"

- Claude supports 200K tokens max
- Count tokens before sending
- Truncate or summarize if needed

## Migration from OpenAI

Claude 4 models are excellent alternatives to GPT models:

- **GPT-4** → **Claude Sonnet 4**: Better performance, more cost-effective
- **GPT-4 Turbo** → **Claude Opus 4**: Superior for complex tasks and coding
- **GPT-3.5** → **Claude Sonnet 4**: Much more capable

Key advantages of Claude 4:

- Extended thinking for complex reasoning
- Better at following instructions
- Superior coding performance (Opus 4)
- Larger output capacity (up to 64K tokens)
- More consistent formatting

## Examples

### Code Generation

```typescript
const response = await aiService.complete(
  [
    {
      role: 'system',
      content: 'You are an expert TypeScript developer.'
    },
    {
      role: 'user',
      content: 'Write a React hook for debouncing input'
    }
  ],
  {
    provider: 'anthropic',
    temperature: 0.2
  }
)
```

### Data Analysis

```typescript
const response = await aiService.complete(
  [
    {
      role: 'user',
      content: `Analyze this data: ${JSON.stringify(data)}`
    }
  ],
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514'
  }
)
```

### Complex Problem Solving

```typescript
// Use Opus 4 for complex tasks that benefit from extended thinking
const response = await aiService.complete('Design a distributed system architecture...', {
  provider: 'anthropic',
  model: 'claude-opus-4-20250514',
  temperature: 0.2
})
```

### Large Output Generation

```typescript
// Generate extensive documentation or code
const response = await aiService.complete('Generate comprehensive API documentation...', {
  provider: 'anthropic',
  maxTokens: 50000 // Up to 64K tokens supported
})
```

## Support

- [Anthropic Documentation](https://docs.anthropic.com)
- [API Reference](https://docs.anthropic.com/reference)
- [Model Updates](https://docs.anthropic.com/models)
- [Status Page](https://status.anthropic.com)
