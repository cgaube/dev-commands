# @devcommands/git

Git-related dev commands with interactive prompts and AI-assisted commits.

## Install

```bash
dev package install git
```

## Usage

```bash
git <subcommand> [options]
```

## Commands

### `checkout` (alias: `switch`)

Interactively pick a branch and check it out.

### `cleanup`

Multi-select local branches and delete them in one pass.

### `commit`

Generate a commit message with AI from the staged diff, then commit.

### `pr`

Check out the branch of a GitHub pull request.

## Requirements

- `pr` requires the [`gh`](https://cli.github.com/) CLI to be installed and
  authenticated.
- `commit` requires an AI provider CLI (defaults to `claude`).
