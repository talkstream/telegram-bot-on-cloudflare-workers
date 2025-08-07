/**
 * Users management handler for admin panel
 * Example implementation showing user list and management
 */

import { renderAdminLayout } from '../templates/layout'
import type { AdminEnv, AdminRequest } from '../types'

export async function handleAdminUsers(request: AdminRequest, env: AdminEnv): Promise<Response> {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  let totalUsers = 0
  let users: Array<{
    telegram_id: number
    username?: string
    first_name?: string
    last_name?: string
    created_at?: string
    is_active?: number
  }> = []

  // Fetch users from database if available
  if (env.DB) {
    try {
      // Get total count
      const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first<{
        total: number
      }>()

      if (countResult) {
        totalUsers = countResult.total
      }

      // Get users with pagination
      const usersResult = await env.DB.prepare(
        `
        SELECT telegram_id, username, first_name, last_name, created_at, is_active
        FROM users
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `
      )
        .bind(limit, offset)
        .all<{
          telegram_id: number
          username?: string
          first_name?: string
          last_name?: string
          created_at?: string
          is_active?: number
        }>()

      if (usersResult) {
        users = usersResult.results
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const totalPages = Math.ceil(totalUsers / limit)

  const content = `
    <h1 class="page-title">Users Management</h1>
    
    <div class="card">
      <p>Total users: <strong>${totalUsers}</strong></p>
    </div>
    
    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Name</th>
            <th>Joined</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${
            users.length > 0
              ? users
                  .map(
                    user => `
            <tr>
              <td>${user.telegram_id}</td>
              <td>${user.username || '-'}</td>
              <td>${[user.first_name, user.last_name].filter(Boolean).join(' ') || '-'}</td>
              <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
              <td>${user.is_active ? '<span style="color: green;">Active</span>' : '<span style="color: red;">Inactive</span>'}</td>
              <td>
                <button class="button small" onclick="alert('View user ${user.telegram_id}')">View</button>
              </td>
            </tr>
          `
                  )
                  .join('')
              : '<tr><td colspan="6" style="text-align: center;">No users found</td></tr>'
          }
        </tbody>
      </table>
      
      ${
        totalPages > 1
          ? `
        <div class="pagination">
          ${page > 1 ? `<a href="?page=${page - 1}" class="button small">Previous</a>` : ''}
          <span>Page ${page} of ${totalPages}</span>
          ${page < totalPages ? `<a href="?page=${page + 1}" class="button small">Next</a>` : ''}
        </div>
      `
          : ''
      }
    </div>
    
    <style>
      .data-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .data-table th,
      .data-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .data-table th {
        font-weight: 600;
        background-color: #f5f5f5;
      }
      
      .data-table tr:hover {
        background-color: #f9f9f9;
      }
      
      .pagination {
        margin-top: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        justify-content: center;
      }
      
      .button.small {
        padding: 5px 10px;
        font-size: 14px;
      }
    </style>
  `

  return new Response(
    renderAdminLayout({
      title: 'Users',
      content,
      activeMenu: 'users',
      adminId: request.adminId
    }),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    }
  )
}
