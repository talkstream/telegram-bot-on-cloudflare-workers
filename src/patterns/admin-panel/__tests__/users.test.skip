import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { D1PreparedStatement } from '@cloudflare/workers-types';

import { handleAdminUsers } from '../handlers/users';
import { createMockEnv } from '../../../__tests__/utils/mock-env';
import type { AdminRequest } from '../routes';

import type { Env } from '@/types/env';

describe('Admin Users Management', () => {
  let mockEnv: Env;
  let mockRequest: AdminRequest;

  const createMockPreparedStatement = (mockData: {
    bind?: () => unknown;
    first?: () => Promise<unknown>;
    all?: () => Promise<{ results: unknown[]; meta?: unknown }>;
    run?: () => Promise<unknown>;
  }): D1PreparedStatement => {
    const statement = {
      bind: mockData.bind || vi.fn().mockReturnThis(),
      first: mockData.first || vi.fn().mockResolvedValue(null),
      all: mockData.all || vi.fn().mockResolvedValue({ results: [] }),
      run: mockData.run || vi.fn().mockResolvedValue({ meta: {} }),
      raw: vi.fn().mockReturnThis(),
    };
    return statement as unknown as D1PreparedStatement;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
  });

  describe('User listing', () => {
    it('should render users list with pagination', async () => {
      mockRequest = new Request('https://example.com/admin/users') as AdminRequest;
      mockRequest.adminId = 123456789;

      // Mock count query
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementationOnce(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ total: 50 }),
        }),
      );

      // Mock users query
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementationOnce(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 1,
                telegram_id: 123456789,
                username: 'user1',
                first_name: 'User',
                last_name: 'One',
                is_provider: 1,
                is_blocked: 0,
                created_at: '2025-01-01T00:00:00Z',
                last_active_at: '2025-01-20T00:00:00Z',
                stars_balance: 100,
              },
              {
                id: 2,
                telegram_id: 987654321,
                username: 'user2',
                first_name: 'User',
                last_name: 'Two',
                is_provider: 0,
                is_blocked: 1,
                created_at: '2025-01-02T00:00:00Z',
                last_active_at: '2025-01-19T00:00:00Z',
                stars_balance: 50,
              },
            ],
          }),
        }),
      );

      const response = await handleAdminUsers(mockRequest, mockEnv);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Пользователи');
      expect(html).toContain('@user1');
      expect(html).toContain('User One');
      expect(html).toContain('@user2');
      expect(html).toContain('User Two');
      expect(html).toContain('Мастер'); // provider badge
      expect(html).toContain('Заблокирован'); // blocked badge
    });

    it('should handle search query', async () => {
      mockRequest = new Request('https://example.com/admin/users?search=test') as AdminRequest;
      mockRequest.adminId = 123456789;

      const prepareSpyCount = vi.fn();
      const prepareSpyUsers = vi.fn();

      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare)
        .mockImplementationOnce((sql) => {
          prepareSpyCount(sql);
          return createMockPreparedStatement({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ total: 1 }),
          });
        })
        .mockImplementationOnce((sql) => {
          prepareSpyUsers(sql);
          return createMockPreparedStatement({
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 3,
                  telegram_id: 111222333,
                  username: 'testuser',
                  first_name: 'Test',
                  last_name: 'User',
                  is_provider: 0,
                  is_blocked: 0,
                  created_at: '2025-01-03T00:00:00Z',
                  last_active_at: '2025-01-18T00:00:00Z',
                  stars_balance: 25,
                },
              ],
            }),
          });
        });

      const response = await handleAdminUsers(mockRequest, mockEnv);

      expect(response.status).toBe(200);
      expect(prepareSpyCount).toHaveBeenCalledWith(expect.stringContaining('WHERE'));
      expect(prepareSpyCount).toHaveBeenCalledWith(
        expect.stringContaining(
          '(username LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR telegram_id = ?)',
        ),
      );
    });

    it('should handle filter by provider status', async () => {
      mockRequest = new Request('https://example.com/admin/users?filter=providers') as AdminRequest;
      mockRequest.adminId = 123456789;

      const prepareSpy = vi.fn();

      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementationOnce((sql) => {
        prepareSpy(sql);
        return createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ total: 0 }),
        });
      });

      await handleAdminUsers(mockRequest, mockEnv);

      expect(prepareSpy).toHaveBeenCalledWith(expect.stringContaining('AND is_provider = 1'));
    });

    it('should handle filter by blocked status', async () => {
      mockRequest = new Request('https://example.com/admin/users?filter=blocked') as AdminRequest;
      mockRequest.adminId = 123456789;

      const prepareSpy = vi.fn();

      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementationOnce((sql) => {
        prepareSpy(sql);
        return createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ total: 0 }),
        });
      });

      await handleAdminUsers(mockRequest, mockEnv);

      expect(prepareSpy).toHaveBeenCalledWith(expect.stringContaining('AND is_blocked = 1'));
    });

    it('should handle pagination', async () => {
      mockRequest = new Request('https://example.com/admin/users?page=2') as AdminRequest;
      mockRequest.adminId = 123456789;

      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare)
        .mockImplementationOnce(() =>
          createMockPreparedStatement({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ total: 100 }),
          }),
        )
        .mockImplementationOnce(() =>
          createMockPreparedStatement({
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        );

      const response = await handleAdminUsers(mockRequest, mockEnv);

      const html = await response.text();
      expect(html).toContain('page=1'); // Previous page link
      expect(html).not.toContain('page=3'); // No next page link on last page
      expect(html).toContain('Страница 2 из 2'); // Page info (100 total / 50 per page = 2 pages)
    });
  });

  describe('User actions', () => {
    it('should handle block user action', async () => {
      const formData = new FormData();
      formData.append('action', 'block');
      formData.append('user_id', '123');

      mockRequest = new Request('https://example.com/admin/users', {
        method: 'POST',
        body: formData,
      }) as AdminRequest;
      mockRequest.adminId = 123456789;

      const runSpy = vi.fn().mockResolvedValue({ success: true });
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementation(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          run: runSpy,
        }),
      );

      const response = await handleAdminUsers(mockRequest, mockEnv);

      expect(runSpy).toHaveBeenCalled();
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/admin/users');
    });

    it('should handle unblock user action', async () => {
      const formData = new FormData();
      formData.append('action', 'unblock');
      formData.append('user_id', '123');

      mockRequest = new Request('https://example.com/admin/users', {
        method: 'POST',
        body: formData,
      }) as AdminRequest;
      mockRequest.adminId = 123456789;

      const runSpy = vi.fn().mockResolvedValue({ success: true });
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementation(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          run: runSpy,
        }),
      );

      const response = await handleAdminUsers(mockRequest, mockEnv);

      expect(runSpy).toHaveBeenCalled();
      expect(response.status).toBe(302);
    });

    it('should handle make provider action', async () => {
      const formData = new FormData();
      formData.append('action', 'make_provider');
      formData.append('user_id', '123');

      mockRequest = new Request('https://example.com/admin/users', {
        method: 'POST',
        body: formData,
      }) as AdminRequest;
      mockRequest.adminId = 123456789;

      const runSpy = vi.fn().mockResolvedValue({ success: true });
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementation(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          run: runSpy,
        }),
      );

      const response = await handleAdminUsers(mockRequest, mockEnv);

      expect(runSpy).toHaveBeenCalled();
      expect(response.status).toBe(302);
    });

    it('should handle remove provider action', async () => {
      const formData = new FormData();
      formData.append('action', 'remove_provider');
      formData.append('user_id', '123');

      mockRequest = new Request('https://example.com/admin/users', {
        method: 'POST',
        body: formData,
      }) as AdminRequest;
      mockRequest.adminId = 123456789;

      const runSpy = vi.fn().mockResolvedValue({ success: true });
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementation(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          run: runSpy,
        }),
      );

      const response = await handleAdminUsers(mockRequest, mockEnv);

      expect(runSpy).toHaveBeenCalled();
      expect(response.status).toBe(302);
    });

    it('should handle invalid action', async () => {
      const formData = new FormData();
      formData.append('action', 'invalid_action');
      formData.append('user_id', '123');

      mockRequest = new Request('https://example.com/admin/users', {
        method: 'POST',
        body: formData,
      }) as AdminRequest;
      mockRequest.adminId = 123456789;

      const response = await handleAdminUsers(mockRequest, mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/admin/users');
    });

    it('should handle missing user_id', async () => {
      const formData = new FormData();
      formData.append('action', 'block');

      mockRequest = new Request('https://example.com/admin/users', {
        method: 'POST',
        body: formData,
      }) as AdminRequest;
      mockRequest.adminId = 123456789;

      // Mock database for users list that will be rendered
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare)
        .mockImplementationOnce(() =>
          createMockPreparedStatement({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ total: 0 }),
          }),
        )
        .mockImplementationOnce(() =>
          createMockPreparedStatement({
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        );

      const response = await handleAdminUsers(mockRequest, mockEnv);

      // When user_id is missing, it shows the users list instead of redirecting
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockRequest = new Request('https://example.com/admin/users') as AdminRequest;
      mockRequest.adminId = 123456789;

      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await handleAdminUsers(mockRequest, mockEnv);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal Server Error');
      expect(consoleSpy).toHaveBeenCalledWith('Error loading users:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle missing database', async () => {
      mockRequest = new Request('https://example.com/admin/users') as AdminRequest;
      mockRequest.adminId = 123456789;

      const envWithoutDB = { ...mockEnv, DB: undefined };

      const response = await handleAdminUsers(mockRequest, envWithoutDB as Env);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Пользователи (0)');
    });
  });
});
