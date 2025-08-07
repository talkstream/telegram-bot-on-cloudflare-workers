#!/usr/bin/env node
/**
 * Automated contribution tool for Wireframe
 * Enhances the manual Bot-Driven Development workflow
 */

import chalk from 'chalk'
import { execSync } from 'child_process'
import { Command } from 'commander'
import fs from 'fs'
import inquirer from 'inquirer'
import ora from 'ora'
import path from 'path'

const program = new Command()

interface ContributionType {
  type: 'pattern' | 'performance' | 'bugfix' | 'feature'
  title: string
  description: string
  code?: string
  impact?: string
  context?: {
    tier?: 'free' | 'paid'
    scale?: string
    platform?: string
  }
}

interface ProductionInsight {
  type: string
  title: string
  description: string
  implementation?: string
  metrics?: Record<string, any>
  impact?: string
}

async function detectWorktree(): Promise<boolean> {
  try {
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf-8' }).trim()
    return gitDir.includes('.git/worktrees/')
  } catch {
    return false
  }
}

async function checkForExistingPRs(): Promise<string[]> {
  try {
    const openPRs = execSync('gh pr list --state open --json files,number,title', {
      encoding: 'utf-8'
    })
    const prs = JSON.parse(openPRs || '[]')

    // Get current branch changes
    const currentFiles = execSync('git diff --name-only main...HEAD', {
      encoding: 'utf-8'
    })
      .split('\n')
      .filter(Boolean)

    const conflicts: string[] = []

    for (const pr of prs) {
      const prFiles = pr.files || []
      const conflictingFiles = currentFiles.filter(file =>
        prFiles.some((prFile: any) => prFile.path === file)
      )

      if (conflictingFiles.length > 0) {
        conflicts.push(`PR #${pr.number} "${pr.title}" modifies: ${conflictingFiles.join(', ')}`)
      }
    }

    return conflicts
  } catch {
    return []
  }
}

async function analyzeRecentChanges(): Promise<ContributionType[]> {
  const spinner = ora('Analyzing recent changes...').start()
  const contributions: ContributionType[] = []

  try {
    // Check for conflicts with existing PRs
    const conflicts = await checkForExistingPRs()
    if (conflicts.length > 0) {
      spinner.warn('Potential conflicts detected with existing PRs:')
      conflicts.forEach(conflict => console.log(chalk.yellow(`  - ${conflict}`)))
      console.log(chalk.blue('\nConsider rebasing after those PRs are merged.\n'))
    }

    // Get recent changes
    const diffStat = execSync('git diff --stat HEAD~5..HEAD', { encoding: 'utf-8' })
    const recentCommits = execSync('git log --oneline -10', { encoding: 'utf-8' })

    // Smart detection logic
    if (diffStat.includes('performance') || diffStat.includes('optimize')) {
      contributions.push({
        type: 'performance',
        title: 'Performance Optimization',
        description: 'Detected performance-related changes',
        impact: 'Potential CPU/memory improvements'
      })
    }

    if (diffStat.includes('fix') || recentCommits.includes('fix:')) {
      contributions.push({
        type: 'bugfix',
        title: 'Bug Fix',
        description: 'Detected bug fix in recent commits',
        impact: 'Improved stability'
      })
    }

    // Check for new patterns
    const newFiles = execSync('git diff --name-only --diff-filter=A HEAD~5..HEAD', {
      encoding: 'utf-8'
    })
    if (newFiles.includes('utils/') || newFiles.includes('helpers/')) {
      contributions.push({
        type: 'pattern',
        title: 'Reusable Pattern',
        description: 'New utility or helper detected',
        impact: 'Code reusability improvement'
      })
    }

    spinner.succeed(`Found ${contributions.length} potential contributions`)
  } catch (error) {
    spinner.fail('Failed to analyze changes')
  }

  return contributions
}

async function createContributionBranch(contribution: ContributionType): Promise<string> {
  const branchName = `contrib/${contribution.type}-${contribution.title.toLowerCase().replace(/\s+/g, '-')}`

  // Check for conflicts before creating branch
  const conflicts = await checkForExistingPRs()
  if (conflicts.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warning: Your contribution may conflict with existing PRs'))
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to continue anyway?',
        default: true
      }
    ])

    if (!proceed) {
      console.log(chalk.blue('Consider waiting for existing PRs to be merged first.'))
      process.exit(0)
    }
  }

  // Check if we're in a worktree
  const inWorktree = await detectWorktree()

  if (inWorktree) {
    console.log(chalk.yellow('Detected worktree environment'))
    console.log(chalk.blue('Creating branch in main repository...'))

    // Get main worktree path
    const mainPath = path.resolve(process.cwd(), '../../wireframe')

    // Create branch in main worktree
    execSync(`cd ${mainPath} && git checkout -b ${branchName}`, { stdio: 'inherit' })

    console.log(chalk.green('✓ Branch created in main repository'))
  } else {
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' })
  }

  return branchName
}

