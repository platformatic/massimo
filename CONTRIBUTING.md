# Contributing to Massimo

Welcome to the Massimo development guide! This document will help you set up your development environment and contribute to the project.

## Project Overview

Massimo is an API SDK client and CLI tool for creating clients for remote OpenAPI or GraphQL APIs. This is a pnpm workspace monorepo with 2 packages.

## Prerequisites

- **Node.js**: Version 22.18 or higher
- **pnpm**: Package manager (follow the [pnpm installation guide](https://pnpm.io/installation))
- **Docker** (optional): Only required for running integration tests ([Docker Desktop](https://www.docker.com/products/docker-desktop) or [Colima](https://github.com/abiosoft/colima))

## Getting Started

### 1. Clone and Setup

```bash
git clone https://github.com/platformatic/massimo.git
cd massimo
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Link CLI Tools Globally

To use the `massimo` command globally during development:

```bash
pnpm run global-links
```

Verify the setup:

```bash
massimo --version
```

### 4. Setup Docker Environment (Optional)

This step is only required if you plan to run integration tests. Choose the appropriate Docker Compose file for your system:

**Intel Macs:**

```bash
docker compose -f docker-compose-mac.yml up -d
```

**Apple Silicon Macs:**

```bash
docker compose -f docker-compose-apple-silicon.yml up -d
```

**Windows/Linux:**

```bash
docker compose up -d
```

## Development Workflow

### Essential Commands

```bash
# Development workflow
pnpm test              # Run all tests (uses Docker for databases)
pnpm run build         # Build all packages
pnpm run lint          # Lint all packages
pnpm run gen-schema    # Generate JSON schemas
pnpm run gen-types     # Generate TypeScript types

# Cleanup commands
pnpm clean             # Clean node_modules in all packages
pnpm cleanall          # Clean everything including lockfile

# Testing individual packages
cd packages/<package-name>
npm test               # Run tests for specific package

# Version management
./scripts/sync-version.sh  # Sync versions across all packages
```

### Testing

Tests may require Docker for some integration scenarios. The test script automatically selects the appropriate Docker Compose file based on your OS.

```bash
pnpm test
```

**Test Configuration:**

- Tests run with concurrency=1 and extended timeouts (300000ms)
- Pre-commit hooks enforce linting
- All tests must pass before opening a pull request

**Troubleshooting Tests:**

If tests fail without code changes:

1. Clean the environment:

```bash
pnpm cleanall
```

2. Clear pnpm store and reinstall:

```bash
pnpm store path
rm -rf /path/from/previous/command
pnpm install
```

### Working with Individual Packages

To work on a specific package:

```bash
cd packages/<package-name>
npm test                    # Run package tests
npm run build              # Build package
```

## Architecture Overview

### Core Components (packages/)

- **massimo**: Client library for creating clients for remote OpenAPI or GraphQL APIs
- **massimo-cli**: CLI tool for generating client code (`massimo` command)

### Client Generation Capabilities

- **OpenAPI**: Generate TypeScript clients from OpenAPI specifications
- **GraphQL**: Generate TypeScript clients from GraphQL schemas
- **Frontend Integration**: Support for various frontend frameworks
- **Authentication**: Support for headers and authentication configuration

## Development Guidelines

### Workspace Dependencies

- Use `workspace:*` for internal package dependencies
- All packages share the same version
- Dependencies are replaced by precise versions during publish by pnpm

### Configuration

- JSON Schema validation for all configuration files
- Supports JSON, YAML, and TOML config formats
- Uses neostandard ESLint configuration

### API Support

Supports any backend that exposes OpenAPI or GraphQL schemas. The client generator is backend-agnostic with automatic client code generation for TypeScript and JavaScript.

### Package Structure Patterns

- Each package has its own `package.json` with consistent scripts
- TypeScript definitions are auto-generated
- Generated clients follow consistent patterns for different API types (OpenAPI/GraphQL)
- Client generation follows OpenAPI and GraphQL specification standards

## Testing Your Local Changes

To test your local changes with client generation:

1. Ensure CLI tools are linked globally:

```bash
pnpm run global-links
```

2. Create a test directory:

```bash
mkdir test-client
cd test-client
```

3. Generate a client from a remote API:

```bash
massimo http://example.com/openapi.json --name testclient
```

4. Test the generated client in your application.

## Documentation

### Writing Guides

When creating documentation guides, follow this structured approach:

1. **Introduction**: Explain the "why" and "what" - what problem does this solve and what will be accomplished
2. **Setup Instructions**: Detailed setup steps with prerequisites and environment preparation
3. **Implementation Steps**: Step-by-step instructions for the demo/tutorial (numbered 3...X)
4. **Conclusion**: Clear summary of what was accomplished and next steps

**Additional Requirements:**

- Include architecture diagrams to illustrate the solution
- Focus on client generation examples and API integration patterns
- Prefer using existing project demos and real-world examples over creating artificial examples
- Test all code examples and commands before publishing
- Create a short video demonstration for each guide to complement the written instructions

### Building Documentation Locally

The documentation is built using [Docusaurus 3](https://docusaurus.io/) and requires both the main Massimo repository and the separate [docs repository](https://github.com/platformatic/docs).

**Setup:**

1. Create a working directory and clone both repositories:

```bash
mkdir /workdir && cd /workdir
git clone https://github.com/platformatic/massimo.git
git clone https://github.com/platformatic/docs.git
```

2. Install dependencies in both repositories:

```bash
cd massimo && npm install && cd ..
cd docs && npm install
```

3. Set up the environment and start the development server:

```bash
export DOCS=`realpath $PWD/../massimo/docs`
npm run sync-and-start
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `pnpm test`
2. Run linting: `pnpm run lint`
3. Build all packages: `pnpm run build`

### Creating a Pull Request

1. If your PR fixes a GitHub issue, add this at the top of the PR description:

```
fixes #<issue-number>
```

2. Ensure all checks pass and get approval
3. Merge using "squash and merge" option

## Release Process

Massimo packages share the same release number and are released together.

1. Update version in root `package.json`
2. Sync versions across packages:

```bash
./scripts/sync-version.sh
```

3. Publish the release:

```bash
pnpm -r publish --access=public
```

## Troubleshooting

### SQLite Module CPU Architecture Issues

If you encounter SQLite-related errors:

1. Ensure pnpm was not installed with volta
2. Clean and reinstall:

```bash
rm -rf ./node_modules
pnpm store prune
pnpm store path
rm -rf /path/from/the/above/command
pnpm install
```

### "env: node: No such file or directory"

1. Check pnpm installation: `which pnpm`
2. Ensure correct Node.js version is active
3. Reinstall pnpm: `npm install -g pnpm`

## Navigation Tools

Generate a `tags` file for code navigation:

```bash
ctags --exclude=node_modules --exclude='**/*.test.js' --exclude='**/build' -R *
```

## Developer Certificate of Origin

All contributions must include a Developer Certificate of Origin (DCO) sign-off. Use the `-s` flag when committing:

```bash
git commit -s -m "Your commit message"
```

This automatically adds your `Signed-off-by` line to the commit message. If working with AI assistance, ensure both contributors are signed off.

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
1 Letterman Drive
Suite D4700
San Francisco, CA, 94129

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

If you want to know how to retroactively add the DCO to your commits,
check out [this guide](https://github.com/src-d/guide/blob/master/developer-community/fix-DCO.md).

## Getting Help

- Check the [documentation](https://docs.platformatic.dev/reference/client/)
- Join our [Discord community](https://discord.gg/platformatic) for real-time help and discussions
- Open an issue on GitHub

Thank you for contributing to Massimo! 🚀
