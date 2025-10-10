# Commands Monorepo

This repository contains the source code for the `devcommands` suite of tools.

## Packages

- `packages/server`: The server command.
- `packages/linear`: The linear command.

## Development

1.  Make your code changes in the respective package directory.
2.  When your changes are complete, run `pnpm changeset add`.
3.  This command will ask you which packages to include in the release and whether the change is a `major`, `minor`, or `patch`.
4.  Follow the prompts and commit the generated markdown file in the `.changeset` directory.

## Releasing Packages

This repository uses [Changesets](https://github.com/changesets/changesets) to manage releases.

1.  **Create a Changeset:** For any pull request that should result in a new version, run `pnpm changeset add` and commit the resulting file. This describes the change.
2.  **Merge to Main:** When PRs with changesets are merged into the `main` branch, the `Release to NPM` GitHub Action is triggered.
3.  **Automated Release:** The action will: a. Create a "Version Packages" pull request that contains all the version bumps and `CHANGELOG.md` updates. b. When you merge this special PR, the action proceeds to publish the updated packages to npm and tag the release in Git.
3.  **Automated Tagging:** The action will:
    a.  Create a "Version Packages" pull request that contains all the version bumps and `CHANGELOG.md` updates.
    b.  When you merge this special PR, the action proceeds to tag the release in Git.
4.  **Homebrew Tap Update:** The new release tags (e.g., `server@1.0.2`) will automatically trigger the `Update Homebrew Tap` workflow, which updates the formula in the `homebrew-devcommands` repository.
