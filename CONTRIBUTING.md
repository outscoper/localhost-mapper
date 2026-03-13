# Contributing to Virtual Host Manager

First off, thank you for considering contributing to Virtual Host Manager! It's people like you that make this tool better for everyone.

This document provides guidelines and instructions for contributing to this project. Please read it carefully to ensure a smooth collaboration process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Pull Requests](#pull-requests)
- [Development Workflow](#development-workflow)
- [Style Guidelines](#style-guidelines)
  - [Git Commit Messages](#git-commit-messages)
  - [TypeScript Style Guide](#typescript-style-guide)
  - [Component Guidelines](#component-guidelines)
- [Testing](#testing)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- **Be respectful** — Treat everyone with respect. Healthy debate is encouraged, but harassment is not tolerated.
- **Be constructive** — Provide constructive feedback and be open to receiving it.
- **Be inclusive** — Welcome newcomers and help them learn.
- **Focus on what's best** — Prioritize the community and users of the project.

## Getting Started

### Prerequisites

- macOS 12 or later (for testing system integrations)
- Node.js 18+ and pnpm
- Git

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/zee-sandev/localhost-mapper.git
   cd localhost-mapper
   ```

3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/outscoper/localhost-mapper.git
   ```

4. **Install dependencies**:
   ```bash
   pnpm install
   ```

5. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

6. **Start the development server**:
   ```bash
   pnpm dev
   ```

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please:

1. **Check existing issues** to see if the bug has already been reported
2. **Try the latest version** to see if the bug has been fixed
3. **Gather information** about your environment

When submitting a bug report, please include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Screenshots** if applicable
- **System information**:
  - macOS version
  - App version
  - Node.js version
  - Apache/Nginx versions (if relevant)
- **Error messages** or console output

Use the [Bug Report template](https://github.com/outscoper/localhost-mapper/issues/new?template=bug_report.md) when creating issues.

### Suggesting Features

Feature suggestions are tracked as GitHub issues. When creating a feature request:

- **Use a clear, descriptive title**
- **Explain the use case** — What problem does it solve?
- **Describe the solution** you'd like to see
- **Consider alternatives** you've thought about
- **Add the `enhancement` label**

Use the [Feature Request template](https://github.com/outscoper/localhost-mapper/issues/new?template=feature_request.md) when creating issues.

### Pull Requests

1. **Update your fork** to the latest upstream:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes** following our style guidelines

4. **Run linting** to ensure code quality:
   ```bash
   pnpm lint
   ```

5. **Test your changes** thoroughly

6. **Commit your changes** with a descriptive message

7. **Push to your fork**:
   ```bash
   git push origin feature/amazing-feature
   ```

8. **Open a Pull Request** against the `main` branch

#### Pull Request Guidelines

- Fill in the [pull request template](.github/pull_request_template.md)
- Link any related issues using keywords (`Fixes #123`, `Closes #456`)
- Ensure all CI checks pass
- Be responsive to review feedback
- Keep changes focused — one feature per PR

## Development Workflow

### Branch Naming Convention

- `feature/description` — New features
- `bugfix/description` — Bug fixes
- `docs/description` — Documentation changes
- `refactor/description` — Code refactoring
- `chore/description` — Maintenance tasks

Example: `feature/add-ssl-certificate-management`

### Project Architecture

Understanding the architecture helps you make better contributions:

#### Electron Main Process (`electron/`)

- `main.ts` — Application entry point, window management, system integration
- `preload.ts` — Secure IPC bridge between main and renderer
- `types.ts` — Shared TypeScript interfaces

#### React Renderer (`src/`)

- **Components** — Reusable UI components
- **Hooks** — Custom React hooks for state management and side effects
- **Pages** — Top-level page components
- **Utils** — Helper functions and utilities
- **Types** — TypeScript type definitions

#### IPC Communication

All communication between the main process and renderer uses Electron's IPC:

```typescript
// In renderer (preload exposed API)
const result = await window.electronAPI.manageHosts('add', { hostname, ip });

// In main process
ipcMain.handle('manage-hosts', async (event, action, data) => {
  // Handle the operation
});
```

## Style Guidelines

### Git Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `style` — Code style (formatting, semicolons, etc.)
- `refactor` — Code refactoring
- `perf` — Performance improvements
- `test` — Adding or updating tests
- `chore` — Build process, dependencies, etc.

**Examples:**
```
feat(nginx): add support for custom server blocks

fix(hosts): resolve permission issue when editing /etc/hosts

docs(readme): update installation instructions

refactor(components): extract common button component
```

### TypeScript Style Guide

- **Use strict TypeScript** — Enable all strict flags
- **Explicit types** — Don't rely on implicit `any`
- **Interface over Type** — Use `interface` for object shapes, `type` for unions
- **Descriptive names** — Use clear, descriptive variable and function names
- **JSDoc comments** — Document public APIs and complex functions

```typescript
// Good
interface VirtualHost {
  serverName: string;
  documentRoot: string;
  port: number;
  enabled: boolean;
}

async function createVirtualHost(config: VirtualHost): Promise<Result> {
  // Implementation
}

// Avoid
function createHost(data: any): any {
  // Implementation
}
```

### Component Guidelines

We use functional components with hooks:

```typescript
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Props {
  title: string;
  onAction: () => void;
}

export const MyComponent: React.FC<Props> = ({ title, onAction }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = useCallback(() => {
    setIsOpen(prev => !prev);
    onAction();
  }, [onAction]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-panel"
    >
      <h2>{title}</h2>
      <button onClick={handleClick}>Toggle</button>
    </motion.div>
  );
};
```

**Guidelines:**
- Use `React.FC<Props>` for component types
- Prefer `useCallback` for event handlers passed to children
- Use Framer Motion for animations
- Follow the glassmorphism design system
- Keep components focused and composable

### CSS/Tailwind Guidelines

- Use Tailwind utility classes primarily
- Custom CSS should go in `src/styles/` with clear naming
- Follow the existing glassmorphism aesthetic
- Support dark mode considerations (even if not fully implemented)

```css
/* Good - descriptive, scoped */
.glass-panel {
  @apply backdrop-blur-md bg-white/10 border border-white/20 rounded-xl;
}

/* Avoid - overly specific, hard to maintain */
div.container > div.header > button.primary-btn { }
```

## Testing

Currently, the project doesn't have automated tests. We're looking for contributors to help establish:

- Unit tests for utility functions
- Integration tests for IPC handlers
- E2E tests for critical user flows

If you're interested in setting up the testing infrastructure, please open an issue to discuss the approach.

### Manual Testing Checklist

Before submitting a PR, please test:

- [ ] App launches without errors
- [ ] Hosts file operations work correctly
- [ ] Apache virtual host creation/editing/deletion
- [ ] Nginx virtual host creation/editing/deletion
- [ ] System status panel shows correct information
- [ ] All animations play smoothly
- [ ] No console errors in development mode
- [ ] Production build works correctly

## Community

### Getting Help

- **GitHub Discussions** — For questions and general discussion
- **GitHub Issues** — For bug reports and feature requests
- **Discord** (coming soon) — For real-time chat

### Recognition

Contributors will be recognized in our README and release notes. Thank you for helping make Virtual Host Manager better!

## Questions?

If you have questions that aren't answered here:

1. Check existing [GitHub Discussions](https://github.com/outscoper/localhost-mapper/discussions)
2. Open a new discussion with your question
3. Or reach out to the maintainers

---

Thank you for contributing! 🚀
