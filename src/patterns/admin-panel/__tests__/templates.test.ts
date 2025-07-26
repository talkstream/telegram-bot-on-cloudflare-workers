import { describe, it, expect } from 'vitest';

import { renderAdminLayout } from '../templates/layout';
import { renderLoginPage } from '../templates/login';

describe('Admin Templates', () => {
  describe('renderAdminLayout', () => {
    it('should render layout with title and content', () => {
      const html = renderAdminLayout({
        title: 'Test Page',
        content: '<p>Test content</p>',
        activeMenu: 'dashboard',
        adminId: 123456789,
      });

      expect(html).toContain('<title>Test Page - Админ-панель Коготочки</title>');
      expect(html).toContain('<p>Test content</p>');
      expect(html).toContain('💅');
    });

    it('should highlight active menu item', () => {
      const html = renderAdminLayout({
        title: 'Users',
        content: '<p>Users list</p>',
        activeMenu: 'users',
        adminId: 123456789,
      });

      expect(html).toContain('class="nav-item active"');
      // Check that the users link has the active class
      const activeUserMatch = html.match(
        /<a[^>]*href="\/admin\/users"[^>]*class="nav-item active"/,
      );
      expect(activeUserMatch).toBeTruthy();
    });

    it('should include navigation menu', () => {
      const html = renderAdminLayout({
        title: 'Dashboard',
        content: '<p>Dashboard</p>',
        activeMenu: 'dashboard',
        adminId: 123456789,
      });

      expect(html).toContain('href="/admin/dashboard"');
      expect(html).toContain('href="/admin/users"');
      expect(html).toContain('href="/admin/settings"');
      expect(html).toContain('href="/admin/logout"');
    });

    it('should include admin ID in header', () => {
      const html = renderAdminLayout({
        title: 'Dashboard',
        content: '<p>Dashboard</p>',
        activeMenu: 'dashboard',
        adminId: 987654321,
      });

      expect(html).toContain('Admin ID: 987654321');
    });

    it('should have responsive meta tag', () => {
      const html = renderAdminLayout({
        title: 'Test',
        content: '<p>Test</p>',
        activeMenu: 'dashboard',
        adminId: 123456789,
      });

      expect(html).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      );
    });

    it('should handle optional adminId', () => {
      const html = renderAdminLayout({
        title: 'Test',
        content: '<p>Test</p>',
        activeMenu: 'dashboard',
      });

      expect(html).toContain('Admin ID: Unknown');
    });
  });

  describe('renderLoginPage', () => {
    it('should render login form for request step', () => {
      const html = renderLoginPage({
        step: 'request',
      });

      expect(html).toContain('Админ-панель Коготочки');
      expect(html).toContain('Ваш Telegram ID');
      expect(html).toContain('name="telegram_id"');
      expect(html).toContain('Получить код');
      expect(html).toContain('value="request-code"');
    });

    it('should render verification form for verify step', () => {
      const html = renderLoginPage({
        step: 'verify',
        telegramId: '123456789',
      });

      expect(html).toContain('Код из Telegram');
      expect(html).toContain('name="code"');
      expect(html).toContain('value="verify-code"');
      expect(html).toContain('value="123456789"');
      expect(html).toContain('Войти');
    });

    it('should display error message', () => {
      const html = renderLoginPage({
        error: 'Invalid credentials',
      });

      expect(html).toContain('<div class="error">Invalid credentials</div>');
    });

    it('should display success message', () => {
      const html = renderLoginPage({
        message: 'Code sent successfully',
      });

      expect(html).toContain('<div class="message">Code sent successfully</div>');
    });

    it('should include auto-submit script for code input', () => {
      const html = renderLoginPage({
        step: 'verify',
      });

      expect(html).toContain('class="code-input"');
      expect(html).toContain('if (e.target.value.length === 6)');
      expect(html).toContain('e.target.form.submit()');
    });

    it('should have proper input patterns', () => {
      const requestHtml = renderLoginPage({ step: 'request' });
      expect(requestHtml).toContain('pattern="[0-9]+"');

      const verifyHtml = renderLoginPage({ step: 'verify' });
      expect(verifyHtml).toContain('pattern="[0-9]{6}"');
      expect(verifyHtml).toContain('maxlength="6"');
    });

    it('should include CSS styles', () => {
      const html = renderLoginPage();

      expect(html).toContain('<style>');
      expect(html).toContain('.login-container');
      expect(html).toContain('.form-group');
      expect(html).toContain('button:hover');
    });

    it('should have autofocus on input fields', () => {
      const requestHtml = renderLoginPage({ step: 'request' });
      expect(requestHtml).toContain('autofocus');

      const verifyHtml = renderLoginPage({ step: 'verify' });
      expect(verifyHtml).toContain('autofocus');
    });

    it('should have autocomplete off for code input', () => {
      const html = renderLoginPage({ step: 'verify' });
      expect(html).toContain('autocomplete="off"');
    });
  });
});
