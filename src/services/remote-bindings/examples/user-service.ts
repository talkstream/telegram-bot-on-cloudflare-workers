/**
 * Example: User Service with Remote Bindings
 *
 * Demonstrates type-safe service-to-service communication
 * and Durable Object state management
 *
 * @module services/remote-bindings/examples/user-service
 */

import { TypedDurableObject, createDurableObjectClient } from '../durable-object-connector'
import { createServiceClient } from '../service-client'
import { createServiceHandler } from '../service-handler'
import type { ServiceDefinition, ServiceMethodRegistry } from '../types'
// Define minimal Env interface for the example
interface Env {
  OTHER_SERVICE: import('@cloudflare/workers-types').Fetcher
  USER_SESSION: import('../types').DurableObjectBinding<UserSessionMethods>
}

/**
 * User Service Method Registry
 */
export interface UserServiceMethods extends ServiceMethodRegistry {
  'user.create': {
    params: {
      email: string
      username: string
      password: string
    }
    result: {
      userId: string
      createdAt: Date
    }
  }

  'user.get': {
    params: {
      userId: string
    }
    result: {
      userId: string
      email: string
      username: string
      createdAt: Date
      lastLogin?: Date
    } | null
  }

  'user.update': {
    params: {
      userId: string
      updates: {
        email?: string
        username?: string
        password?: string
      }
    }
    result: {
      success: boolean
      updatedFields: string[]
    }
  }

  'user.delete': {
    params: {
      userId: string
    }
    result: {
      success: boolean
    }
  }

  'user.authenticate': {
    params: {
      email: string
      password: string
    }
    result: {
      authenticated: boolean
      userId?: string
      token?: string
    }
  }
}

/**
 * User data model
 */
interface User {
  userId: string
  email: string
  username: string
  passwordHash: string
  createdAt: Date
  lastLogin?: Date
  metadata?: Record<string, unknown>
}

/**
 * User Service Implementation
 */
export class UserService {
  private users = new Map<string, User>()

  getDefinition(): ServiceDefinition<UserServiceMethods> {
    return {
      name: 'user-service',
      version: '1.0.0',
      methods: {
        'user.create': async (params: unknown) => {
          const typedParams = params as { email: string; username: string; password: string }
          const userId = this.generateUserId()
          const user: User = {
            userId,
            email: typedParams.email,
            username: typedParams.username,
            passwordHash: await this.hashPassword(typedParams.password),
            createdAt: new Date()
          }

          this.users.set(userId, user)

          return {
            userId,
            createdAt: user.createdAt
          }
        },

        'user.get': async (params: unknown) => {
          const typedParams = params as { userId: string }
          const user = this.users.get(typedParams.userId)
          if (!user) return null

          return {
            userId: user.userId,
            email: user.email,
            username: user.username,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
          }
        },

        'user.update': async (params: unknown) => {
          const typedParams = params as {
            userId: string
            updates: { email?: string; username?: string; password?: string }
          }
          const user = this.users.get(typedParams.userId)
          if (!user) {
            throw new Error('User not found')
          }

          const updatedFields: string[] = []

          if (typedParams.updates.email) {
            user.email = typedParams.updates.email
            updatedFields.push('email')
          }

          if (typedParams.updates.username) {
            user.username = typedParams.updates.username
            updatedFields.push('username')
          }

          if (typedParams.updates.password) {
            user.passwordHash = await this.hashPassword(typedParams.updates.password)
            updatedFields.push('password')
          }

          return {
            success: true,
            updatedFields
          }
        },

        'user.delete': async (params: unknown) => {
          const typedParams = params as { userId: string }
          const deleted = this.users.delete(typedParams.userId)
          return { success: deleted }
        },

        'user.authenticate': async (params: unknown) => {
          const typedParams = params as { email: string; password: string }
          for (const user of this.users.values()) {
            if (user.email === typedParams.email) {
              const isValid = await this.verifyPassword(typedParams.password, user.passwordHash)

              if (isValid) {
                user.lastLogin = new Date()
                const token = this.generateToken(user.userId)

                return {
                  authenticated: true,
                  userId: user.userId,
                  token
                }
              }
            }
          }

          return { authenticated: false }
        }
      }
    }
  }

  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private async hashPassword(password: string): Promise<string> {
    // Simplified - use proper bcrypt in production
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password)
    return passwordHash === hash
  }

  private generateToken(userId: string): string {
    // Simplified - use proper JWT in production
    return btoa(
      JSON.stringify({
        userId,
        expires: Date.now() + 3600000 // 1 hour
      })
    )
  }
}

/**
 * User Session Durable Object
 */
export class UserSessionDO extends TypedDurableObject<UserSessionMethods> {
  private sessionData?: {
    userId: string
    startTime: Date
    lastActivity: Date
    activities: string[]
  }

