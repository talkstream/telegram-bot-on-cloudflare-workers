/**
 * Telegram Bot API 9.1 Checklist Connector
 *
 * Provides support for checklist functionality in business accounts
 * @module connectors/messaging/telegram/checklist-connector
 */

import type { Bot } from 'grammy';

import type { InputChecklist, Checklist, InputChecklistTask } from '@/lib/telegram-types';
import { BaseConnector } from '@/connectors/base/base-connector';
import type { ILogger } from '@/core/interfaces/logger';
import { EventBus } from '@/core/events/event-bus';
import { ConnectorType } from '@/core/interfaces/connector';
import type {
  ConnectorConfig,
  ConnectorCapabilities,
  HealthStatus,
  ValidationResult,
} from '@/core/interfaces/connector';

export interface ChecklistOptions {
  business_connection_id?: string;
  disable_notification?: boolean;
  protect_content?: boolean;
  message_effect_id?: string;
  reply_parameters?: {
    message_id: number;
    chat_id?: number | string;
    allow_sending_without_reply?: boolean;
    quote?: string;
    quote_parse_mode?: string;
    quote_entities?: Array<unknown>;
    quote_position?: number;
  };
  reply_markup?: unknown;
}

export interface EditChecklistOptions {
  business_connection_id?: string;
  reply_markup?: unknown;
}

export class ChecklistConnector extends BaseConnector {
  id = 'checklist-connector';
  name = 'Telegram Checklist Connector';
  version = '1.0.0';
  type = ConnectorType.MESSAGING;

  private bot: Bot;
  private logger: ILogger;
  private localEventBus: EventBus;

  constructor(bot: Bot, logger: ILogger, eventBus: EventBus) {
    super();
    this.bot = bot;
    this.logger = logger;
    this.localEventBus = eventBus;
  }

  protected async doInitialize(_config: ConnectorConfig): Promise<void> {
    this.logger.info('[ChecklistConnector] Initializing Bot API 9.1 checklist support');

    // Emit initialization event
    this.localEventBus.emit(
      'connector:checklist:initialized',
      {
        connectorId: this.id,
        version: this.version,
      },
      this.id,
    );
  }

  protected doValidateConfig(_config: ConnectorConfig): ValidationResult['errors'] {
    return [];
  }

  protected checkReadiness(): boolean {
    return !!this.bot;
  }

  protected async checkHealth(): Promise<Partial<HealthStatus>> {
    return {
      status: 'healthy',
      message: 'Checklist connector is operational',
    };
  }

