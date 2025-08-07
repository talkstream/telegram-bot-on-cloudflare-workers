/**
 * Base layout template for admin panel
 */

import type { LayoutOptions } from '../types'

export function renderAdminLayout(options: LayoutOptions): string {
  const { title, content, activeMenu = 'dashboard', adminId } = options

  const menuItems = [
    { id: 'dashboard', label: '📊 Dashboard', href: '/admin/dashboard' }
    // Add your custom menu items here
  ]

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Admin Panel</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 24px;
            font-weight: 600;
            color: #333;
            text-decoration: none;
        }
        
        .user-info {
            display: flex;
            align-items: center;
            gap: 20px;
            color: #666;
        }
        
        .logout {
            color: #e74c3c;
            text-decoration: none;
            font-weight: 500;
        }
        
        .nav {
            background: white;
            border-bottom: 1px solid #eee;
        }
        
        .nav-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            gap: 30px;
        }
        
        .nav-item {
            display: inline-block;
            padding: 15px 0;
            color: #666;
            text-decoration: none;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
        }
        
        .nav-item:hover {
            color: #333;
        }
        
        .nav-item.active {
            color: #0066cc;
            border-bottom-color: #0066cc;
        }
        
        .content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        .page-title {
            font-size: 32px;
            margin-bottom: 30px;
            color: #333;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            border-radius: 8px;
            padding: 25px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        
        .stat-value {
            font-size: 28px;
            font-weight: 600;
            color: #333;
        }
        
        .button {
            display: inline-block;
            padding: 10px 20px;
            background: #0066cc;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 500;
            transition: background 0.2s;
            border: none;
            cursor: pointer;
        }
        
        .button:hover {
            background: #0052a3;
        }
        
        .button.secondary {
            background: #6c757d;
        }
        
        .button.danger {
            background: #e74c3c;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        
        th {
            font-weight: 600;
            color: #666;
        }
        
        @media (max-width: 768px) {
            .stat-grid {
                grid-template-columns: 1fr;
            }
            
            .nav-content {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <a href="/admin/dashboard" class="logo">
                🤖 Admin Panel
            </a>
            <div class="user-info">
                <span>Admin ID: ${adminId || 'Unknown'}</span>
                <a href="/admin/logout" class="logout">Logout</a>
            </div>
        </div>
    </header>
    
    <nav class="nav">
        <div class="nav-content">
            ${menuItems
              .map(
                item => `
                <a href="${item.href}" class="nav-item ${item.id === activeMenu ? 'active' : ''}">
                    ${item.label}
                </a>
            `
              )
              .join('')}
        </div>
    </nav>
    
    <main class="content">
        ${content}
    </main>
</body>
</html>
  `
}
