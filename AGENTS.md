This project is a monorepo for CLI tools, managed with **Bun workspaces**.

All CLI applications are located in the `packages` folder. They share common
dependencies to ensure consistent execution, functionality, and a unified user
experience across all tools:

- `@clack/prompt` – for user interaction and displaying messages
- `colorize-template` and `picocolors` – for styling and color formatting
- `execa` – for executing commands
- `commander` – for parsing and managing main commands and subcommands

Shared utility methods are available in the `common` folder.

These CLI applications are designed to be invoked through a **root binary**
called `dev-cli`, for example:

```bash
dev package [...subcommand]
```

Each individual application should follow this structure to ensure seamless
integration and consistent behavior across the entire toolset.
