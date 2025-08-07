import type { Context, MiddlewareHandler } from 'hono'

import type { Env } from '@/types'

/**
 * Development-only middleware for hot reload support
 * Injects WebSocket client script for automatic page reloading
 */

const HOT_RELOAD_SCRIPT = `
<script>
  (function() {
    if (typeof window === 'undefined') return;
    
    const ws = new WebSocket('ws://localhost:3001');
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    
    function connect() {
      const ws = new WebSocket('ws://localhost:3001');
      
      ws.onopen = () => {
        console.log('🔥 Hot reload connected');
        reconnectAttempts = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'reload') {
            console.log('🔄 Reloading due to:', data.file);
            // Small delay to ensure server is ready
            setTimeout(() => location.reload(), 100);
          } else if (data.type === 'connected') {
            console.log('✅ Hot reload ready');
          }
        } catch (err) {
          console.error('Hot reload message error:', err);
        }
      };
      
      ws.onclose = () => {
        console.log('🔌 Hot reload disconnected');
        
        // Exponential backoff for reconnection
        if (reconnectAttempts < 10) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimer = setTimeout(() => {
            reconnectAttempts++;
            console.log(\`🔄 Attempting to reconnect... (attempt \${reconnectAttempts})\`);
            connect();
          }, delay);
        }
      };
      
      ws.onerror = (err) => {
        console.error('Hot reload error:', err);
      };
      
      return ws;
    }
    
    // Initial connection
    const socket = connect();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    });
    
    // Expose for debugging
    window.__hotReload = {
      socket,
      reconnect: connect,
      status: () => socket.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'
    };
  })();
</script>
`

/**
 * Checks if the response is HTML
 */
function isHtmlResponse(contentType?: string | null): boolean {
  return contentType ? contentType.includes('text/html') : false
}

/**
 * Development reload middleware
 * Injects hot reload script into HTML responses in development mode
 */
export const devReloadMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c: Context<{ Bindings: Env }>, next) => {
    const env = c.env

    // Only active in development mode
    if (env.ENVIRONMENT !== 'development') {
      await next()
      return
    }

    // Process the request
    await next()

    // Check if response is HTML
    const contentType = c.res.headers.get('content-type')
    if (!isHtmlResponse(contentType)) {
      return
    }

    // Get the response body
    const originalBody = await c.res.text()

    // Inject script before closing body tag or at the end
    let modifiedBody: string
    if (originalBody.includes('</body>')) {
      modifiedBody = originalBody.replace('</body>', `${HOT_RELOAD_SCRIPT}</body>`)
    } else if (originalBody.includes('</html>')) {
      modifiedBody = originalBody.replace('</html>', `${HOT_RELOAD_SCRIPT}</html>`)
    } else {
      // Append at the end if no body/html tags found
      modifiedBody = originalBody + HOT_RELOAD_SCRIPT
    }

    // Return modified response
    return c.html(modifiedBody)
  }
}

/**
 * WebSocket endpoint for hot reload
 * This would typically be in a separate server, but can be added for completeness
 */
export const createHotReloadEndpoint = () => {
  return async (c: Context<{ Bindings: Env }>) => {
    const upgradeHeader = c.req.header('Upgrade')

    if (upgradeHeader !== 'websocket') {
      return c.text('Expected WebSocket connection', 426)
    }

    // Note: Cloudflare Workers don't support WebSocket servers directly
    // This is just for documentation purposes
    // The actual WebSocket server runs in the dev-hot-reload.js script

    return c.text('WebSocket server runs separately on port 3001', 200)
  }
}

/**
 * Helper to inject reload script manually into templates
 * Useful for custom HTML generation
 */
export function injectHotReloadScript(html: string, isDevelopment = false): string {
  if (!isDevelopment) {
    return html
  }

  if (html.includes('</body>')) {
    return html.replace('</body>', `${HOT_RELOAD_SCRIPT}</body>`)
  }

  if (html.includes('</html>')) {
    return html.replace('</html>', `${HOT_RELOAD_SCRIPT}</html>`)
  }

  return html + HOT_RELOAD_SCRIPT
}

/**
 * Environment check helper
 */
export function isHotReloadEnabled(env: Env): boolean {
  return env.ENVIRONMENT === 'development' && env.HOT_RELOAD !== 'false'
}
