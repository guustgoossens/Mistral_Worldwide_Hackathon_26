# Commands

All commands use `bun run`:

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server on localhost:5173 |
| `bun run dev:server` | Start Express proxy on localhost:3001 |
| `bun run dev:all` | Run both dev + dev:server in parallel |
| `bun run build` | TypeScript check + Vite production build |
| `bun run preview` | Preview the production build |
| `bun run lint` | Run TypeScript compiler + ESLint |
| `bun run format` | Format all files with Prettier |
| `bun run parse -- /path/to/repo` | Parse a repo with Tree-sitter → graph.json |
| `bun run git-analyze -- /path/to/repo` | Analyze git history → git-data.json |

## Development workflow

```bash
# Terminal 1: Full dev environment
bun run dev:all

# Terminal 2 (optional): Parse a target repo
bun run parse -- ../some-project
bun run git-analyze -- ../some-project
```

## Build & deploy

```bash
bun run build    # outputs to dist/
bun run preview  # serves dist/ locally
```
