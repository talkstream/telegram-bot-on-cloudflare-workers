import { execSync } from 'child_process'
import path from 'path'

import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs-extra'
import ora from 'ora'

export const addCommand = new Command('add')
  .description('Add a package to your bot')
  .argument('<packages...>', 'Packages to add')
  .option('--plugin', 'Add as plugin instead of connector')
  .option('--dev', 'Add as dev dependency')
  .action(async (packages, options) => {
    // Check if in a Wireframe project
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      console.error(chalk.red('Error: Not in a Wireframe project directory'))
      process.exit(1)
    }

    const packageJson = await fs.readJson(packageJsonPath)

    // Check if it's a Wireframe project
    if (!packageJson.dependencies?.['@wireframe/core']) {
      console.error(chalk.red('Error: This is not a Wireframe project'))
      process.exit(1)
    }

    const spinner = ora('Adding packages...').start()

    try {
      // Prepare package names
      const packageNames = packages.map((pkg: string) => {
        if (pkg.startsWith('@wireframe/')) {
          return pkg
        }
        if (options.plugin) {
          return `@wireframe/plugin-${pkg}`
        }
        return `@wireframe/connector-${pkg}`
      })

      // Install packages
      const installCmd = `npm install ${options.dev ? '--save-dev' : ''} ${packageNames.join(' ')}`
      execSync(installCmd, { stdio: 'inherit' })

      spinner.succeed('Packages added successfully!')

      // Update wireframe.config if needed
      const configFiles = ['wireframe.config.ts', 'wireframe.config.js']
      const configFile = configFiles.find(f => fs.existsSync(path.join(process.cwd(), f)))

      if (configFile && !options.dev) {
        console.info(
          chalk.yellow('\n⚠️  Remember to update your wireframe.config to use the new packages')
        )
        console.info(chalk.dim('Example:'))
        console.info(
          chalk.dim(`
export default defineConfig({
  connectors: [${packages
    .filter((_p: string) => !options.plugin)
    .map((p: string) => `'${p}'`)
    .join(', ')}],
  plugins: [${options.plugin ? packages.map((p: string) => `'${p}'`).join(', ') : ''}]
})`)
        )
      }

      console.info(chalk.green('\n✨ Done!\n'))
    } catch (error) {
      spinner.fail('Failed to add packages')
      console.error(error)
      process.exit(1)
    }
  })
