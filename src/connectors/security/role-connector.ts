import { EventBus } from '@/core/events/event-bus'
import type {
  Connector,
  ConnectorCapabilities,
  ConnectorConfig,
  HealthStatus,
  ValidationResult
} from '@/core/interfaces/connector'
import { ConnectorType } from '@/core/interfaces/connector'
import type { RoleService, RoleUser, UserRole } from '@/core/interfaces/role-system'
import { logger } from '@/lib/logger'

export interface RoleConnectorConfig extends ConnectorConfig {
  roleService: RoleService
  platformName: string
  platformIdExtractor?: (context: unknown) => string
}

export interface ConnectorEvent {
  type: string
  data: unknown
}

interface RoleChangeEvent {
  type: 'role.assigned' | 'role.removed' | 'role.changed'
  userId: string
  role?: UserRole
  previousRole?: UserRole
  performedBy?: string
  timestamp: Date
}

interface UserContext {
  from?: { id: string | number }
  user?: { id: string }
  userId?: string
}

export class RoleConnector implements Connector {
  id = 'security-role'
  name = 'Role Management Connector'
  version = '1.0.0'
  type = ConnectorType.SECURITY

  private config: RoleConnectorConfig | null = null
  private roleService: RoleService | null = null
  private eventBus: EventBus
  private isInitialized = false

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config as RoleConnectorConfig
    this.roleService = this.config.roleService

    logger.info('Initializing role connector', { platform: this.config.platformName })

    // Subscribe to role events
    await this.eventBus.on('role.change', async event => {
      // Cast to RoleChangeEvent as we know this event type
      await this.handleRoleChange(event.payload as RoleChangeEvent)
    })

    this.isInitialized = true
  }

  isReady(): boolean {
    return this.isInitialized && this.roleService !== null
  }

  validateConfig(config: ConnectorConfig): ValidationResult {
    const errors: { field: string; message: string }[] = []
    const roleConfig = config as RoleConnectorConfig

    if (!roleConfig.roleService) {
      errors.push({ field: 'roleService', message: 'Role service is required' })
    }

    if (!roleConfig.platformName) {
      errors.push({ field: 'platformName', message: 'Platform name is required' })
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      features: ['role.check', 'role.assign', 'role.remove', 'access.check', 'hierarchy.support']
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.isReady()) {
      return {
        status: 'unhealthy',
        message: 'Connector not initialized',
        timestamp: Date.now()
      }
    }

    try {
      // Test role service by checking if it can get all roles
      if (this.roleService) {
        await this.roleService.getAllRoles()
      }

      return {
        status: 'healthy',
        message: 'Role connector is functioning properly',
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Role service is not responding',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now()
      }
    }
  }

  async destroy(): Promise<void> {
    logger.info('Destroying role connector')
    this.isInitialized = false
    this.roleService = null
    this.config = null
  }

  async handleEvent(event: ConnectorEvent): Promise<void> {
    logger.debug('Role connector handling event', { type: event.type })

    switch (event.type) {
      case 'user.check_role':
        await this.checkUserRole(event.data)
        break
      case 'user.assign_role':
        await this.assignUserRole(
          event.data as {
            userId: string
            platformId: string
            role: UserRole
            grantedBy?: string
          }
        )
        break
      case 'user.remove_role':
        await this.removeUserRole(event.data as { userId: string })
        break
      default:
        logger.debug('Unknown event type for role connector', { type: event.type })
    }
  }

  private async handleRoleChange(event: RoleChangeEvent): Promise<void> {
    logger.info('Role change detected', event)

    // Emit platform-specific events
    if (this.config) {
      await this.eventBus.emit(
        `${this.config.platformName}.role.changed`,
        {
          ...event,
          platform: this.config.platformName
        },
        'role-connector'
      )
    }
  }

  private async checkUserRole(data: unknown): Promise<UserRole | null> {
    const userId = this.extractUserId(data)
    if (!userId || !this.roleService) return null

    return await this.roleService.getUserRole(userId)
  }

  private async assignUserRole(data: {
    userId: string
    platformId: string
    role: UserRole
    grantedBy?: string
  }): Promise<void> {
    if (!this.roleService || !this.config) return

    const user: Omit<RoleUser, 'grantedAt'> = {
      id: data.userId,
      platformId: data.platformId,
      platform: this.config.platformName,
      role: data.role,
      grantedBy: data.grantedBy
    }

    await this.roleService.assignRole(user)
  }

  private async removeUserRole(data: { userId: string }): Promise<void> {
    if (!this.roleService) return

    await this.roleService.removeRole(data.userId)
  }

  private extractUserId(context: unknown): string | null {
    if (this.config?.platformIdExtractor) {
      return this.config.platformIdExtractor(context)
    }

    const userContext = context as UserContext

    // Default extractors for common platforms
    if (userContext.from?.id) return userContext.from.id.toString() // Telegram
    if (userContext.user?.id) return userContext.user.id // Discord
    if (userContext.userId) return userContext.userId // Generic

    return null
  }

  // Helper methods for platform integrations
  async checkAccess(context: unknown): Promise<boolean> {
    const userId = this.extractUserId(context)
    if (!userId || !this.roleService) return false

    return await this.roleService.hasAccess(userId)
  }

  async requireRole(context: unknown, requiredRole: UserRole): Promise<boolean> {
    const userId = this.extractUserId(context)
    if (!userId || !this.roleService) return false

    return await this.roleService.hasRole(userId, requiredRole)
  }

  async requireOwner(context: unknown): Promise<boolean> {
    const userId = this.extractUserId(context)
    if (!userId || !this.roleService) return false

    return await this.roleService.isOwner(userId)
  }

  async requireAdmin(context: unknown): Promise<boolean> {
    const userId = this.extractUserId(context)
    if (!userId || !this.roleService) return false

    return await this.roleService.isAdmin(userId)
  }

  getSupportedEvents(): string[] {
    return ['user.check_role', 'user.assign_role', 'user.remove_role', 'role.change']
  }
}
