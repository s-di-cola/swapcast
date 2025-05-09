# Git Hooks for SwapCast

This directory contains Git hooks that can be used to enforce code quality standards in the SwapCast project.

## Available Hooks

### pre-commit

The pre-commit hook automatically runs `forge fmt` on all staged Solidity files before each commit, ensuring consistent code formatting across the codebase.

## Installation

To use these hooks, you need to configure Git to use this directory for hooks:

```bash
git config core.hooksPath .githooks
```

Or you can manually copy the hooks to your `.git/hooks` directory:

```bash
cp .githooks/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit
```

## Bypassing Hooks

If you need to bypass a hook for a specific commit, you can use:

```bash
git commit --no-verify
```

However, this should be used sparingly, as the hooks are designed to maintain code quality.
