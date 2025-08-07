# Discord Connector for Wireframe

This connector enables Discord bot functionality within the Wireframe platform, supporting both webhook-based interactions and REST API operations.

## Features

- ✅ Webhook-based interaction handling
- ✅ Slash command support
- ✅ Message components (buttons, select menus)
- ✅ Rich embeds
- ✅ Thread support
- ✅ Reaction support
- ✅ Bulk message operations
- ✅ Full TypeScript type safety

## Configuration

```typescript
import { DiscordConnector } from '@/connectors/messaging/discord'

const connector = new DiscordConnector()
await connector.initialize({
  applicationId: process.env.DISCORD_APPLICATION_ID,
  publicKey: process.env.DISCORD_PUBLIC_KEY,
  botToken: process.env.DISCORD_BOT_TOKEN, // Optional, for REST API
  webhookUrl: process.env.DISCORD_WEBHOOK_URL
})
```

## Usage Example

```typescript
// Send a message with buttons
await connector.sendMessage(channelId, {
  content: {
    text: 'Choose an option:',
    markup: {
      type: 'inline',
      inline_keyboard: [
        [
          { text: 'Option 1', callback_data: 'opt1' },
          { text: 'Option 2', callback_data: 'opt2' }
        ]
      ]
    }
  }
})

// Handle webhook
app.post('/discord/webhook', async req => {
  return await connector.handleWebhook(req)
})
```

## Discord-Specific Features

The connector provides access to Discord-specific features through the `custom` capabilities:

- **Slash Commands**: Native support for Discord slash commands
- **Components**: Buttons, select menus, and modals
- **Embeds**: Rich message embeds with images and fields
- **Threads**: Create and manage discussion threads

## Setting Up Discord Bot

1. Create application at https://discord.com/developers/applications
2. Get Application ID and Public Key from General Information
3. Create bot and get token from Bot section
4. Set up interactions endpoint URL in your application settings
5. Add bot to server with appropriate permissions

## Environment Variables

```env
DISCORD_APPLICATION_ID=your_app_id
DISCORD_PUBLIC_KEY=your_public_key
DISCORD_BOT_TOKEN=your_bot_token  # Optional
DISCORD_WEBHOOK_URL=https://your-domain.com/discord/webhook
```

## Webhook Validation

The connector automatically validates Discord webhook signatures using the public key. This ensures that webhook requests are genuinely from Discord.

## Type Safety

All Discord-specific types are exported from the types file, including:

- `InteractionType`
- `InteractionResponseType`
- `ComponentType`
- `ButtonStyle`
- `MessageFlags`

## Error Handling

The connector provides proper error handling with `DiscordAPIError` for API-specific errors, making it easy to handle Discord rate limits and other API errors gracefully.

## Performance

- Optimized for edge computing environments
- Minimal dependencies
- Supports Cloudflare Workers and similar platforms
- Efficient webhook signature verification

## Future Enhancements

- [ ] Voice channel support
- [ ] Stage channel support
- [ ] Forum channel support
- [ ] Advanced permission handling
- [ ] Audit log integration