async function generatePRTemplate(contribution: ContributionType): Promise<string> {
  const tier = contribution.context?.tier || 'both'
  const scale = contribution.context?.scale || 'N/A'
  const platform = contribution.context?.platform || 'Cloudflare Workers'

  return `## 🎯 Contribution: ${contribution.title}

### Type
\`${contribution.type}\`

### Description
${contribution.description}

### Context
- **Environment**: ${tier} tier
- **Scale**: ${scale}
- **Platform**: ${platform}

### Impact
${contribution.impact || 'To be measured'}

### Testing
- [ ] Added tests
- [ ] Tested on free tier
- [ ] Tested on paid tier
- [ ] Documentation updated
- [ ] TypeScript strict mode compliant
- [ ] No ESLint warnings

### Related Issues
Discovered during real-world bot development.

---
*This contribution was generated using \`npm run contribute\`*`
}

async function generateTests(contribution: ContributionType): Promise<string> {
  const testTemplate = `import { describe, it, expect } from 'vitest';

describe('${contribution.title}', () => {
  it('should ${contribution.description.toLowerCase()}', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
  
  ${
    contribution.type === 'performance'
      ? `
  it('should improve performance metrics', async () => {
    // TODO: Add performance benchmarks
  });`
      : ''
  }
  
  ${
    contribution.type === 'bugfix'
      ? `
  it('should not regress the fixed behavior', async () => {
    // TODO: Add regression test
  });`
      : ''
  }
});`

  return testTemplate
}

async function interactiveContribute(options: any) {
  console.log(chalk.blue('🚀 Wireframe Contribution Helper\n'))

  const { type } = options

  let contribution: ContributionType

  if (type) {
    // Direct type specified
    contribution = await promptForContribution(type)
  } else {
    // Interactive mode
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'What type of contribution?',
        choices: [
          { name: '⚡ Performance optimization', value: 'performance' },
          { name: '🐛 Bug fix', value: 'bugfix' },
          { name: '✨ New pattern', value: 'pattern' },
          { name: '🚀 Feature request', value: 'feature' }
        ]
      }
    ])

    contribution = await promptForContribution(answer.type)
  }

  // Create contribution branch
  const branch = await createContributionBranch(contribution)

  // Generate files
  await generateContributionFiles(contribution)

  // Generate PR template
  const prTemplate = await generatePRTemplate(contribution)

  console.log(chalk.green('\n✓ Contribution prepared!'))
  console.log(chalk.blue('\nNext steps:'))
  console.log('1. Review generated files')
  console.log('2. Complete TODOs in tests')
  console.log('3. Commit changes')
  console.log('4. Push branch and create PR')
  console.log('\nPR Template saved to: .github/pull_request_template.md')
}

async function promptForContribution(type: string): Promise<ContributionType> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Brief title:',
      validate: input => input.length > 5
    },
    {
      type: 'editor',
      name: 'description',
      message: 'Describe your contribution:'
    },
    {
      type: 'input',
      name: 'impact',
      message: 'What impact does this have?'
    },
    {
      type: 'list',
      name: 'tier',
      message: 'Which tier was this tested on?',
      choices: ['free', 'paid', 'both']
    }
  ])

  return {
    type: type as any,
    title: answers.title,
    description: answers.description,
    impact: answers.impact,
    context: {
      tier: answers.tier
    }
  }
}

async function generateContributionFiles(contribution: ContributionType) {
  // Create .wireframe-contributions directory
  const contribDir = '.wireframe-contributions'
  if (!fs.existsSync(contribDir)) {
    fs.mkdirSync(contribDir)
  }

  // Save contribution metadata
  fs.writeFileSync(
    path.join(contribDir, 'contribution.json'),
    JSON.stringify(contribution, null, 2)
  )

  // Generate test file
  const testContent = await generateTests(contribution)
  const testFile = `src/__tests__/contributions/${contribution.type}-${Date.now()}.test.ts`

  // Ensure test directory exists
  const testDir = path.dirname(testFile)
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }

  fs.writeFileSync(testFile, testContent)

  // Generate PR template
  const prTemplate = await generatePRTemplate(contribution)
  const prDir = '.github'
  if (!fs.existsSync(prDir)) {
    fs.mkdirSync(prDir)
  }

  fs.writeFileSync(path.join(prDir, 'pull_request_template.md'), prTemplate)

  console.log(chalk.green('✓ Generated test file: ' + testFile))
  console.log(chalk.green('✓ Generated PR template'))
}

async function autoContribute() {
  console.log(chalk.blue('🤖 Auto-detecting contributions...\n'))

  const contributions = await analyzeRecentChanges()

  if (contributions.length === 0) {
    console.log(chalk.yellow('No obvious contributions detected.'))
    console.log('Try using interactive mode: npm run contribute')
    return
  }

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select contributions to submit:',
      choices: contributions.map(c => ({
        name: `${c.type === 'performance' ? '⚡' : c.type === 'bugfix' ? '🐛' : '✨'} ${c.title} - ${c.description}`,
        value: c,
        checked: true
      }))
    }
  ])

  for (const contribution of selected) {
    await createContributionBranch(contribution)
    await generateContributionFiles(contribution)
  }

  console.log(chalk.green(`\n✓ Prepared ${selected.length} contributions!`))
}

// Command setup
program
  .name('contribute')
  .description('Easy contribution tool for Wireframe')
  .option('-t, --type <type>', 'contribution type (pattern|performance|bugfix|feature)')
  .option('-a, --auto', 'auto-detect contributions from recent changes')
  .option('--ci', 'run in CI mode (non-interactive)')
  .action(async options => {
    try {
      if (options.auto) {
        await autoContribute()
      } else {
        await interactiveContribute(options)
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.message))
      process.exit(1)
    }
  })

program.parse()
