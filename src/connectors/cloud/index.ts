/**
 * Cloud platform connectors
 */

// Export all cloud connectors
export * from './cloudflare';
export * from './aws';
export * from './gcp';

// Register connectors with factory
import { cloudPlatformRegistry } from '../../core/cloud/platform-factory';

import { CloudflareConnector } from './cloudflare';
import { AWSConnector } from './aws';
import { GCPConnector } from './gcp';

// Register all available connectors
cloudPlatformRegistry.register('cloudflare', CloudflareConnector);
cloudPlatformRegistry.register('aws', AWSConnector);
cloudPlatformRegistry.register('gcp', GCPConnector);
