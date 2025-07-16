# Starting a New Project with the Gemini Wireframe

This wireframe provides a robust and scalable foundation for building a new Telegram Bot using Cloudflare Workers, TypeScript, and Hono.

## 1. Initial Setup

1.  **Copy the Wireframe:** Copy the contents of this directory to a new project folder.
2.  **Install Dependencies:** Run `npm install` to install the necessary packages.

## 2. Configuration

1.  **`wrangler.toml`:**
    *   Rename the `name` of your worker.
    *   Uncomment and configure your `kv_namespaces` and `d1_databases` if you need them.
    *   Configure cron triggers for scheduled tasks under the `[triggers]` section.
    *   Define environment-specific settings for `staging` and `production`.
2.  **`package.json`:**
    *   Change the `name` and `description` of your project.
3.  **Environment Variables (`src/config/env.ts`):**
    *   Define your environment variables in the `envSchema` using Zod for validation.
    *   Create a `.dev.vars` file for local development and add your environment variables.
    *   For production, set your environment variables as secrets using `wrangler secret put <VARIABLE_NAME>`.
4.  **Sentry (Optional):**
    *   To enable Sentry for error monitoring, add your `SENTRY_DSN` to your environment variables.
    *   You can also set the `ENVIRONMENT` variable to distinguish between `development`, `staging`, and `production`.
5.  **Cloudflare KV (for Sessions):**
    *   If you plan to use session management, create a KV Namespace in your Cloudflare dashboard and update the `SESSIONS` binding in `wrangler.toml` with its ID.
6.  **Cloudflare D1 (for Database):**
    *   If you plan to use the database, create a D1 Database in your Cloudflare dashboard and update the `DB` binding in `wrangler.toml` with its ID.
7.  **Gemini API Key:**
    *   Add your `GEMINI_API_KEY` to your environment variables for AI integration.
8.  **GitHub Actions Secrets:**
    *   For automated deployments, add the following secrets to your GitHub repository:
        - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API Token with Workers permissions.
        - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.

## 3. Development

*   **Core Logic:** The `TelegramAdapter` in `src/core/telegram-adapter.ts` encapsulates the main bot logic, middleware, and update handling.
*   **Features:** Organize your bot's features (commands, handlers, etc.) in the `src/adapters/telegram/commands/` and `src/adapters/telegram/callbacks/` directories.
*   **Services:** Place your business logic in the `src/services` directory (e.g., `SessionService`, `GeminiService`, `StarsService`).
*   **Middleware:** Add any custom middleware to the `src/middleware` directory (e.g., `errorHandler`).
*   **Scheduled Tasks:** Implement your scheduled tasks in `src/core/scheduled-handler.ts`.
*   **Input Validation:** Use Zod schemas from `src/lib/telegram-types.ts` to validate incoming Telegram updates.
*   **Health Checks:** The `/health` endpoint provides a status overview of your bot and its dependencies.
*   **Internationalization:** Manage your bot's messages in `src/lib/i18n.ts`.
*   **Telegram Stars:** Implement payment logic in `src/domain/services/telegram-stars.service.ts` and handlers in `src/adapters/telegram/handlers/paymentHandler.ts`.
*   **Telegram Text Formatting:** Use utilities from `src/lib/telegram-formatter.ts` for safe Markdown v2 formatting.
*   **Content Censoring:** Utilize `src/lib/censor.ts` for text filtering if needed.
*   **Run Locally:** Run `npm run dev` to start the local development server.

## 4. Deployment

*   Run `npm run deploy` to deploy your bot to Cloudflare Workers.
*   To deploy to a specific environment (e.g., staging or production), use `npm run deploy -- --env <environment_name>`.

## 4. Deployment

*   Run `npm run deploy` to deploy your bot to Cloudflare Workers.

## 5. Setting the Webhook

After deployment, you need to set the Telegram webhook to your worker's URL.

1.  **Get Your Worker URL:** After the first deployment, you'll get a URL like `https://<your-worker-name>.<your-subdomain>.workers.dev`.
2.  **Set the Webhook:** Use the following `curl` command to set the webhook:

    ```bash
    curl "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-worker-name>.<your-subdomain>.workers.dev/webhook"
    ```