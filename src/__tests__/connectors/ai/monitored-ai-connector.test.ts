import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { IAIConnector, AITextRequest } from '@/core/interfaces/ai.js';
import type { IMonitoringConnector } from '@/core/interfaces/monitoring.js';
import {
  MonitoredAIConnector,
  createMonitoredAIConnector,
} from '@/connectors/ai/monitored-ai-connector.js';

describe('MonitoredAIConnector', () => {
  let mockConnector: IAIConnector;
  let mockMonitoring: IMonitoringConnector;
  let mockTransaction: {
    setStatus: ReturnType<typeof vi.fn>;
    setData: ReturnType<typeof vi.fn>;
    finish: ReturnType<typeof vi.fn>;
  };
  let mockSpan: {
    setStatus: ReturnType<typeof vi.fn>;
    setData: ReturnType<typeof vi.fn>;
    finish: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockTransaction = {
      setStatus: vi.fn(),
      setData: vi.fn(),
      finish: vi.fn(),
    };

    mockSpan = {
      setStatus: vi.fn(),
      setData: vi.fn(),
      finish: vi.fn(),
    };

    mockConnector = {
      id: 'test-connector',
      name: 'Test AI Connector',
      initialize: vi.fn().mockResolvedValue(undefined),
      generateText: vi.fn().mockResolvedValue({
        text: 'Generated response',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          totalCost: 0.001,
        },
      }),
      generateEmbedding: vi.fn().mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        usage: { totalTokens: 5 },
      }),
      streamText: vi.fn().mockImplementation(async function* () {
        yield { text: 'chunk1' };
        yield { text: 'chunk2', usage: { totalTokens: 10 } };
      }),
      analyzeImage: vi.fn().mockResolvedValue({
        text: 'Image description',
        usage: { totalTokens: 50 },
      }),
      getModelInfo: vi.fn().mockResolvedValue({
        id: 'test-model',
        name: 'Test Model',
        contextWindow: 4096,
        maxOutputTokens: 1024,
      }),
      getCapabilities: vi.fn().mockReturnValue({
        textGeneration: true,
        streaming: true,
        embeddings: true,
        vision: true,
        functionCalling: false,
      }),
      validateConnection: vi.fn().mockResolvedValue(true),
      estimateCost: vi.fn().mockReturnValue(0.001),
    };

    mockMonitoring = {
      initialize: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUserContext: vi.fn(),
      clearUserContext: vi.fn(),
      addBreadcrumb: vi.fn(),
      startTransaction: vi.fn().mockReturnValue(mockTransaction),
      startSpan: vi.fn().mockReturnValue(mockSpan),
      flush: vi.fn().mockResolvedValue(true),
      isAvailable: vi.fn().mockReturnValue(true),
    };
  });

  describe('initialize', () => {
    it('should initialize with monitoring span', async () => {
      const monitored = new MonitoredAIConnector(mockConnector, mockMonitoring);
      await monitored.initialize({ apiKey: 'test' });

      expect(mockMonitoring.startSpan).toHaveBeenCalledWith({
        op: 'ai.initialize',
        description: 'Initialize Test AI Connector',
        data: { provider: 'Test AI Connector' },
      });
      expect(mockSpan.setStatus).toHaveBeenCalledWith('ok');
      expect(mockSpan.finish).toHaveBeenCalled();
    });

    it('should capture error on initialization failure', async () => {
      const error = new Error('Init failed');
      mockConnector.initialize = vi.fn().mockRejectedValue(error);

      const monitored = new MonitoredAIConnector(mockConnector, mockMonitoring);
      await expect(monitored.initialize({ apiKey: 'test' })).rejects.toThrow('Init failed');

      expect(mockSpan.setStatus).toHaveBeenCalledWith('internal_error');
      expect(mockMonitoring.captureException).toHaveBeenCalledWith(error, {
        tags: { component: 'ai-connector', provider: 'Test AI Connector' },
        extra: { operation: 'initialize', provider: 'Test AI Connector' },
      });
    });
  });

  describe('generateText', () => {
    it('should track text generation with transaction', async () => {
      const monitored = new MonitoredAIConnector(mockConnector, mockMonitoring);
      const request: AITextRequest = {
        prompt: 'Test prompt',
        model: 'test-model',
        maxTokens: 100,
      };

      const response = await monitored.generateText(request);

      expect(mockMonitoring.startTransaction).toHaveBeenCalledWith({
        name: 'ai.generateText.Test AI Connector',
        op: 'ai.generate',
        data: {
          model: 'test-model',
          promptLength: 11,
          maxTokens: 100,
        },
      });

      expect(mockTransaction.setData).toHaveBeenCalledWith('responseLength', 18);
      expect(mockTransaction.setData).toHaveBeenCalledWith('tokensUsed', 30);
      expect(mockTransaction.setData).toHaveBeenCalledWith('cost', 0.001);
      expect(mockTransaction.setStatus).toHaveBeenCalledWith('ok');
      expect(mockTransaction.finish).toHaveBeenCalled();

      expect(response.text).toBe('Generated response');
    });

    it('should capture cost information', async () => {
      const monitored = new MonitoredAIConnector(mockConnector, mockMonitoring);
      await monitored.generateText({
        prompt: 'Test',
        model: 'test-model',
      });

      expect(mockMonitoring.captureMessage).toHaveBeenCalledWith(
        'AI generation cost: $0.0010',
        'info',
        {
          provider: 'Test AI Connector',
          model: 'test-model',
          tokens: 30,
        },
      );
    });

    it('should add breadcrumbs', async () => {
      const monitored = new MonitoredAIConnector(mockConnector, mockMonitoring);
      await monitored.generateText({
        prompt: 'Test',
        model: 'test-model',
      });

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith({
        message: 'AI text generation started',
        category: 'ai',
        level: 'info',
        type: 'default',
        data: {
          provider: 'Test AI Connector',
          model: 'test-model',
          promptLength: 4,
        },
      });

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith({
        message: 'AI text generation completed',
        category: 'ai',
        level: 'info',
        type: 'default',
        data: expect.objectContaining({
          provider: 'Test AI Connector',
          model: 'test-model',
          tokensUsed: 30,
        }),
      });
    });
  });

  describe('streamText', () => {
    it('should track streaming with transaction', async () => {
      const monitored = new MonitoredAIConnector(mockConnector, mockMonitoring);
      const chunks: string[] = [];

      for await (const chunk of monitored.streamText({
        prompt: 'Test',
        model: 'test-model',
      })) {
        chunks.push(chunk.text || '');
      }

      expect(chunks).toEqual(['chunk1', 'chunk2']);
      expect(mockTransaction.setData).toHaveBeenCalledWith('chunkCount', 2);
      expect(mockTransaction.setData).toHaveBeenCalledWith('totalTokens', 10);
      expect(mockTransaction.setStatus).toHaveBeenCalledWith('ok');
    });
  });

  describe('createMonitoredAIConnector', () => {
    it('should return original connector if monitoring is not available', () => {
      mockMonitoring.isAvailable = vi.fn().mockReturnValue(false);
      const result = createMonitoredAIConnector(mockConnector, mockMonitoring);
      expect(result).toBe(mockConnector);
    });

    it('should return monitored connector if monitoring is available', () => {
      const result = createMonitoredAIConnector(mockConnector, mockMonitoring);
      expect(result).toBeInstanceOf(MonitoredAIConnector);
    });

    it('should return original connector if monitoring is undefined', () => {
      const result = createMonitoredAIConnector(mockConnector, undefined);
      expect(result).toBe(mockConnector);
    });
  });
});