  protected override async initialize(): Promise<void> {
    this.sessionData = await this.getState('session')
  }

  protected getServiceDefinition(): ServiceDefinition<UserSessionMethods> {
    return {
      name: 'user-session',
      version: '1.0.0',
      methods: {
        'session.start': async (params: unknown) => {
          const typedParams = params as { userId: string }
          this.sessionData = {
            userId: typedParams.userId,
            startTime: new Date(),
            lastActivity: new Date(),
            activities: []
          }

          await this.setState('session', this.sessionData)

          // Broadcast to connected clients
          this.broadcast({
            event: 'session.started',
            data: { userId: typedParams.userId }
          })

          return { sessionId: this.state.id.toString() }
        },

        'session.recordActivity': async (params: unknown) => {
          const typedParams = params as { activity: string }
          if (!this.sessionData) {
            throw new Error('Session not started')
          }

          this.sessionData.activities.push(typedParams.activity)
          this.sessionData.lastActivity = new Date()

          await this.setState('session', this.sessionData)

          // Set alarm for session timeout
          await this.setAlarm(300000) // 5 minutes

          return { recorded: true }
        },

        'session.end': async () => {
          const duration = this.sessionData ? Date.now() - this.sessionData.startTime.getTime() : 0

          await this.deleteState('session')
          this.sessionData = undefined

          // Broadcast session end
          this.broadcast({
            event: 'session.ended',
            data: { duration }
          })

          return { duration }
        },

        'session.getInfo': async () => {
          if (!this.sessionData) {
            return null
          }

          return {
            userId: this.sessionData.userId,
            startTime: this.sessionData.startTime,
            lastActivity: this.sessionData.lastActivity,
            activityCount: this.sessionData.activities.length
          }
        }
      }
    }
  }

  override async alarm(): Promise<void> {
    // Auto-end session on timeout
    if (this.sessionData) {
      const inactiveTime = Date.now() - this.sessionData.lastActivity.getTime()
      if (inactiveTime > 300000) {
        // 5 minutes
        await this.getServiceDefinition().methods['session.end'](
          {},
          {} as import('../types').ServiceContext
        )
      }
    }
  }
}

/**
 * User Session Method Registry
 */
interface UserSessionMethods extends ServiceMethodRegistry {
  'session.start': {
    params: { userId: string }
    result: { sessionId: string }
  }

  'session.recordActivity': {
    params: { activity: string }
    result: { recorded: boolean }
  }

  'session.end': {
    params: {}
    result: { duration: number }
  }

  'session.getInfo': {
    params: {}
    result: {
      userId: string
      startTime: Date
      lastActivity: Date
      activityCount: number
    } | null
  }
}

/**
 * Example Worker using User Service
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Create service handler for this worker
    const userService = new UserService()
    const serviceHandler = createServiceHandler<UserServiceMethods>(userService.getDefinition())

    // Handle direct service calls
    if (url.pathname.startsWith('/rpc')) {
      return serviceHandler.handleRequest(request)
    }

    // Example: Call another worker's service
    if (url.pathname === '/cross-worker-example') {
      // Create client for another worker's service
      const otherServiceClient = createServiceClient<OtherServiceMethods>({
        binding: env.OTHER_SERVICE as import('@cloudflare/workers-types').Fetcher // Service binding to another worker
      })

      // Make type-safe cross-worker call
      const result = await otherServiceClient.call('other.method', {
        param: 'value'
      })

      return Response.json(result)
    }

    // Example: Use Durable Object for session management
    if (url.pathname === '/session/start') {
      const { userId } = (await request.json()) as { userId: string }

      // Create Durable Object client
      const sessionClient = createDurableObjectClient<UserSessionMethods>(
        env.USER_SESSION, // Durable Object binding
        userId // Use userId as DO name for consistency
      )

      // Start session in Durable Object
      const { sessionId } = await sessionClient.call('session.start', { userId })

      // Connect via WebSocket for real-time updates
      const ws = await sessionClient.connect()

      // Listen for session events
      ws.on('session.ended', data => {
        console.log('Session ended:', data)
      })

      return Response.json({ sessionId })
    }

    return new Response('Not found', { status: 404 })
  }
}

/**
 * Other service methods (for cross-worker example)
 */
interface OtherServiceMethods extends ServiceMethodRegistry {
  'other.method': {
    params: { param: string }
    result: { value: string }
  }
}

/**
 * Export bindings for wrangler.toml
 */
export const bindings = {
  services: [
    {
      binding: 'OTHER_SERVICE',
      service: 'other-worker'
    }
  ],
  durable_objects: [
    {
      name: 'USER_SESSION',
      class_name: 'UserSessionDO',
      script_name: 'user-service'
    }
  ]
}
