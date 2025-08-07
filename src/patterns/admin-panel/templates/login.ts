/**
 * Login page template for admin panel
 */

import type { LoginPageOptions } from '../types'

export function renderLoginPage(options: LoginPageOptions = {}): string {
  const { error, showCodeInput = false, telegramId = '' } = options

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        
        .login-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 40px;
            width: 100%;
            max-width: 400px;
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .login-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        
        .login-title {
            font-size: 24px;
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }
        
        .login-subtitle {
            color: #666;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }
        
        input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        
        input:focus {
            outline: none;
            border-color: #0066cc;
        }
        
        .button {
            width: 100%;
            padding: 12px 16px;
            background: #0066cc;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .button:hover {
            background: #0052a3;
        }
        
        .button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .error {
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .success {
            background: #efe;
            border: 1px solid #cfc;
            color: #363;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .info {
            color: #666;
            font-size: 14px;
            margin-top: 20px;
            text-align: center;
        }
        
        .code-input {
            font-size: 24px;
            text-align: center;
            letter-spacing: 8px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <div class="login-icon">🔐</div>
            <h1 class="login-title">Admin Panel</h1>
            <p class="login-subtitle">Secure authentication via Telegram</p>
        </div>
        
        ${error ? `<div class="error">${error}</div>` : ''}
        
        ${
          showCodeInput
            ? `
            <div class="success">
                ✅ Code sent to your Telegram! Check your messages from the bot.
            </div>
            <form method="POST">
                <input type="hidden" name="action" value="verify-code">
                <input type="hidden" name="telegram_id" value="${telegramId}">
                
                <div class="form-group">
                    <label for="code">Enter 6-digit code</label>
                    <input 
                        type="text" 
                        id="code" 
                        name="code" 
                        class="code-input"
                        maxlength="6" 
                        pattern="[0-9]{6}"
                        required
                        autocomplete="off"
                        autofocus
                    >
                </div>
                
                <button type="submit" class="button">Verify Code</button>
            </form>
        `
            : `
            <form method="POST">
                <input type="hidden" name="action" value="request-code">
                
                <div class="form-group">
                    <label for="telegram_id">Your Telegram ID</label>
                    <input 
                        type="text" 
                        id="telegram_id" 
                        name="telegram_id" 
                        pattern="[0-9]+"
                        required
                        autocomplete="off"
                        placeholder="123456789"
                    >
                </div>
                
                <button type="submit" class="button">Send Code</button>
            </form>
            
            <div class="info">
                💡 Don't know your Telegram ID?<br>
                Send /start to the bot to see it.
            </div>
        `
        }
    </div>
    
    <script>
        // Auto-focus code input and handle paste
        const codeInput = document.querySelector('.code-input');
        if (codeInput) {
            codeInput.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text');
                const numbers = paste.replace(/\\D/g, '').slice(0, 6);
                codeInput.value = numbers;
            });
        }
    </script>
</body>
</html>
  `
}
