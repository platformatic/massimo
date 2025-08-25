# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Massimo is an API SDK client and CLI tool for creating clients for remote OpenAPI or GraphQL APIs. This is a pnpm workspace monorepo with 2 packages.

## Essential Commands

```bash
# Setup and installation
pnpm install
pnpm run global-links  # Link CLI tools globally for development

# Development workflow
pnpm test              # Run all tests (uses Docker for databases)
pnpm run build         # Build all packages
pnpm run lint          # Lint all packages
pnpm run gen-schema    # Generate JSON schemas
pnpm run gen-types     # Generate TypeScript types

# Cleanup
pnpm clean             # Clean node_modules in all packages
pnpm cleanall          # Clean everything including lockfile

# Testing individual packages
cd packages/<package-name>
npm test               # Run tests for specific package

# Version management
./scripts/sync-version.sh  # Sync versions across all packages
```

## Architecture

### Core Components (packages/)
- **massimo**: Client library for creating clients for remote OpenAPI or GraphQL APIs
- **massimo-cli**: CLI tool for generating client code (`plt-massimo` command)

### Client Generation Capabilities
- **OpenAPI**: Generate TypeScript clients from OpenAPI specifications
- **GraphQL**: Generate TypeScript clients from GraphQL schemas
- **Frontend Integration**: Support for various frontend frameworks
- **Authentication**: Support for headers and authentication configuration

## Development Guidelines

### Workspace Dependencies
Use `workspace:*` for internal package dependencies. All packages share the same version (currently 0.0.1).

### Testing
- Tests require Docker for database setup
- Test script automatically selects appropriate Docker Compose file based on OS
- Tests run with concurrency=1 and extended timeouts (300000ms)
- Pre-commit hooks enforce linting

### Configuration
- JSON Schema validation for all configuration files
- Supports JSON, YAML, and TOML config formats
- Uses neostandard ESLint configuration

### API Support
Supports any backend that exposes OpenAPI or GraphQL schemas. The client generator is backend-agnostic with automatic client code generation for TypeScript and JavaScript.

## Package Structure Patterns
- Each package has its own `package.json` with consistent scripts
- TypeScript definitions are auto-generated
- Generated clients follow consistent patterns for different API types (OpenAPI/GraphQL)
- Client generation follows OpenAPI and GraphQL specification standards

## Git Commit Guidelines

All commits must include a DCO (Developer Certificate of Origin) sign-off. Always use `git commit -s` to automatically add the human's sign-off, and manually include Claude's sign-off.

When creating commits, the commit message should include:
- `Co-Authored-By: Claude <noreply@anthropic.com>`
- `Signed-off-by: Claude <noreply@anthropic.com>`

The `-s` flag will automatically add the human's `Signed-off-by` line, ensuring both contributors are properly signed off for DCO compliance.