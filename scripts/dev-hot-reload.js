#!/usr/bin/env node

/**
 * Enhanced development server with hot reload support
 * Provides better DX with live reload, colored output, and parallel processes
 */

import chalk from 'chalk'
import { spawn } from 'child_process'
import chokidar from 'chokidar'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import WebSocket from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Configuration
const CONFIG = {
  wsPort: 3001,
  watchPaths: ['src/**/*.ts', 'src/**/*.tsx', 'wrangler.toml', '.dev.vars'],
  ignorePaths: ['node_modules', 'dist', 'coverage', '.git', '*.test.ts', '*.spec.ts'],
  debounceMs: 300
}

// WebSocket server for browser reload
class ReloadServer {
  constructor(port) {
    this.port = port
    this.wss = null
    this.clients = new Set()
  }

  start() {
    const server = http.createServer()
    this.wss = new WebSocket.Server({ server })

    this.wss.on('connection', ws => {
      this.clients.add(ws)
      console.log(chalk.gray(`[Hot Reload] Client connected (${this.clients.size} total)`))

      ws.on('close', () => {
        this.clients.delete(ws)
        console.log(chalk.gray(`[Hot Reload] Client disconnected (${this.clients.size} remaining)`))
      })

      ws.on('error', err => {
        console.error(chalk.red('[Hot Reload] WebSocket error:'), err)
        this.clients.delete(ws)
      })

      // Send initial connection confirmation
      ws.send(JSON.stringify({ type: 'connected' }))
    })

    server.listen(this.port, () => {
      console.log(chalk.green(`✨ Hot reload server running on ws://localhost:${this.port}`))
    })
  }

  reload(file) {
    const message = JSON.stringify({
      type: 'reload',
      file: path.relative(projectRoot, file),
      timestamp: Date.now()
    })

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })

    console.log(chalk.yellow(`🔄 Reloading ${this.clients.size} client(s)...`))
  }
}

// Process manager for running multiple commands
class ProcessManager {
  constructor() {
    this.processes = new Map()
  }

  spawn(name, command, args = [], options = {}) {
    // Kill existing process if running
    this.kill(name)

    console.log(chalk.blue(`▶️  Starting ${name}: ${command} ${args.join(' ')}`))

    const proc = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
      ...options
    })

    // Add colored prefix to output
    const prefix = this.getPrefix(name)

    proc.stdout.on('data', data => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach(line => {
        console.log(`${prefix} ${line}`)
      })
    })

    proc.stderr.on('data', data => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach(line => {
        console.error(`${prefix} ${chalk.red(line)}`)
      })
    })

    proc.on('error', err => {
      console.error(`${prefix} ${chalk.red(`Process error: ${err.message}`)}`)
    })

    proc.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        console.log(`${prefix} ${chalk.yellow(`Exited with code ${code}`)}`)
      }
      if (signal) {
        console.log(`${prefix} ${chalk.yellow(`Killed with signal ${signal}`)}`)
      }
      this.processes.delete(name)
    })

    this.processes.set(name, proc)
    return proc
  }

  kill(name) {
    const proc = this.processes.get(name)
    if (proc && !proc.killed) {
      proc.kill('SIGTERM')
      this.processes.delete(name)
    }
  }

  killAll() {
    this.processes.forEach((proc, name) => {
      this.kill(name)
    })
  }

  getPrefix(name) {
    const colors = {
      wrangler: chalk.cyan('[Wrangler]'),
      types: chalk.magenta('[Types]'),
      tests: chalk.green('[Tests]')
    }
    return colors[name] || chalk.gray(`[${name}]`)
  }
}

// File watcher with debouncing
class FileWatcher {
  constructor(reloadServer, processManager) {
    this.reloadServer = reloadServer
    this.processManager = processManager
    this.debounceTimers = new Map()
  }

  start() {
    const watcher = chokidar.watch(CONFIG.watchPaths, {
      ignored: CONFIG.ignorePaths,
      persistent: true,
      cwd: projectRoot
    })

    watcher
      .on('ready', () => {
        console.log(chalk.green('👀 Watching for file changes...'))
      })
      .on('change', filePath => {
        this.handleChange(filePath)
      })
      .on('add', filePath => {
        this.handleChange(filePath, true)
      })
      .on('unlink', filePath => {
        console.log(chalk.gray(`📄 File deleted: ${filePath}`))
      })

    return watcher
  }

  handleChange(filePath, isNew = false) {
    const fullPath = path.join(projectRoot, filePath)

    // Clear existing debounce timer
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath))
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      const emoji = isNew ? '✨' : '📝'
      console.log(chalk.cyan(`${emoji} ${isNew ? 'New file' : 'File changed'}: ${filePath}`))

      // Determine what needs to restart based on file type
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        // TypeScript files - wrangler will auto-reload
        this.reloadServer.reload(fullPath)

        // Regenerate types if it's a database-related file
        if (filePath.includes('/db/') || filePath.includes('schema')) {
          this.processManager.spawn('types', 'npm', ['run', 'db:types'])
        }
      } else if (filePath === 'wrangler.toml' || filePath === '.dev.vars') {
        // Config files - restart wrangler
        console.log(chalk.yellow('⚙️  Configuration changed, restarting wrangler...'))
        this.processManager.spawn('wrangler', 'npm', ['run', 'dev'])
      }

      this.debounceTimers.delete(filePath)
    }, CONFIG.debounceMs)

    this.debounceTimers.set(filePath, timer)
  }
}

// Main execution
async function main() {
  console.log(chalk.bold.blue('\n🚀 Starting Wireframe Development Server with Hot Reload\n'))

  // Initialize components
  const reloadServer = new ReloadServer(CONFIG.wsPort)
  const processManager = new ProcessManager()
  const fileWatcher = new FileWatcher(reloadServer, processManager)

  // Start reload server
  reloadServer.start()

  // Start wrangler dev server
  processManager.spawn('wrangler', 'npm', ['run', 'dev'])

  // Start type watching
  processManager.spawn('types', 'npm', ['run', 'db:types:watch'])

  // Start file watcher
  fileWatcher.start()

  // Add client-side reload script injection info
  console.log(chalk.gray('\n💡 Add this script to your HTML pages for browser reload:'))
  console.log(
    chalk.gray(`
  <script>
    (function() {
      const ws = new WebSocket('ws://localhost:${CONFIG.wsPort}');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'reload') {
          console.log('🔄 Reloading page...', data.file);
          location.reload();
        }
      };
      ws.onclose = () => console.log('Hot reload disconnected');
    })();
  </script>
  `)
  )

  // Handle shutdown gracefully
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Shutting down development server...'))
    processManager.killAll()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    processManager.killAll()
    process.exit(0)
  })
}

// Check dependencies
async function checkDependencies() {
  try {
    await import('chalk')
    await import('chokidar')
    await import('ws')
  } catch (error) {
    console.error(chalk.red('❌ Missing dependencies. Installing...'))
    const { execSync } = await import('child_process')
    execSync('npm install --save-dev chalk chokidar ws', { stdio: 'inherit' })
    console.log(chalk.green('✅ Dependencies installed. Please run the command again.'))
    process.exit(0)
  }
}

// Run
checkDependencies().then(() => {
  main().catch(err => {
    console.error(chalk.red('Fatal error:'), err)
    process.exit(1)
  })
})
