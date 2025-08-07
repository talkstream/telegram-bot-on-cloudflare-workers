/**
 * CLI types and interfaces
 */

export interface ProjectOptions {
  name: string
  platform: 'telegram' | 'discord' | 'slack' | 'whatsapp'
  cloud: 'cloudflare' | 'aws' | 'gcp' | 'azure'
  ai: 'openai' | 'anthropic' | 'google' | 'local' | 'multi'
  features: Feature[]
  typescript?: boolean
  git: boolean
  install: boolean
}

export type Feature =
  | 'database'
  | 'payments'
  | 'analytics'
  | 'i18n'
  | 'plugins'
  | 'admin'
  | 'monitoring'
  | 'testing'

export interface Template {
  name: string
  description: string
  path: string
  platforms: string[]
  clouds: string[]
}

export interface FileTemplate {
  path: string
  content: string
  condition?: (options: ProjectOptions) => boolean
}

export interface PackageJson {
  name: string
  version: string
  description: string
  type: string
  main: string
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  engines?: {
    node: string
    npm: string
  }
}
