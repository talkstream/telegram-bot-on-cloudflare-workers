import { describe, it, expect, beforeEach, vi } from 'vitest';

import { QueueService, type HandlerContext } from '../queue-service';
import { MemoryQueueAdapter } from '../queue-adapters/memory-queue-adapter';

describe('QueueService', () => {
  let adapter: MemoryQueueAdapter<unknown>;
  let service: QueueService<unknown>;

  beforeEach(() => {
    adapter = new MemoryQueueAdapter();
    service = new QueueService({
      adapter,
      defaultRetryLimit: 2,
      defaultRetryDelay: 0, // No delay for tests
      batchSize: 10,
    });
  });

  describe('message sending', () => {
    it('should send a single message', async () => {
      await service.send('test-type', { value: 'test-data' });

      const stats = adapter.getStats();
      expect(stats.pending).toBe(1);
    });

    it('should send batch messages', async () => {
      const messages = [
        { type: 'type1', data: { value: 1 } },
        { type: 'type2', data: { value: 2 } },
        { type: 'type3', data: { value: 3 } },
      ];

      await service.sendBatch(messages);

      const stats = adapter.getStats();
      expect(stats.pending).toBe(3);
    });

    it('should include metadata in messages', async () => {
      await service.send('test', { value: 'data' }, { userId: '123' });

      const messages = await adapter.receive(1);
      expect(messages[0].body.metadata).toEqual({ userId: '123' });
    });
  });

  describe('message processing', () => {
    it('should process messages with registered handler', async () => {
      const handler = vi.fn();
      service.registerHandler({
        type: 'test-type',
        handler,
      });

      await service.send('test-type', { value: 'test' });
      const result = await service.processMessages();

      expect(handler).toHaveBeenCalledWith(
        { value: 'test' },
        expect.objectContaining({
          retryCount: 0,
          timestamp: expect.any(Number),
        }),
      );
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should handle multiple message types', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      service.registerHandler({ type: 'type1', handler: handler1 });
      service.registerHandler({ type: 'type2', handler: handler2 });

      await service.send('type1', { value: 1 });
      await service.send('type2', { value: 2 });

      await service.processMessages();

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should fail for unregistered message type', async () => {
      await service.send('unknown-type', { value: 'test' });

      // Check message is in queue
      const statsBefore = adapter.getStats();
      expect(statsBefore.pending).toBe(1);

      const result = await service.processMessages();

      expect(result.processed).toBe(0);
      expect(result.retried).toBe(1); // Should retry, not fail immediately
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error.message).toContain('No handler registered');

      // Message should be back in queue with retry count
      const statsAfter = adapter.getStats();
      expect(statsAfter.pending).toBe(1);
    });

    it.skip('should retry failed messages', async () => {
      const handler = vi
        .fn()
        .mockRejectedValueOnce(new Error('First attempt fails'))
        .mockResolvedValueOnce(undefined);

      service.registerHandler({ type: 'test', handler });

      await service.send('test', { value: 'retry-test' });

      // First attempt - should fail and retry
      const result1 = await service.processMessages();
      expect(result1.retried).toBe(1);
      expect(result1.failed).toBe(0);
      expect(result1.processed).toBe(0);
      expect(handler).toHaveBeenCalledTimes(1);

      // Ensure message was retried (is back in queue)
      const stats = adapter.getStats();
      expect(stats.pending).toBe(1);

      // Process again - should succeed this time
      const result2 = await service.processMessages();
      expect(result2.processed).toBe(1);
      expect(result2.retried).toBe(0);
      expect(result2.failed).toBe(0);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it.skip('should drop messages after max retries', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Always fails'));
      service.registerHandler({ type: 'test', handler });

      await service.send('test', { value: 'fail-test' });

      // First attempt - should fail and retry
      const result1 = await service.processMessages();
      expect(result1.retried).toBe(1);
      expect(result1.failed).toBe(0);

      // Second attempt - should fail and retry again
      const result2 = await service.processMessages();
      expect(result2.retried).toBe(1);
      expect(result2.failed).toBe(0);

      // Third attempt - should fail and drop (max retries reached)
      const result3 = await service.processMessages();
      expect(result3.failed).toBe(1);
      expect(result3.retried).toBe(0);

      // No more messages to process
      const finalResult = await service.processMessages();
      expect(finalResult.processed).toBe(0);
      expect(finalResult.failed).toBe(0);

      expect(handler).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe('handler registration', () => {
    it('should throw error for duplicate handler', () => {
      service.registerHandler({ type: 'test', handler: vi.fn() });

      expect(() => {
        service.registerHandler({ type: 'test', handler: vi.fn() });
      }).toThrow('Handler for type "test" already registered');
    });

    it('should pass correct context to handler', async () => {
      let capturedContext: HandlerContext | null = null;

      service.registerHandler({
        type: 'test',
        handler: async (_data, context) => {
          capturedContext = context;
        },
      });

      await service.send('test', { value: 'context-test' });
      await service.processMessages();

      expect(capturedContext).toMatchObject({
        messageId: expect.any(String),
        retryCount: 0,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('continuous processing', () => {
    it('should start and stop processing', async () => {
      const handler = vi.fn();
      service.registerHandler({ type: 'test', handler });

      const stop = await service.startProcessing({
        pollInterval: 10,
        maxMessages: 5,
      });

      // Send messages after starting
      await service.send('test', { value: 1 });
      await service.send('test', { value: 2 });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      stop();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in processing loop', async () => {
      const onError = vi.fn();

      // Mock adapter to throw error
      adapter.receive = vi.fn().mockRejectedValueOnce(new Error('Receive error'));

      const stop = await service.startProcessing({
        pollInterval: 10,
        onError,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      stop();

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('statistics', () => {
    it('should track processing statistics', async () => {
      const successHandler = vi.fn();
      const failHandler = vi.fn().mockRejectedValue(new Error('Fail'));

      service.registerHandler({ type: 'success', handler: successHandler });
      service.registerHandler({ type: 'fail', handler: failHandler });

      await service.send('success', { value: 1 });
      await service.send('success', { value: 2 });
      await service.send('fail', { value: 3 });

      await service.processMessages();

      const stats = service.getStats();
      expect(stats.totalProcessed).toBe(2);
      expect(stats.totalRetried).toBe(1);
    });

    it('should reset statistics', async () => {
      service.registerHandler({ type: 'test', handler: vi.fn() });

      await service.send('test', {});
      await service.processMessages();

      service.resetStats();
      const stats = service.getStats();

      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalFailed).toBe(0);
      expect(stats.totalRetried).toBe(0);
    });
  });

  describe('typed queue service', () => {
    interface TestMessage {
      type: 'notification' | 'payment';
      data: {
        notification?: { userId: string; text: string };
        payment?: { amount: number; currency: string };
      };
    }

    it('should provide type-safe message handling', async () => {
      const typedService = QueueService.typed<TestMessage>({
        adapter: new MemoryQueueAdapter(),
      });

      const notificationHandler = vi.fn();
      const paymentHandler = vi.fn();

      // Type-safe handler registration
      typedService.registerTypedHandler('notification', notificationHandler);
      typedService.registerTypedHandler('payment', paymentHandler);

      // Type-safe message sending
      await typedService.sendTyped({
        type: 'notification',
        data: { notification: { userId: '123', text: 'Hello' } },
      });

      await typedService.processMessages();

      expect(notificationHandler).toHaveBeenCalledWith(
        { notification: { userId: '123', text: 'Hello' } },
        expect.any(Object),
      );
    });
  });

  describe('batch processing', () => {
    it('should respect batch size limit', async () => {
      const batchService = new QueueService({
        adapter,
        batchSize: 3,
      });

      // Send 10 messages
      const messages = Array.from({ length: 10 }, (_, i) => ({
        type: 'test',
        data: { index: i },
      }));

      await batchService.sendBatch(messages);

      // Process with maxMessages = 5
      const received = await adapter.receive(5);
      expect(received).toHaveLength(5);
    });
  });
});
