# @devcommands/utils

A collection of small utility commands for day-to-day system tasks.

## Install

```bash
dev package install utils
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

## Requirements

- `stay-awake` is macOS-only (requires `caffeinate`).
- `port` requires `lsof` (pre-installed on macOS and most Linux distros).
