# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do NOT Create a Public Issue

Security vulnerabilities should not be reported via GitHub issues as they are publicly visible.

### 2. Contact Us Privately

Send details to: `security@your-domain.com`

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (if any)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 5 business days
- **Fix Timeline**: Depends on severity

### 4. Disclosure Policy

- We'll work with you to understand and fix the issue
- Credit will be given for responsible disclosure
- Please allow reasonable time for a fix before public disclosure

## Security Best Practices for Users

### Environment Variables

- **Never commit** `.dev.vars`, `.env`, or similar files
- Use `wrangler secret put` for production secrets
- Rotate tokens regularly
- Use strong, unique webhook secrets

### Webhook Security

Always validate webhooks:

```typescript
// ✅ Good - validates both URL token and header
if (token !== env.TELEGRAM_WEBHOOK_SECRET) return unauthorized()
if (header !== env.TELEGRAM_WEBHOOK_SECRET) return unauthorized()

// ❌ Bad - only validates URL token
if (token !== env.TELEGRAM_WEBHOOK_SECRET) return unauthorized()
```

### CORS Configuration

Update `src/config/cors.ts` with your actual domains:

```typescript
export const ALLOWED_ORIGINS = [
  'https://your-frontend.com',
  'https://app.your-domain.com'
  // Never use '*' in production!
]
```

### Database Security

- Always use parameterized queries
- Never concatenate user input into SQL
- Validate all input with Zod schemas
- Use least-privilege database permissions

### Rate Limiting

Configure appropriate rate limits:

```typescript
rateLimiter({
  maxRequests: 20, // Adjust based on your needs
  windowMs: 60000 // 1 minute
})
```

## Security Features

### Built-in Protections

1. **Input Validation**: All inputs validated with Zod
2. **SQL Injection Prevention**: Parameterized queries only
3. **XSS Protection**: Security headers and input sanitization
4. **Rate Limiting**: Distributed rate limiting with KV
5. **Secure Headers**: Comprehensive security headers
6. **Logging**: Sensitive data redaction

### Cloudflare Security

Leverages Cloudflare's built-in protections:

- DDoS protection
- WAF (Web Application Firewall)
- SSL/TLS encryption
- Bot protection
- IP reputation

## Audit Log

| Date | Version | Auditor | Findings |
| ---- | ------- | ------- | -------- |
| TBD  | TBD     | TBD     | TBD      |

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Security](https://developers.cloudflare.com/workers/runtime-apis/security/)
- [Telegram Bot Security](https://core.telegram.org/bots/webhooks#security)
