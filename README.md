# Commands Monorepo

Source code for the `devcommands` suite — a collection of small CLI tools for
day-to-day development tasks.

## How it fits together

These commands aren't used directly from this repo. They're consumed through two
companion projects:

- **[cgaube/dev-cli](https://github.com/cgaube/dev-cli)** — the `dev` root
  binary that dispatches to each package (e.g. `dev git commit`,
  `dev linear start`).
- **[cgaube/homebrew-devcommands](https://github.com/cgaube/homebrew-devcommands)**
  — the Homebrew tap used to install/update the individual packages.

Typical install flow:

```bash
brew tap cgaube/devcommands
brew install devcommand-packages
dev packages install git linear utils
```

## Packages

Each package lives in [`packages/`](./packages) and ships its own binary. See
each package's README for commands and options.

- [`@devcommands/git`](./packages/git) — git workflow helpers (interactive
  checkout, cleanup, AI commits, PR checkout)
- [`@devcommands/linear`](./packages/linear) — create git branches from Linear
  issues
- [`@devcommands/packages`](./packages/packages) — install, update, and scaffold
  devcommands packages
- [`@devcommands/run`](./packages/run) — run project scripts from any package
  manager (bun/pnpm/yarn/npm, make, just, task) with auto-detection
- [`@devcommands/utils`](./packages/utils) — misc utilities (`stay-awake`,
  `port`)

## Using packages standalone

The `dev` wrapper and Homebrew tap are the easy path, but they're not required.
Each package is compiled into a single self-contained executable with
`bun build --compile`, so you can grab any package and use it on its own:

```bash
cd packages/git
bun install
bun run compile     # produces ./bin/git
./bin/git checkout  # run directly, or copy the binary into your $PATH
```

The resulting binary has no runtime dependency on Bun, Node, or the rest of this
repo — move it anywhere and it will work.

## Development

Bun workspaces monorepo. Shared utilities live in [`common/`](./common).

```bash
bun install
bun run --filter '*' compile   # build all package binaries
```

Each package follows the same structure (`packages/<name>/src/main.ts`) and
shares a common set of dependencies — see [AGENTS.md](./AGENTS.md) for the
conventions.
