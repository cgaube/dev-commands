# @devcommands/utils

A collection of small utility commands for day-to-day system tasks.

## Install

```bash
dev packages install utils
```

## Usage

```bash
utils <subcommand> [options]
```

## Commands

### `stay-awake`

Prevent the system from sleeping for a specified duration (uses macOS
`caffeinate`), with an optional animated orb.

Options:

- `-t, --time <seconds>` — duration in seconds (default: `2628000`)
- `--animation-style <style>` — orb animation style (default: random)
- `--animation-timeout <seconds>` — freeze the last frame after N seconds; `0`
  disables (default: `60`)
- `--no-animation` — disable the animated orb

### `port <port>`

List the processes listening on a given TCP port (uses `lsof`).

### `brew [formula]`

Show what you installed with Homebrew and what it pulled in. Without an
argument, it lists every formula you installed on request, your casks, and the
orphans (dependencies that nothing needs anymore).

Each formula row shows:

- `FREES` — disk space freed by uninstalling it, including dependencies that
  only it needs. Shows `—` when another formula you installed needs it.
- `OWN` — dependencies only this formula needs.
- `SHARED` — dependencies other installed formulae also need.
- `UPDATED` — time since the last install or upgrade.
- flags: `outdated`, `pinned`, third-party tap, and `needed by …`.

With a formula name, it shows that formula's dependency tree. Shared
dependencies are dimmed and list the other formulae that use them. A `↑` marks a
subtree already shown above.

Options:

- `-s, --sort <key>` — `size` (default), `name` or `updated`
- `--no-casks` — hide casks
- `--json` — print machine-readable JSON

## Requirements

- `stay-awake` is macOS-only (requires `caffeinate`).
- `brew` requires Homebrew.
- `port` requires `lsof` (pre-installed on macOS and most Linux distros).
