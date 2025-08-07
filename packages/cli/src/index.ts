#!/usr/bin/env node

import { Command } from 'commander'
import { createCommand } from './commands/create.js'
import { addCommand } from './commands/add.js'

const program = new Command()

program
  .name('wireframe')
  .description('CLI for Wireframe AI Assistant Ecosystem')
  .version('2.0.0-alpha.1')

// Add commands
program.addCommand(createCommand)
program.addCommand(addCommand)

// Parse arguments
program.parse()