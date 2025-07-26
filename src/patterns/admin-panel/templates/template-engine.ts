/**
 * Admin Panel Template Engine
 * Generates HTML for admin panel pages
 */

import type {
  IAdminTemplateEngine,
  AdminTemplateOptions,
  AdminPanelStats,
  AdminUser,
} from '../../../core/interfaces/admin-panel.js';

export class AdminTemplateEngine implements IAdminTemplateEngine {
  private readonly styles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      background-color: #2563eb;
      color: white;
      padding: 1rem 0;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h1 {
      font-size: 1.5rem;
      font-weight: 600;
    }
    
    .nav {
      display: flex;
      gap: 1rem;
    }
    
    .nav a {
      color: white;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      transition: background-color 0.2s;
    }
    
    .nav a:hover,
    .nav a.active {
      background-color: rgba(255,255,255,0.2);
    }
    
    .card {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #1f2937;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .stat-card h3 {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
    }
    
    .stat-card .value {
      font-size: 2rem;
      font-weight: 600;
      color: #1f2937;
    }
    
    .login-container {
      max-width: 400px;
      margin: 100px auto;
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #374151;
    }
    
    .form-group input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 1rem;
    }
    
    .form-group input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .btn:hover {
      background-color: #1d4ed8;
    }
    
    .btn-block {
      width: 100%;
    }
    
    .alert {
      padding: 1rem;
      border-radius: 0.375rem;
      margin-bottom: 1rem;
    }
    
    .alert-error {
      background-color: #fee;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    
    .alert-success {
      background-color: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    
    .alert-warning {
      background-color: #fffbeb;
      color: #92400e;
      border: 1px solid #fef3c7;
    }
    
    .alert-info {
      background-color: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: white;
    }
    
    .logout-btn {
      font-size: 0.875rem;
      padding: 0.25rem 0.75rem;
      background-color: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
    }
    
    .logout-btn:hover {
      background-color: rgba(255,255,255,0.3);
    }
    
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .header-content {
        flex-direction: column;
        gap: 1rem;
      }
      
      .nav {
        width: 100%;
        justify-content: center;
      }
    }
  `;

  renderLayout(options: AdminTemplateOptions): string {
    const { title, content, user, messages = [] } = options;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)} - Admin Panel</title>
    <style>${this.styles}</style>
    ${options.styles?.map((style) => `<style>${style}</style>`).join('\n') || ''}
</head>
<body>
    <header class="header">
        <div class="header-content">
            <h1>Admin Panel</h1>
            ${user ? this.renderUserNav(user) : ''}
        </div>
    </header>
    
    <div class="container">
        ${messages.map((msg) => this.renderMessage(msg)).join('\n')}
        ${content}
    </div>
    
    ${options.scripts?.map((script) => `<script>${script}</script>`).join('\n') || ''}
</body>
</html>
    `;
  }

  renderLogin(error?: string): string {
    const content = `
      <div class="login-container">
        <div class="card">
          <h2>Admin Login</h2>
          
          ${error ? `<div class="alert alert-error">${this.escapeHtml(error)}</div>` : ''}
          
          <form method="POST" action="/admin">
            <div class="form-group">
              <label for="admin_id">Admin ID</label>
              <input 
                type="text" 
                id="admin_id" 
                name="admin_id" 
                required 
                placeholder="Your Telegram ID"
              />
            </div>
            
            <div class="form-group">
              <label for="auth_code">Auth Code</label>
              <input 
                type="text" 
                id="auth_code" 
                name="auth_code" 
                required 
                placeholder="6-digit code from bot"
                maxlength="6"
                pattern="[A-Z0-9]{6}"
                style="text-transform: uppercase;"
              />
            </div>
            
            <button type="submit" class="btn btn-block">Login</button>
          </form>
          
          <p style="margin-top: 1rem; text-align: center; color: #6b7280; font-size: 0.875rem;">
            Use /admin command in the bot to get access code
          </p>
        </div>
      </div>
    `;

    return this.renderLayout({
      title: 'Login',
      content,
    });
  }

  renderDashboard(stats: AdminPanelStats, user: AdminUser): string {
    const content = `
      <div class="stats-grid">
        ${
          stats.totalUsers !== undefined
            ? `
          <div class="stat-card">
            <h3>Total Users</h3>
            <div class="value">${this.formatNumber(stats.totalUsers)}</div>
          </div>
        `
            : ''
        }
        
        ${
          stats.activeUsers !== undefined
            ? `
          <div class="stat-card">
            <h3>Active Users</h3>
            <div class="value">${this.formatNumber(stats.activeUsers)}</div>
          </div>
        `
            : ''
        }
        
        ${
          stats.totalMessages !== undefined
            ? `
          <div class="stat-card">
            <h3>Total Messages</h3>
            <div class="value">${this.formatNumber(stats.totalMessages)}</div>
          </div>
        `
            : ''
        }
        
        <div class="stat-card">
          <h3>System Status</h3>
          <div class="value" style="font-size: 1.25rem; color: ${this.getStatusColor(stats.systemStatus || 'healthy')}">
            ${this.getStatusIcon(stats.systemStatus || 'healthy')} ${stats.systemStatus || 'healthy'}
          </div>
        </div>
      </div>
      
      ${this.renderCustomStats(stats.customStats)}
      
      <div class="card">
        <h2>Quick Actions</h2>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <a href="/admin/users" class="btn">Manage Users</a>
          <a href="/admin/messages" class="btn">View Messages</a>
          <a href="/admin/settings" class="btn">Settings</a>
        </div>
      </div>
    `;

    return this.renderLayout({
      title: 'Dashboard',
      content,
      user,
      stats,
    });
  }

  renderError(error: string, statusCode: number): string {
    const content = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h1 style="font-size: 3rem; margin-bottom: 1rem; color: #ef4444;">${statusCode}</h1>
        <h2 style="margin-bottom: 1rem;">Error</h2>
        <p style="color: #6b7280;">${this.escapeHtml(error)}</p>
        <a href="/admin/dashboard" class="btn" style="margin-top: 2rem;">Back to Dashboard</a>
      </div>
    `;

    return this.renderLayout({
      title: `Error ${statusCode}`,
      content,
    });
  }

  private renderUserNav(user: AdminUser): string {
    return `
      <nav class="nav">
        <a href="/admin/dashboard" class="active">Dashboard</a>
        <a href="/admin/users">Users</a>
        <a href="/admin/settings">Settings</a>
        <div class="user-info">
          <span>${this.escapeHtml(user.name)}</span>
          <form method="POST" action="/admin/logout" style="display: inline;">
            <button type="submit" class="btn logout-btn">Logout</button>
          </form>
        </div>
      </nav>
    `;
  }

  private renderMessage(message: { type: string; text: string }): string {
    return `<div class="alert alert-${message.type}">${this.escapeHtml(message.text)}</div>`;
  }

  private renderCustomStats(customStats?: Record<string, number | string>): string {
    if (!customStats || Object.keys(customStats).length === 0) {
      return '';
    }

    const statsHtml = Object.entries(customStats)
      .map(
        ([key, value]) => `
      <div class="stat-card">
        <h3>${this.escapeHtml(this.formatKey(key))}</h3>
        <div class="value" style="font-size: 1.5rem;">
          ${typeof value === 'number' ? this.formatNumber(value) : this.escapeHtml(value)}
        </div>
      </div>
    `,
      )
      .join('');

    return `<div class="stats-grid">${statsHtml}</div>`;
  }

  private getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'healthy':
        return '#16a34a';
      case 'degraded':
        return '#f59e0b';
      case 'down':
      case 'unhealthy':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }

  private getStatusIcon(status: string): string {
    switch (status.toLowerCase()) {
      case 'healthy':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'down':
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
  }

  private formatKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
