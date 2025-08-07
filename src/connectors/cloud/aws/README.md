# AWS Connector for Wireframe

This connector enables deployment of Wireframe bots on AWS infrastructure, supporting Lambda, DynamoDB, S3, and ElastiCache.

## Features

- ✅ AWS Lambda for serverless compute
- ✅ DynamoDB for key-value and database storage
- ✅ S3 for object storage with pre-signed URLs
- ✅ ElastiCache/DynamoDB for caching
- ✅ Full TypeScript type safety
- ✅ Resource constraints adapted to AWS limits

## Configuration

```typescript
import { AWSConnector } from '@/connectors/cloud/aws'

const connector = new AWSConnector({
  env: {
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,

    // Service mappings
    DYNAMODB_TABLES: {
      kv: 'wireframe-kv-store',
      sessions: 'wireframe-sessions'
    },
    S3_BUCKETS: {
      uploads: 'wireframe-uploads',
      static: 'wireframe-static'
    },
    USE_ELASTICACHE: 'true' // or 'false' to use DynamoDB for cache
  }
})
```

## Storage Services

### Key-Value Store (DynamoDB)

```typescript
const kv = connector.getKeyValueStore('sessions')
await kv.set('user:123', JSON.stringify({ name: 'John' }))
const user = await kv.get('user:123')
```

### Database Store (RDS/Aurora)

```typescript
const db = connector.getDatabaseStore('main')
const result = await db.query('SELECT * FROM users WHERE id = ?', [userId])
```

### Object Store (S3)

```typescript
const s3 = connector.getObjectStore('uploads')
await s3.put('file.pdf', fileStream)
const url = await s3.getPresignedUrl('file.pdf', 'get', 3600)
```

### Cache Store (ElastiCache/DynamoDB)

```typescript
const cache = connector.getCacheStore()
await cache.set('api:response', JSON.stringify(data), 300) // 5 min TTL
const cached = await cache.get('api:response')
```

## AWS-Specific Features

### Pre-signed URLs

The S3 object store supports generating pre-signed URLs for secure, temporary access:

```typescript
const s3 = connector.getObjectStore('uploads') as AWSS3ObjectStore
const uploadUrl = await s3.getPresignedUrl('avatar.jpg', 'put', 3600)
const downloadUrl = await s3.getPresignedUrl('avatar.jpg', 'get', 3600)
```

### Multipart Uploads

For large files, use multipart uploads:

```typescript
const uploadId = await s3.createMultipartUpload('large-video.mp4')
// Upload parts...
```

### Cache Persistence

The cache store can persist to DynamoDB for durability:

```typescript
const cache = connector.getCacheStore() as AWSCacheStore
await cache.persistToDynamoDB()
await cache.loadFromDynamoDB()
```

## Resource Constraints

AWS Lambda provides generous limits compared to edge platforms:

- **Execution Time**: Up to 15 minutes
- **Memory**: Up to 10 GB
- **Concurrent Executions**: 1000 (default, can be increased)
- **Request/Response Size**: 6 MB request, 10 MB response (API Gateway)
- **Storage**: Virtually unlimited with S3
- **Database**: High limits with DynamoDB and RDS

## Deployment

### Lambda Function Setup

1. Package your Wireframe bot:

```bash
npm run build
zip -r function.zip dist/ node_modules/
```

2. Create Lambda function:

```bash
aws lambda create-function \
  --function-name wireframe-bot \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-role \
  --handler dist/index.handler \
  --zip-file fileb://function.zip
```

3. Set up API Gateway for webhooks:

```bash
aws apigatewayv2 create-api \
  --name wireframe-bot-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:REGION:ACCOUNT:function:wireframe-bot
```

### Infrastructure as Code

Consider using AWS CDK or Terraform for managing infrastructure:

```typescript
// Example CDK stack
import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

export class WireframeBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // DynamoDB tables
    const kvTable = new dynamodb.Table(this, 'KVStore', {
      partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    })

    // Lambda function
    const botFunction = new lambda.Function(this, 'BotFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist'),
      environment: {
        DYNAMODB_TABLE: kvTable.tableName
      }
    })

    kvTable.grantReadWriteData(botFunction)
  }
}
```

## Environment Variables

```env
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Service Configuration
DYNAMODB_TABLE_PREFIX=wireframe-
S3_BUCKET_PREFIX=wireframe-
USE_ELASTICACHE=true
ELASTICACHE_ENDPOINT=your-cache.abc123.cache.amazonaws.com

# Bot Configuration
BOT_TOKEN=your_bot_token
WEBHOOK_SECRET=your_webhook_secret
```

## Cost Optimization

1. **Use DynamoDB On-Demand**: Pay only for what you use
2. **Enable S3 Lifecycle Policies**: Archive old objects
3. **Use Lambda Reserved Concurrency**: Control costs
4. **Cache Aggressively**: Reduce API calls
5. **Monitor with CloudWatch**: Track usage patterns

## Monitoring

The AWS connector integrates with CloudWatch for monitoring:

```typescript
// Metrics are automatically sent to CloudWatch
// View them in the AWS Console or query via API

// Custom metrics
const cloudwatch = new CloudWatchClient({ region })
await cloudwatch.send(
  new PutMetricDataCommand({
    Namespace: 'Wireframe/Bot',
    MetricData: [
      {
        MetricName: 'MessageProcessed',
        Value: 1,
        Unit: 'Count'
      }
    ]
  })
)
```

## Limitations

1. **Cold Starts**: Lambda may have cold start delays
2. **API Gateway Limits**: 29 second timeout for HTTP APIs
3. **VPC Complexity**: Additional setup for private resources
4. **Regional**: Services must be in the same region

## Best Practices

1. **Use Environment Variables**: Store configuration in Lambda environment
2. **Enable X-Ray**: For distributed tracing
3. **Set Up DLQ**: Dead letter queues for failed messages
4. **Use Layers**: Share common code across functions
5. **Monitor Costs**: Set up billing alerts

## Migration from Cloudflare

If migrating from Cloudflare Workers:

1. **KV → DynamoDB**: Similar key-value semantics
2. **D1 → RDS/Aurora**: Full SQL support
3. **R2 → S3**: Compatible API
4. **Durable Objects → DynamoDB**: Use single-table design

The connector handles these mappings transparently.
