import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { D1PreparedStatement } from '@cloudflare/workers-types';

import { handleAdminAuth } from '../handlers/auth';
import { requireAdminAuth } from '../middleware/auth';
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

describe('Admin Authentication', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
  });

  describe('handleAdminAuth', () => {
    it('should render login page on GET request', async () => {
      const request = new Request('https://example.com/admin', {
        method: 'GET',
      });

      const response = await handleAdminAuth(request, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');

      const html = await response.text();
      expect(html).toContain('Админ-панель Коготочки');
      expect(html).toContain('Ваш Telegram ID');
    });

    it('should handle request-code action', async () => {
      // Mock database to check admin exists
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementationOnce(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ telegram_id: 123456789 }),
        }),
      );

      const formData = new FormData();
      formData.append('action', 'request-code');
      formData.append('telegram_id', '123456789');

      const request = new Request('https://example.com/admin', {
        method: 'POST',
        body: formData,
      });

      const response = await handleAdminAuth(request, mockEnv);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Код из Telegram');
    });

    it('should validate admin ID exists in database', async () => {
      // Mock database to return no admin
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementationOnce(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        }),
      );

      const formData = new FormData();
      formData.append('action', 'request-code');
      formData.append('telegram_id', '999999999');

      const request = new Request('https://example.com/admin', {
        method: 'POST',
        body: formData,
      });

      const response = await handleAdminAuth(request, mockEnv);

      expect(response.status).toBe(403);
      const html = await response.text();
      expect(html).toContain('Access denied');
    });

    it('should handle verify-code action with valid code', async () => {
      // Mock database to check admin exists for initial request
      if (!mockEnv.DB) throw new Error('DB not available');
      vi.mocked(mockEnv.DB.prepare).mockImplementationOnce(() =>
        createMockPreparedStatement({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ telegram_id: 123456789 }),
        }),
      );

      // First, request a code
      const requestCodeData = new FormData();
      requestCodeData.append('action', 'request-code');
      requestCodeData.append('telegram_id', '123456789');

      await handleAdminAuth(
        new Request('https://example.com/admin', {
          method: 'POST',
          body: requestCodeData,
        }),
        mockEnv,
      );

      // Mock the stored auth code
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          token: '123456',
          expiresAt: Date.now() + 5 * 60 * 1000,
        }),
      );

      // Now verify the code
      const verifyCodeData = new FormData();
      verifyCodeData.append('action', 'verify-code');
      verifyCodeData.append('telegram_id', '123456789');
      verifyCodeData.append('code', '123456');

      const request = new Request('https://example.com/admin', {
        method: 'POST',
        body: verifyCodeData,
      });

      const response = await handleAdminAuth(request, mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/admin/dashboard');
      expect(response.headers.get('Set-Cookie')).toContain('admin_session=');
    });

    it('should reject invalid verification code', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          token: '123456',
          expiresAt: Date.now() + 5 * 60 * 1000,
        }),
      );

      const formData = new FormData();
      formData.append('action', 'verify-code');
      formData.append('telegram_id', '123456789');
      formData.append('code', '999999');

      const request = new Request('https://example.com/admin', {
        method: 'POST',
        body: formData,
      });

      const response = await handleAdminAuth(request, mockEnv);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid or expired code');
    });

    it('should handle expired verification code', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          token: '123456',
          expiresAt: Date.now() - 1000, // Already expired
        }),
      );

      const formData = new FormData();
      formData.append('action', 'verify-code');
      formData.append('telegram_id', '123456789');
      formData.append('code', '123456');

      const request = new Request('https://example.com/admin', {
        method: 'POST',
        body: formData,
      });

      const response = await handleAdminAuth(request, mockEnv);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid or expired code');
    });
  });

  describe('requireAdminAuth', () => {
    it('should redirect to login if no session cookie', async () => {
      const request = new Request('https://example.com/admin/dashboard');

      const result = await requireAdminAuth(request, mockEnv);

      expect(result).toBeInstanceOf(Response);
      if (result instanceof Response) {
        expect(result.status).toBe(302);
        expect(result.headers.get('Location')).toBe('/admin');
      }
    });

    it('should return admin info for valid session', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
      );

      const request = new Request('https://example.com/admin/dashboard', {
        headers: {
          Cookie: 'admin_session=valid-session-id',
        },
      });

      const result = await requireAdminAuth(request, mockEnv);

      expect(result).not.toBeInstanceOf(Response);
      expect(result).toEqual({ adminId: 123456789, isAuthenticated: true });
    });

    it('should redirect for expired session', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
        JSON.stringify({
          adminId: 123456789,
          createdAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
          expiresAt: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        }),
      );

      const request = new Request('https://example.com/admin/dashboard', {
        headers: {
          Cookie: 'admin_session=expired-session-id',
        },
      });

      const result = await requireAdminAuth(request, mockEnv);

      expect(result).toBeInstanceOf(Response);
      if (result instanceof Response) {
        expect(result.status).toBe(302);
        expect(result.headers.get('Location')).toBe('/admin');
      }
    });

    it('should handle invalid session data gracefully', async () => {
      if (!mockEnv.SESSIONS) throw new Error('SESSIONS not available');
      (mockEnv.SESSIONS.get as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async () => 'invalid-json',
      );

      const request = new Request('https://example.com/admin/dashboard', {
        headers: {
          Cookie: 'admin_session=invalid-session-id',
        },
      });

      const result = await requireAdminAuth(request, mockEnv);

      expect(result).toBeInstanceOf(Response);
      if (result instanceof Response) {
        expect(result.status).toBe(302);
        expect(result.headers.get('Location')).toBe('/admin');
      }
    });
  });
});
