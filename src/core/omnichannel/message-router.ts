/**
 * Omnichannel Message Router - Core of Wireframe v2.0
 * 
 * Routes messages between different messaging platforms seamlessly
 * Allows writing bot logic once and deploying everywhere
 */

import type { EventBus } from '../events/event-bus.js';
import type { ILogger } from '../interfaces/logger.js';
import type { UnifiedMessage, MessageResult, MessagingConnector } from '../interfaces/messaging.js';
import { Platform, MessageType } from '../interfaces/messaging.js';

import { MessageTransformer } from './message-transformer.js';

export interface ChannelConfig {
  /** Channel identifier (telegram, whatsapp, discord, etc.) */
  channel: string;
  /** Connector instance for this channel */
  connector: MessagingConnector;
  /** Whether this channel is active */
  enabled?: boolean;
  /** Channel-specific configuration */
  config?: Record<string, unknown>;
}

export interface RouterConfig {
  /** List of channels to route messages to/from */
  channels: ChannelConfig[];
  /** Whether to use unified handlers across all channels */
  unifiedHandlers?: boolean;
  /** Event bus for cross-channel communication */
  eventBus: EventBus;
  /** Logger instance */
  logger: ILogger;
}

export interface MessageHandler {
  (message: UnifiedMessage, channel: string): Promise<void>;
}

export interface CommandHandler {
  (command: string, args: string[], message: UnifiedMessage, channel: string): Promise<void>;
}

/**
 * Omnichannel Message Router
 * 
 * Manages message flow between multiple messaging platforms
 */
export class OmnichannelMessageRouter {
  private channels = new Map<string, ChannelConfig>();
  private messageHandlers: MessageHandler[] = [];
  private commandHandlers = new Map<string, CommandHandler>();
  private eventBus: EventBus;
  private logger: ILogger;
  private transformer: MessageTransformer;

  constructor(config: RouterConfig) {
    this.eventBus = config.eventBus;
    this.logger = config.logger;
    this.transformer = new MessageTransformer({ logger: this.logger });

    // Register channels
    for (const channelConfig of config.channels) {
      this.addChannel(channelConfig);
    }
  }

  /**
   * Add a new channel to the router
   */
  addChannel(config: ChannelConfig): void {
    if (this.channels.has(config.channel)) {
      throw new Error(`Channel ${config.channel} already registered`);
    }

    this.channels.set(config.channel, config);
    
    // Subscribe to channel events
    this.subscribeToChannel(config);
    
    this.logger.info('Channel added to router', {
      channel: config.channel,
      enabled: config.enabled ?? true,
    });
  }

  /**
   * Remove a channel from the router
   */
  removeChannel(channel: string): void {
    const config = this.channels.get(channel);
    if (!config) {
      return;
    }

    // Unsubscribe from channel events
    this.unsubscribeFromChannel(config);
    
    this.channels.delete(channel);
    
    this.logger.info('Channel removed from router', { channel });
  }

