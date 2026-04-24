# @devcommands/packages

Manage the installation and updates of devcommands packages via the Homebrew
tap.

## Install

```bash
brew install cgaube/devcommands/devcommand-packages
```

## Usage

```bash
packages <subcommand> [options]
```

## Commands

### `install` (alias: `add`)

Install a devcommands package from the Homebrew tap.

### `uninstall` (alias: `remove`)

Uninstall a previously installed devcommands package.

### `list` (alias: `ls`)

List all available packages with their install status.

### `create` (alias: `generate`)

Scaffold a new devcommands package from the template.

### `update` (alias: `upgrade`)

Update all installed packages, or a specific one by name.
