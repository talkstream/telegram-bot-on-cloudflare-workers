# CLAUDE_SETUP.md Maintenance Guide

## Overview

This document explains how the automated CLAUDE_SETUP.md generation system works and how to maintain it. The system ensures that setup instructions for Claude Code are always synchronized with the actual project configuration.

## Architecture

```
docs/setup-config.json    →    scripts/generate-claude-setup.js    →    CLAUDE_SETUP.md
       ↑                                    ↓                                  ↓
Configuration files                 Validation & Generation              Auto-generated
(.dev.vars.example,                                                    documentation
 package.json, etc.)
```

## Key Components

### 1. Setup Configuration (`docs/setup-config.json`)

The single source of truth for the setup process. This JSON file contains:

- **metadata**: Version and update information
- **mcp_servers**: Required MCP server configurations
- **requirements**: System requirements (Node.js, npm)
- **environment_variables**: Required and optional variables with validation
- **cloudflare_resources**: D1 database and KV namespace configurations
- **setup_phases**: Step-by-step setup process
- **success_dashboard**: Final success screen configuration
- **error_handling**: Common errors and their solutions
- **implementation_notes**: UI/UX guidelines

### 2. Generator Script (`scripts/generate-claude-setup.js`)

A Node.js script that:

- Reads the setup configuration
- Generates formatted markdown with progress indicators
- Adds a checksum for change detection
- Supports `--check` mode for CI/CD validation

#### Script Options

```bash
# Generate CLAUDE_SETUP.md
node scripts/generate-claude-setup.js

# Check if file is up to date (exits with code 1 if not)
node scripts/generate-claude-setup.js --check

# Verbose output
node scripts/generate-claude-setup.js --verbose

# Show help
node scripts/generate-claude-setup.js --help
```

### 3. GitHub Action (`.github/workflows/update-claude-setup.yml`)

Automates the update process:

- **Triggers on**:
  - Push to main branch when config files change
  - Pull requests that modify config files
  - Manual workflow dispatch

- **Actions**:
  - Checks if CLAUDE_SETUP.md is outdated
  - Comments on PRs if update needed
  - Creates automated PRs for updates on main branch

### 4. Pre-commit Hook (`.husky/pre-commit`)

Prevents committing outdated documentation:

- Detects changes to configuration files
- Prompts to update CLAUDE_SETUP.md
- Optionally runs the generator automatically

## How to Update the Setup Process

### 1. Modify Configuration

Edit `docs/setup-config.json` to change:

- Environment variables
- Setup steps
- Error messages
- Progress indicators

Example: Adding a new environment variable:

```json
{
  "name": "NEW_API_KEY",
  "description": "API key for new service",
  "validation": "^[A-Za-z0-9_-]{32}$",
  "optional": true,
  "setupUrl": "https://example.com/api-keys"
}
```

### 2. Generate Updated Documentation

```bash
# Generate the updated CLAUDE_SETUP.md
npm run docs:generate

# Verify the changes
git diff CLAUDE_SETUP.md

# Commit both files
git add docs/setup-config.json CLAUDE_SETUP.md
git commit -m "docs: update setup process with new API key"
```

### 3. Test the Changes

Before committing:

1. Review the generated markdown for formatting
2. Check that progress bars render correctly
3. Verify all links are valid
4. Test with Claude Code if possible

## NPM Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "docs:generate": "node scripts/generate-claude-setup.js",
    "docs:check": "node scripts/generate-claude-setup.js --check"
  }
}
```

## Validation and Testing

### Local Validation

```bash
# Check if documentation is up to date
npm run docs:check

# Generate and review changes
npm run docs:generate -- --verbose
```

### CI/CD Validation

The GitHub Action automatically:

1. Validates on every PR
2. Blocks merge if outdated
3. Creates fix PRs when needed

## Common Maintenance Tasks

### Adding a New Migration

1. Create the migration file in `migrations/`
2. Add to `cloudflare_resources.d1_database.migrations` in setup-config.json
3. Run `npm run docs:generate`
4. Commit all changes together

### Updating Environment Variables

1. Update `.dev.vars.example`
2. Add/modify in `environment_variables` section of setup-config.json
3. Include validation regex if applicable
4. Run `npm run docs:generate`

### Changing Setup Steps

1. Locate the relevant phase in `setup_phases`
2. Add/modify/remove steps as needed
3. Update progress indicators if applicable
4. Run `npm run docs:generate`

### Updating Error Messages

1. Find or add entry in `error_handling.common_errors`
2. Update pattern and solutions
3. Run `npm run docs:generate`

## Troubleshooting

### "CLAUDE_SETUP.md is outdated" in CI

**Cause**: Configuration changed but documentation wasn't regenerated

**Fix**:

```bash
npm run docs:generate
git add CLAUDE_SETUP.md
git commit -m "docs: update CLAUDE_SETUP.md"
git push
```

### Checksum Mismatch

**Cause**: Manual edits to CLAUDE_SETUP.md

**Fix**: Always edit setup-config.json instead, then regenerate

### Generator Script Fails

**Common issues**:

- Invalid JSON in setup-config.json
- Missing required fields
- File permissions

**Debug**:

```bash
node scripts/generate-claude-setup.js --verbose
```

## Best Practices

### 1. Atomic Commits

Always commit configuration and generated files together:

```bash
git add docs/setup-config.json CLAUDE_SETUP.md
git commit -m "docs: update setup process"
```

### 2. Descriptive Changes

When updating setup-config.json:

- Add comments for complex configurations
- Use clear, descriptive names
- Include examples for validation patterns

### 3. Version Control

- Update `metadata.version` for major changes
- Keep `metadata.lastUpdated` current
- Document breaking changes in commit messages

### 4. Testing

Before pushing:

- Run `npm run docs:check`
- Review generated markdown
- Test with a fresh clone if possible

## Advanced Configuration

### Custom Progress Indicators

Modify `implementation_notes.progress_indicators`:

```json
{
  "style": "bar",
  "width": 40,
  "completeChar": "▓",
  "incompleteChar": "░"
}
```

### Conditional Steps

Use conditions for optional features:

```json
{
  "name": "Configure Feature X",
  "condition": "FEATURE_X_ENABLED === 'true'",
  "optional": true
}
```

### Multi-language Support

While the generator currently produces English output, the structure supports internationalization:

```json
{
  "name": "step_name",
  "description_key": "setup.step.description",
  "i18n": {
    "en": "English description",
    "ru": "Русское описание"
  }
}
```

## Future Enhancements

Potential improvements to the system:

1. **Schema Validation**: Add JSON Schema for setup-config.json
2. **Interactive Mode**: CLI prompts for configuration updates
3. **Diff Viewer**: Show what changed between versions
4. **Template System**: Support multiple output formats
5. **Localization**: Multi-language documentation generation

## Conclusion

This automated system ensures CLAUDE_SETUP.md always reflects the actual setup process. By maintaining a single source of truth in setup-config.json, we eliminate documentation drift and provide consistent, accurate instructions for Claude Code users.

Remember: **Never edit CLAUDE_SETUP.md directly**. Always update setup-config.json and regenerate.
