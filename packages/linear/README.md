# @devcommands/linear

Linear-related dev commands for bridging Linear issues into your git workflow.

## Install

```bash
dev package install linear
```

## Usage

```bash
linear <subcommand> [options]
```

## Commands

### `start` (alias: `branch`)

Pick one of your assigned Linear issues and create/checkout a git branch named
after it.

Options:

- `--team <teams...>` — override teams to filter issues by
- `--label <labels...>` — override labels to filter issues by
- `--state <states...>` — override statuses to filter issues by (default:
  `"In Progress"`)

## Requirements

A Linear API key must be configured. Use the built-in config commands:

```bash
linear config
```
