/**
 * WireframeBot - The main entry point for Wireframe v2.0
 *
 * One Bot, All Channels - Write once, deploy everywhere
 */

import type { EventBus } from '../events/event-bus.js';
import type { ILogger } from '../interfaces/logger.js';
import type { UnifiedMessage, MessagingConnector } from '../interfaces/messaging.js';
import type { CloudPlatform } from '../interfaces/cloud-platform.js';
import type { Plugin, PluginContext } from '../plugins/plugin.js';
import { MessageType, ChatType } from '../interfaces/messaging.js';
import { createEventBus } from '../events/event-bus.js';
import { ConsoleLogger } from '../logging/console-logger.js';

import { ChannelFactory } from './channel-factory.js';
import { OmnichannelMessageRouter, type ChannelConfig } from './message-router.js';

export interface WireframeBotConfig {
  /** List of channels to enable (telegram, whatsapp, discord, etc.) */
  channels: string[] | ChannelConfig[];
  /** Whether to use unified handlers across all channels */
  unifiedHandlers?: boolean;
  /** Cloud platform instance */
  platform?: CloudPlatform;
  /** Logger instance */
  logger?: ILogger;
  /** EventBus instance */
  eventBus?: EventBus;
  /** Plugins to install on startup */
  plugins?: Plugin[];
}

export interface BotContext {
  /** The channel this message came from */
  channel: string;
  /** The original message */
  message: UnifiedMessage;
  /** Reply to the message */
  reply: (text: string, options?: ReplyOptions) => Promise<void>;
  /** Send a message to a specific channel */
  sendTo: (
    channel: string,
    recipientId: string,
    text: string,
    options?: ReplyOptions,
  ) => Promise<void>;
  /** React to the message (if supported by platform) */
  react?: (emoji: string) => Promise<void>;
  /** Edit the original message (if supported) */
  edit?: (text: string, options?: ReplyOptions) => Promise<void>;
  /** Delete the message (if supported) */
  delete?: () => Promise<void>;
  /** User's sender information */
  sender: UnifiedMessage['sender'];
  /** Chat information */
  chat: UnifiedMessage['chat'];
}

export interface ReplyOptions {
  /** Markdown formatting */
  markdown?: boolean;
  /** HTML formatting */
  html?: boolean;
  /** Inline keyboard markup */
  keyboard?: Array<Array<{ text: string; callback?: string; url?: string }>>;
  /** Reply to specific message */
  replyTo?: string;
  /** Disable link preview */
  disableLinkPreview?: boolean;
}

/**
 * The main bot class for Wireframe v2.0
 */
export class WireframeBot {
  private router: OmnichannelMessageRouter;
  private eventBus: EventBus;
  private logger: ILogger;
  private channelFactory: ChannelFactory;
  private plugins = new Map<string, Plugin>();
  private messageHandlers: Array<(ctx: BotContext) => Promise<void> | void> = [];
  private commands = new Map<string, (ctx: BotContext, args: string[]) => Promise<void> | void>();

  constructor(config: WireframeBotConfig) {
    // Initialize core components
    this.eventBus = config.eventBus || createEventBus();
    this.logger = config.logger || new ConsoleLogger('info');

    // Create channel factory
    this.channelFactory = new ChannelFactory({
      logger: this.logger,
      eventBus: this.eventBus,
    });

    // Convert channel strings to ChannelConfig objects
    const channelConfigs = this.normalizeChannels(config.channels);

    // Create the omnichannel router
    this.router = new OmnichannelMessageRouter({
      channels: channelConfigs,
      unifiedHandlers: config.unifiedHandlers ?? true,
      eventBus: this.eventBus,
      logger: this.logger,
    });

    // Set up core event handlers
    this.setupCoreHandlers();

    // Install plugins if provided
    if (config.plugins) {
      config.plugins.forEach((plugin) => this.installPlugin(plugin));
    }
  }

