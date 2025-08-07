/**
 * Webhook Validation Pattern
 *
 * This pattern demonstrates how to securely validate incoming Telegram webhooks
 * to ensure they are authentic and haven't been tampered with.
 *
 * Files in wireframe using this pattern:
 * - /src/handlers/webhook.ts - Main webhook handler implementation
 * - /src/middleware/auth.ts - Authentication middleware with webhook validation
 * - /src/core/webhook-handler.ts - Core webhook processing logic
 *
 * Security measures implemented:
 * 1. Secret token validation via X-Telegram-Bot-Api-Secret-Token header
 * 2. URL path token validation for additional security
 * 3. Request body JSON validation
 * 4. Rate limiting to prevent abuse
 * 5. Proper error handling without exposing sensitive information
 */

// Mock function for processing updates - in the wireframe this is handled
// by the TelegramAdapter in /src/core/telegram-adapter.ts
async function processUpdate(data, _env, _ctx) {
  // Process the Telegram update
  console.log('Processing update:', data)
}

// Method 1: Secret Token Validation (Recommended)
export async function validateWebhookWithSecret(request, env) {
  // Telegram sends the secret token in the X-Telegram-Bot-Api-Secret-Token header
  const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token')

  if (!token || token !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Webhook is valid, proceed with processing
  return null // Continue processing
}

// Method 2: IP Whitelist Validation (Additional Security)
const TELEGRAM_IP_RANGES = [
  '149.154.160.0/20',
  '91.108.4.0/22',
  '91.108.8.0/22',
  '91.108.12.0/22',
  '91.108.16.0/22',
  '91.108.20.0/22',
  '91.108.56.0/22',
  '91.105.192.0/23',
  '91.105.194.0/23',
  '91.105.196.0/23',
  '91.105.198.0/23',
  '91.105.200.0/23',
  '91.105.202.0/23',
  '91.105.204.0/23',
  '91.105.206.0/23',
  '91.105.208.0/23',
  '91.105.210.0/23',
  '91.105.212.0/23',
  '91.105.214.0/23',
  '91.105.216.0/23',
  '91.105.218.0/23',
  '185.76.151.0/24'
]

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
}

function isIpInRange(ip, range) {
  const [rangeIp, rangeBits] = range.split('/')
  const ipInt = ipToInt(ip)
  const rangeInt = ipToInt(rangeIp)
  const mask = (0xffffffff << (32 - parseInt(rangeBits))) >>> 0
  return (ipInt & mask) === (rangeInt & mask)
}

export function validateTelegramIP(request) {
  const clientIP = request.headers.get('CF-Connecting-IP')

  if (!clientIP) {
    return false
  }

  return TELEGRAM_IP_RANGES.some(range => isIpInRange(clientIP, range))
}

// Method 3: Request Body Validation with Zod
import { z } from 'zod'

const telegramUpdateSchema = z
  .object({
    update_id: z.number(),
    message: z
      .object({
        message_id: z.number(),
        from: z
          .object({
            id: z.number(),
            is_bot: z.boolean(),
            first_name: z.string(),
            username: z.string().optional(),
            language_code: z.string().optional()
          })
          .optional(),
        chat: z.object({
          id: z.number(),
          type: z.enum(['private', 'group', 'supergroup', 'channel']),
          title: z.string().optional(),
          username: z.string().optional()
        }),
        date: z.number(),
        text: z.string().optional(),
        entities: z
          .array(
            z.object({
              type: z.string(),
              offset: z.number(),
              length: z.number()
            })
          )
          .optional()
      })
      .optional(),
    callback_query: z
      .object({
        id: z.string(),
        from: z.object({
          id: z.number(),
          is_bot: z.boolean(),
          first_name: z.string()
        }),
        data: z.string(),
        message: z.any().optional()
      })
      .optional()
    // Add more update types as needed
  })
  .passthrough() // Allow additional fields

export async function validateRequestBody(request) {
  try {
    const body = await request.json()
    const validated = telegramUpdateSchema.parse(body)
    return { valid: true, data: validated }
  } catch (error) {
    console.error('Invalid webhook payload:', error)
    return { valid: false, error }
  }
}

// Complete Webhook Handler with All Validations
export async function handleWebhook(request, env, ctx) {
  // 1. Validate secret token
  const secretError = await validateWebhookWithSecret(request, env)
  if (secretError) return secretError

  // 2. Optionally validate IP (may not work behind some proxies)
  if (env.VALIDATE_IP === 'true' && !validateTelegramIP(request)) {
    console.warn('Request from non-Telegram IP:', request.headers.get('CF-Connecting-IP'))
    // You might want to just log this rather than reject
  }

  // 3. Parse and validate body
  const { valid, data, error } = await validateRequestBody(request.clone())
  if (!valid) {
    console.error('Invalid update format:', error)
    return new Response('Bad Request', { status: 400 })
  }

  // 4. Process the validated update
  try {
    await processUpdate(data, env, ctx)
    return new Response('OK')
  } catch (error) {
    console.error('Error processing update:', error)
    // Return OK to prevent Telegram from retrying
    return new Response('OK')
  }
}

// Webhook Setup Helper
export async function setupWebhook(token, workerUrl, secret) {
  const url = new URL(`https://api.telegram.org/bot${token}/setWebhook`)
  url.searchParams.set('url', `${workerUrl}/webhook`)

  if (secret) {
    url.searchParams.set('secret_token', secret)
  }

  // Optionally set allowed updates
  url.searchParams.set(
    'allowed_updates',
    JSON.stringify([
      'message',
      'edited_message',
      'channel_post',
      'edited_channel_post',
      'callback_query',
      'inline_query',
      'chosen_inline_result',
      'shipping_query',
      'pre_checkout_query',
      'poll',
      'poll_answer'
    ])
  )

  const response = await fetch(url)
  const result = await response.json()

  if (!result.ok) {
    throw new Error(`Failed to set webhook: ${result.description}`)
  }

  return result
}

// Usage Example
/*
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/webhook') {
      return handleWebhook(request, env, ctx);
    }
    
    return new Response('Bot is running!');
  }
};
*/
