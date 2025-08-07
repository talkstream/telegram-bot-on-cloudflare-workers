/**
 * Dashboard handler for admin panel
 * Example implementation showing statistics
 */

import { renderAdminLayout } from '../templates/layout'
import type { AdminEnv, AdminRequest, DashboardStats } from '../types'

export async function handleAdminDashboard(
  request: AdminRequest,
  env: AdminEnv
): Promise<Response> {
  // Fetch statistics (customize based on your bot's needs)
  const stats = await getDashboardStats(env)

  const content = `
    <h1 class="page-title">Dashboard</h1>
    
    <div class="stat-grid">
      ${Object.entries(stats)
        .map(
          ([_key, stat]) => `
        <div class="stat-card">
          <div class="stat-label">${stat.icon || ''} ${stat.label}</div>
          <div class="stat-value">${stat.value}</div>
        </div>
      `
        )
        .join('')}
    </div>
    
    <div class="card">
      <h2>Quick Actions</h2>
      <p>Add your custom quick actions here based on your bot's functionality.</p>
      
      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <a href="/admin/users" class="button">Manage Users</a>
        <a href="/admin/settings" class="button secondary">Settings</a>
      </div>
    </div>
    
    <div class="card">
      <h2>Recent Activity</h2>
      <p>You can add a recent activity log here.</p>
    </div>
  `

  return new Response(
    renderAdminLayout({
      title: 'Dashboard',
      content,
      activeMenu: 'dashboard',
      adminId: request.adminId
    }),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    }
  )
}

/**
 * Fetch dashboard statistics
 * Customize this based on your bot's data
 */
async function getDashboardStats(env: AdminEnv): Promise<DashboardStats> {
  const stats: DashboardStats = {
    totalUsers: {
      label: 'Total Users',
      value: 0,
      icon: '👥'
    },
    activeToday: {
      label: 'Active Today',
      value: 0,
      icon: '📊'
    },
    messagesProcessed: {
      label: 'Messages Processed',
      value: 0,
      icon: '💬'
    },
    uptime: {
      label: 'Uptime',
      value: '100%',
      icon: '✅'
    }
  }

  // Example: Fetch from database if available
  if (env.DB) {
    try {
      // Example query - adjust based on your schema
      const userCount = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first<{
        total: number
      }>()

      if (userCount && stats.totalUsers) {
        stats.totalUsers.value = userCount.total
      }

      // Add more queries based on your needs...
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  return stats
}
