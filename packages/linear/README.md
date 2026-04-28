# @devcommands/linear

Linear-related dev commands for bridging Linear issues into your git workflow.

## Install

```bash
dev packages install linear
```

## Usage

```bash
linear <subcommand> [options]
```

## Commands

### `list` (alias: `me`)

List your assigned Linear issues without creating a branch.

Options:

- `--team <teams...>` — override team keys or names to filter issues by
- `--label <labels...>` — override labels to filter issues by
- `--state <states...>` — override statuses to filter issues by (default:
  `"In Progress"`)

### `start` (alias: `branch`)

Pick one of your assigned Linear issues and create/checkout a git branch named
after it.

Options:

- `--team <teams...>` — override team keys or names to filter issues by
- `--label <labels...>` — override labels to filter issues by
- `--state <states...>` — override statuses to filter issues by (default:
  `"In Progress"`)

## Requirements

A Linear API key must be configured. Use the built-in config commands:

```bash
linear config
```
