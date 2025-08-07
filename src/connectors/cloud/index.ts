/**
 * Cloud platform connectors
 */

// Export all cloud connectors
export * from './aws'
export * from './cloudflare'
export * from './gcp'

// Register connectors with factory
import { cloudPlatformRegistry } from '../../core/cloud/platform-factory'

import { AWSConnector } from './aws'
import { CloudflareConnector } from './cloudflare'
import { GCPConnector } from './gcp'

// Register all available connectors
cloudPlatformRegistry.register('cloudflare', CloudflareConnector)
cloudPlatformRegistry.register('aws', AWSConnector)
cloudPlatformRegistry.register('gcp', GCPConnector)