  /**
   * Enable/disable a channel
   */
  setChannelEnabled(channel: string, enabled: boolean): void {
    const config = this.channels.get(channel);
    if (config) {
      config.enabled = enabled;
      this.logger.info('Channel status updated', { channel, enabled });
    }
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Register a command handler
   */
  command(command: string, handler: CommandHandler): void {
    this.commandHandlers.set(command, handler);
  }

  /**
   * Send a message to a specific channel
   */
  async sendToChannel(
    channel: string, 
    recipientId: string, 
    message: Partial<UnifiedMessage>
  ): Promise<MessageResult> {
    const config = this.channels.get(channel);
    if (!config || config.enabled === false) {
      throw new Error(`Channel ${channel} not available`);
    }

    // Create full message with defaults
    const fullMessage: UnifiedMessage = {
      id: message.id || Date.now().toString(),
      platform: message.platform || Platform.TELEGRAM, // Default platform
      content: message.content || { type: MessageType.TEXT, text: '' },
      timestamp: message.timestamp || Date.now(),
      ...message
    };

    // Transform message if it's from a different platform
    // TODO: Add getPlatform() method to MessagingConnector interface
    const targetPlatform = Platform.TELEGRAM; // Default for now
    if (fullMessage.platform && fullMessage.platform !== targetPlatform) {
      const platformMessage = this.transformer.toPlatform(fullMessage, targetPlatform);
      this.logger.debug('Message transformed', {
        from: fullMessage.platform,
        to: targetPlatform,
      });
      // Update the message with transformed data
      Object.assign(fullMessage, platformMessage.data);
    }

    return config.connector.sendMessage(recipientId, fullMessage);
  }

  /**
   * Broadcast a message to all enabled channels
   */
  async broadcast(
    recipientIds: Map<string, string[]>, 
    message: Partial<UnifiedMessage>
  ): Promise<Map<string, MessageResult[]>> {
    const results = new Map<string, MessageResult[]>();

    for (const [channel, recipients] of recipientIds) {
      const config = this.channels.get(channel);
      if (!config || config.enabled === false) {
        continue;
      }

      try {
        const fullMessage: UnifiedMessage = {
          id: message.id || Date.now().toString(),
          platform: message.platform || Platform.TELEGRAM, // Default platform
          content: message.content || { type: MessageType.TEXT, text: '' },
          timestamp: message.timestamp || Date.now(),
          ...message
        };
        
        const channelResults = await Promise.all(
          recipients.map(recipientId => 
            config.connector.sendMessage(recipientId, fullMessage)
          )
        );
        results.set(channel, channelResults);
      } catch (error) {
        this.logger.error('Failed to broadcast to channel', {
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get list of active channels
   */
  getActiveChannels(): string[] {
    return Array.from(this.channels.entries())
      .filter(([_, config]) => config.enabled !== false)
      .map(([channel]) => channel);
  }

  /**
   * Get channel configuration
   */
  getChannelConfig(channel: string): ChannelConfig | undefined {
    return this.channels.get(channel);
  }

  /**
   * Forward a message from one channel to another with automatic transformation
   */
  async forwardMessage(
    fromChannel: string,
    toChannel: string,
    message: UnifiedMessage,
    recipientId: string
  ): Promise<MessageResult> {
    const targetConfig = this.channels.get(toChannel);
    if (!targetConfig || targetConfig.enabled === false) {
      throw new Error(`Target channel ${toChannel} not available`);
    }

    // Transform the message for the target platform
    // TODO: Add getPlatform() method to MessagingConnector interface
    const targetPlatform = Platform.TELEGRAM; // Default for now
    const transformedMessage = this.transformer.toPlatform(message, targetPlatform);
    
    this.logger.info('Forwarding message across platforms', {
      from: fromChannel,
      to: toChannel,
      originalPlatform: message.platform,
      targetPlatform,
    });

    // Send using the transformed message data
    return this.sendToChannel(toChannel, recipientId, {
      ...message,
      platform: targetPlatform,
      metadata: transformedMessage.data,
    });
  }

  /**
   * Subscribe to channel events
   */
  private subscribeToChannel(config: ChannelConfig): void {
    // Listen for incoming messages from this channel
    this.eventBus.on(`${config.channel}:message:received`, async (event) => {
      const message = event.payload as UnifiedMessage;
      
      // Route to handlers
      await this.routeMessage(message, config.channel);
    });

    // Listen for command events
    this.eventBus.on(`${config.channel}:command:received`, async (event) => {
      const { command, args, message } = event.payload as {
        command: string;
        args: string[];
        message: UnifiedMessage;
      };
      
      await this.routeCommand(command, args, message, config.channel);
    });
  }

  /**
   * Unsubscribe from channel events
   */
  private unsubscribeFromChannel(config: ChannelConfig): void {
    this.eventBus.off(`${config.channel}:message:received`);
    this.eventBus.off(`${config.channel}:command:received`);
  }

  /**
   * Route incoming message to handlers
   */
  private async routeMessage(message: UnifiedMessage, channel: string): Promise<void> {
    // Call all message handlers
    for (const handler of this.messageHandlers) {
      try {
        await handler(message, channel);
      } catch (error) {
        this.logger.error('Message handler error', {
          channel,
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Route command to appropriate handler
   */
  private async routeCommand(
    command: string, 
    args: string[], 
    message: UnifiedMessage, 
    channel: string
  ): Promise<void> {
    const handler = this.commandHandlers.get(command);
    if (!handler) {
      this.logger.debug('No handler for command', { command, channel });
      return;
    }

    try {
      await handler(command, args, message, channel);
    } catch (error) {
      this.logger.error('Command handler error', {
        command,
        channel,
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Factory function for creating router
 */
export function createOmnichannelRouter(config: RouterConfig): OmnichannelMessageRouter {
  return new OmnichannelMessageRouter(config);
}