# @devcommands/run

Run project scripts from any package manager. Auto-detects the right tool and
forwards arguments through to it.

## Install

```bash
dev packages install run
```

## Usage

```bash
run [name] [-- script-args...] [options]
```

Without arguments, `run` discovers all scripts in the current directory and
opens an interactive picker. With a name, it runs the matching script directly.

## Examples

```bash
# Interactive picker
run

# Run a script by name (auto-detects the package manager)
run build

# Forward args through to the underlying tool
run test --watch --bail

# Disambiguate when multiple sources define the same name
run bun:build
run --source make build

# List all discovered scripts
run --list
run --list --source just
run --list --json
```

## Supported sources

| Source                          | Detected via                             |
| ------------------------------- | ---------------------------------------- |
| `bun` / `pnpm` / `yarn` / `npm` | `package.json` + lockfile (via `nypm`)   |
| `make`                          | `Makefile`                               |
| `just`                          | `justfile` (requires `just` on PATH)     |
| `task`                          | `Taskfile.yml` (requires `task` on PATH) |

For `just` and `task`, recipes are read from the tool's own JSON output
(`just --dump --dump-format json`, `task --list-all --json`) — so attributes,
parameters, doc comments, includes, and private/hidden recipes are all handled
correctly.

## Options

- `-l, --list` — list discovered scripts instead of running one.
- `--source <id>` — limit to a specific source (`bun`, `pnpm`, `yarn`, `npm`,
  `make`, `just`, `task`).
- `--json` — JSON output (with `--list`).

## Notes

- Discovery walks up from the current directory and stops at `$HOME` or the
  filesystem root.
