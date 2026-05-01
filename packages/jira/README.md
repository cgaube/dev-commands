# @devcommands/jira

Jira-related dev commands for bridging Jira issues into your git workflow.

## Install

```bash
dev packages install jira
```

## Usage

```bash
jira <subcommand> [options]
```

## Commands

### `list` (alias: `me`)

List your assigned Jira issues without creating a branch.

Options:

- `--project <projects...>` — project keys or names to filter issues by
- `--label <labels...>` — labels to filter issues by
- `--state <states...>` — statuses to filter issues by (default:
  `"In Progress"`)

### `start` (alias: `branch`)

Pick one of your assigned Jira issues and create/checkout a git branch named
after it.

Options:

- `--project <projects...>` — project keys or names to filter issues by
- `--label <labels...>` — labels to filter issues by
- `--state <states...>` — statuses to filter issues by (default:
  `"In Progress"`)

## Requirements

A Jira host, account email, and API token must be configured. The API token can
be created at
[id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).

```bash
jira config
```