  protected async doDestroy(): Promise<void> {
    this.logger.info('[ChecklistConnector] Destroying connector');
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsAsync: true,
      supportsSync: false,
      supportsBatching: false,
      supportsStreaming: false,
      maxBatchSize: 1,
      maxConcurrent: 10,
      features: ['checklist', 'tasks', 'bot-api-9.1'],
    };
  }

  // Public initialization method for backward compatibility
  override async initialize(): Promise<void> {
    await this.doInitialize({});
  }

  /**
   * Send a checklist on behalf of a business account
   * Bot API 9.1 method: sendChecklist
   */
  async sendChecklist(
    chatId: number | string,
    checklist: InputChecklist,
    options?: ChecklistOptions,
  ): Promise<any> {
    try {
      this.logger.info('[ChecklistConnector] Sending checklist', {
        chatId,
        taskCount: checklist.tasks.length,
        title: checklist.title,
      });

      // Use Grammy's api.raw for new Bot API 9.1 methods
      const result = await (this.bot.api.raw as any).sendChecklist({
        chat_id: typeof chatId === 'number' ? chatId : parseInt(chatId, 10),
        checklist: {
          title: checklist.title || 'Checklist',
          tasks: checklist.tasks.map((task) => ({
            text: task.text,
            is_done: task.is_done || false,
          })),
        },
        ...options,
      });

      // Emit event for analytics
      this.localEventBus.emit(
        'checklist:sent',
        {
          chatId,
          checklistId: result.message_id,
          taskCount: checklist.tasks.length,
        },
        this.id,
      );

      return result;
    } catch (error) {
      this.logger.error('[ChecklistConnector] Failed to send checklist', { error });

      this.localEventBus.emit(
        'checklist:error',
        {
          chatId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        this.id,
      );

      throw error;
    }
  }

  /**
   * Edit a checklist on behalf of a business account
   * Bot API 9.1 method: editMessageChecklist
   */
  async editMessageChecklist(
    chatId: number | string,
    messageId: number,
    checklist: InputChecklist,
    options?: EditChecklistOptions,
  ): Promise<any> {
    try {
      this.logger.info('[ChecklistConnector] Editing checklist', {
        chatId,
        messageId,
        taskCount: checklist.tasks.length,
      });

      const result = await (this.bot.api.raw as any).editMessageChecklist({
        chat_id: typeof chatId === 'number' ? chatId : parseInt(chatId, 10),
        message_id: messageId,
        checklist: {
          title: checklist.title || 'Checklist',
          tasks: checklist.tasks.map((task) => ({
            text: task.text,
            is_done: task.is_done || false,
          })),
        },
        ...options,
      });

      // Emit event for analytics
      this.localEventBus.emit(
        'checklist:edited',
        {
          chatId,
          messageId,
          taskCount: checklist.tasks.length,
        },
        this.id,
      );

      return result;
    } catch (error) {
      this.logger.error('[ChecklistConnector] Failed to edit checklist', { error });

      this.localEventBus.emit(
        'checklist:error',
        {
          chatId,
          messageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        this.id,
      );

      throw error;
    }
  }

  /**
   * Parse checklist from incoming message
   */
  parseChecklist(message: any): Checklist | null {
    if (!message.checklist) {
      return null;
    }

    return {
      title: message.checklist.title,
      tasks: message.checklist.tasks || [],
      task_count: message.checklist.task_count || 0,
      done_task_count: message.checklist.done_task_count || 0,
    };
  }

  /**
   * Create a checklist builder for easy construction
   */
  createChecklistBuilder(): ChecklistBuilder {
    return new ChecklistBuilder();
  }

  async cleanup(): Promise<void> {
    this.logger.info('[ChecklistConnector] Cleaning up');

    this.localEventBus.emit(
      'connector:checklist:cleanup',
      {
        connectorId: this.id,
      },
      this.id,
    );
  }
}

/**
 * Helper class for building checklists
 */
export class ChecklistBuilder {
  private title?: string;
  private tasks: InputChecklistTask[] = [];

  setTitle(title: string): this {
    this.title = title;
    return this;
  }

  addTask(text: string, isDone = false): this {
    this.tasks.push({ text, is_done: isDone });
    return this;
  }

  addTasks(tasks: InputChecklistTask[]): this {
    this.tasks.push(...tasks);
    return this;
  }

  markTaskDone(index: number): this {
    if (this.tasks[index]) {
      this.tasks[index].is_done = true;
    }
    return this;
  }

  markTaskUndone(index: number): this {
    if (this.tasks[index]) {
      this.tasks[index].is_done = false;
    }
    return this;
  }

  toggleTask(index: number): this {
    if (this.tasks[index]) {
      this.tasks[index].is_done = !this.tasks[index].is_done;
    }
    return this;
  }

  clearTasks(): this {
    this.tasks = [];
    return this;
  }

  build(): InputChecklist {
    return {
      title: this.title,
      tasks: this.tasks,
    };
  }

  /**
   * Get statistics about the checklist
   */
  getStats(): { total: number; done: number; pending: number; progress: number } {
    const total = this.tasks.length;
    const done = this.tasks.filter((t) => t.is_done).length;
    const pending = total - done;
    const progress = total > 0 ? (done / total) * 100 : 0;

    return { total, done, pending, progress };
  }
}