  /**
   * Register a command handler
   */
  command(
    command: string,
    handler: (ctx: BotContext, args: string[]) => Promise<void> | void,
  ): void {
    this.commands.set(command, handler);

    // Register with router
    this.router.command(command, async (_cmd, args, message, channel) => {
      const ctx = this.createContext(message, channel);
      await handler(ctx, args);
    });
  }

  /**
   * Register a message handler
   */
  on(event: 'message', handler: (ctx: BotContext) => Promise<void> | void): void {
    if (event === 'message') {
      this.messageHandlers.push(handler);
    }
  }

  /**
   * Register a text pattern handler
   */
  hears(pattern: string | RegExp, handler: (ctx: BotContext) => Promise<void> | void): void {
    this.on('message', async (ctx) => {
      const text = ctx.message.content.text;
      if (!text) return;

      if (typeof pattern === 'string') {
        if (text.includes(pattern)) {
          await handler(ctx);
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(text)) {
          await handler(ctx);
        }
      }
    });
  }

  /**
   * Install a plugin
   */
  async installPlugin(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already installed`);
    }

    // Create a minimal plugin context
    // TODO: Integrate with full PluginManager later
    const context = {
      eventBus: this.eventBus,
      logger: this.logger,
      commands: new Map<string, { handler: (args: string[], context: unknown) => Promise<void> }>(),
    } as unknown as PluginContext;

    await plugin.install(context);
    this.plugins.set(plugin.id, plugin);

    // Register plugin commands
    context.commands.forEach((cmd, name) => {
      this.command(name, async (ctx, args) => {
        // Convert to plugin command context
        const cmdContext = {
          sender: {
            id: ctx.sender?.id || '',
            firstName: ctx.sender?.first_name,
            lastName: ctx.sender?.last_name,
            username: ctx.sender?.username,
          },
          args: args.reduce(
            (acc, arg, index) => {
              acc[`arg${index}`] = arg;
              return acc;
            },
            {} as Record<string, unknown>,
          ),
          reply: (text: string) => ctx.reply(text),
          plugin: context,
        };
        await cmd.handler(args, cmdContext);
      });
    });

    this.logger.info('Plugin installed', { pluginId: plugin.id });
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }

    if (plugin.deactivate) {
      await plugin.deactivate();
    }

    this.plugins.delete(pluginId);
    this.logger.info('Plugin uninstalled', { pluginId });
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    // Activate all plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.activate) {
        await plugin.activate();
      }
    }

    this.logger.info('Bot started', {
      channels: this.router.getActiveChannels(),
      plugins: Array.from(this.plugins.keys()),
    });
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    // Deactivate all plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.deactivate) {
        await plugin.deactivate();
      }
    }

    this.logger.info('Bot stopped');
  }

  /**
   * Get the event bus for custom event handling
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get the router for advanced channel management
   */
  getRouter(): OmnichannelMessageRouter {
    return this.router;
  }

  /**
   * Hot-add a new channel at runtime
   */
  async addChannel(channel: string | ChannelConfig): Promise<void> {
    const config = typeof channel === 'string' ? await this.createChannelConfig(channel) : channel;

    this.router.addChannel(config);
  }

  /**
   * Remove a channel at runtime
   */
  removeChannel(channel: string): void {
    this.router.removeChannel(channel);
  }

  /**
   * Enable/disable a channel
   */
  setChannelEnabled(channel: string, enabled: boolean): void {
    this.router.setChannelEnabled(channel, enabled);
  }

  /**
   * Normalize channel configuration
   */
  private normalizeChannels(channels: string[] | ChannelConfig[]): ChannelConfig[] {
    const configs: ChannelConfig[] = [];

    for (const channel of channels) {
      if (typeof channel === 'string') {
        // For string channels, we'll create config but connector will be loaded later
        // Placeholder connector that will be replaced by factory
        const placeholderConnector = {} as MessagingConnector;
        configs.push({
          channel,
          connector: placeholderConnector,
          enabled: true,
        });
      } else {
        configs.push(channel);
      }
    }

    return configs;
  }

  /**
   * Create channel configuration from string
   */
  private async createChannelConfig(channelId: string): Promise<ChannelConfig> {
    try {
      const connector = await this.channelFactory.getConnector(channelId);
      return {
        channel: channelId,
        connector,
        enabled: true,
      };
    } catch (error) {
      this.logger.error('Failed to create channel config', { channelId, error });
      throw error;
    }
  }

  /**
   * Set up core event handlers
   */
  private setupCoreHandlers(): void {
    // Handle incoming messages
    this.router.onMessage(async (message, channel) => {
      const ctx = this.createContext(message, channel);

      // Process through all message handlers
      for (const handler of this.messageHandlers) {
        try {
          await handler(ctx);
        } catch (error) {
          this.logger.error('Message handler error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            channel,
            messageId: message.id,
          });
        }
      }
    });
  }

  /**
   * Create bot context from message
   */
  private createContext(message: UnifiedMessage, channel: string): BotContext {
    const ctx: BotContext = {
      channel,
      message,
      sender: message.sender,
      chat: message.chat,

      reply: async (text: string, options?: ReplyOptions) => {
        const chatId = message.chat?.id || message.sender?.id || 'unknown';
        await this.router.sendToChannel(channel, chatId, {
          id: Date.now().toString(),
          platform: message.platform,
          sender: undefined, // Bot's sender info
          chat: message.chat || { id: '', type: ChatType.PRIVATE },
          content: {
            type: MessageType.TEXT,
            text,
            markup: options?.keyboard
              ? {
                  type: 'inline' as const,
                  inline_keyboard: options.keyboard.map((row) =>
                    row.map((btn) => ({
                      text: btn.text,
                      callback_data: btn.callback,
                      url: btn.url,
                    })),
                  ),
                }
              : undefined,
          },
          metadata: {
            replyTo: options?.replyTo || message.id,
            parseMode: options?.markdown ? 'Markdown' : options?.html ? 'HTML' : undefined,
            disableLinkPreview: options?.disableLinkPreview,
          },
          timestamp: Date.now(),
        });
      },

      sendTo: async (
        targetChannel: string,
        recipientId: string,
        text: string,
        options?: ReplyOptions,
      ) => {
        await this.router.sendToChannel(targetChannel, recipientId, {
          id: Date.now().toString(),
          platform: message.platform,
          sender: undefined, // Bot's sender info
          chat: { id: recipientId, type: ChatType.PRIVATE },
          content: {
            type: MessageType.TEXT,
            text,
            markup: options?.keyboard
              ? {
                  type: 'inline' as const,
                  inline_keyboard: options.keyboard.map((row) =>
                    row.map((btn) => ({
                      text: btn.text,
                      callback_data: btn.callback,
                      url: btn.url,
                    })),
                  ),
                }
              : undefined,
          },
          metadata: {
            parseMode: options?.markdown ? 'Markdown' : options?.html ? 'HTML' : undefined,
            disableLinkPreview: options?.disableLinkPreview,
          },
          timestamp: Date.now(),
        });
      },
    };

    // Add platform-specific capabilities if available
    const capabilities = this.router
      .getChannelConfig(channel)
      ?.connector.getMessagingCapabilities?.();

    if (capabilities?.supportsReactions) {
      ctx.react = async (_emoji: string) => {
        // Implementation would depend on platform
        this.logger.info('Reaction requested', { channel, messageId: message.id });
      };
    }

    if (capabilities?.supportsEditing) {
      ctx.edit = async (_text: string, _options?: ReplyOptions) => {
        // Implementation would depend on platform
        this.logger.info('Edit requested', { channel, messageId: message.id });
      };
    }

    if (capabilities?.supportsDeleting) {
      ctx.delete = async () => {
        // Implementation would depend on platform
        this.logger.info('Delete requested', { channel, messageId: message.id });
      };
    }

    return ctx;
  }
}

/**
 * Factory function for creating a bot
 */
export function createBot(config: WireframeBotConfig): WireframeBot {
  return new WireframeBot(config);
}
