import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext, D1PreparedStatement } from '@cloudflare/workers-types';

import { handleAdminRoutes } from '../routes';
import { createMockEnv } from '../../../__tests__/utils/mock-env';

import type { Env } from '@/types/env';

// Helper function to create type-safe prepared statements
const createMockPreparedStatement = (
  overrides: Partial<D1PreparedStatement> = {},
): D1PreparedStatement => {
  const base = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ meta: {} }),
    raw: vi.fn().mockReturnThis(),
  };
  return { ...base, ...overrides } as unknown as D1PreparedStatement;
};

describe('Admin Routes', () => {
  let mockEnv: Env;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockContext = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    } as ExecutionContext;
  });

  describe('Public routes', () => {
    it('should handle /admin path without auth', async () => {
      const request = new Request('https://example.com/admin');
      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    });

    it('should handle /admin/ path without auth', async () => {
      const request = new Request('https://example.com/admin/');
      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    });
  });

  describe('Protected routes', () => {
    it('should redirect to login for unauthenticated requests', async () => {
      const request = new Request('https://example.com/admin/dashboard');
      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/admin');
    });

    it('should handle dashboard route with valid session', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
      );

      // Mock database queries for dashboard
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementation(() =>
        createMockPreparedStatement({
          first: vi.fn().mockResolvedValue(null),
        }),
      );

      const request = new Request('https://example.com/admin/dashboard', {
        headers: {
          Cookie: 'admin_session=valid-session-id',
        },
      });

      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Дашборд');
    });

    it('should handle users route with valid session', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
      );

      // Mock database queries for users page
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

      const request = new Request('https://example.com/admin/users', {
        headers: {
          Cookie: 'admin_session=valid-session-id',
        },
      });

      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Пользователи');
    });

    it('should handle services route with valid session', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
      );

      const request = new Request('https://example.com/admin/services', {
        headers: {
          Cookie: 'admin_session=valid-session-id',
        },
      });

      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Управление услугами');
    });

    it('should handle settings route with valid session', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
      );

      const request = new Request('https://example.com/admin/settings', {
        headers: {
          Cookie: 'admin_session=valid-session-id',
        },
      });

      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Аукционы');
    });

    it('should handle transactions route with valid session', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
      );

      const request = new Request('https://example.com/admin/transactions', {
        headers: {
          Cookie: 'admin_session=valid-session-id',
        },
      });

      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Финансовые транзакции');
    });
  });

  describe('Logout', () => {
    it('should handle logout and clear session', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
      );

      const request = new Request('https://example.com/admin/logout', {
        headers: {
          Cookie: 'admin_session=valid-session-id',
        },
      });

      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/admin');

      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('admin_session=;');
      expect(setCookie).toContain('Max-Age=0');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
      );

      const request = new Request('https://example.com/admin/unknown-route', {
        headers: {
          Cookie: 'admin_session=valid-session-id',
        },
      });

      const response = await handleAdminRoutes(request, mockEnv, mockContext);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not Found');
    });
  });
});
