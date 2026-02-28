# Tech Stack

## Frontend

| Technology | Version | Rationale |
|------------|---------|-----------|
| React | 19 | Component model, hooks, ecosystem |
| Vite | 6 | Fast HMR, ESM-native, WASM-friendly |
| Tailwind CSS | 4 | Utility-first, v4 with CSS-native config |
| TypeScript | 5.7+ | Type safety across the entire stack |

## Visualization

| Technology | Version | Rationale |
|------------|---------|-----------|
| react-force-graph-3d | 1.29 | Three.js-based 3D force-directed graph |
| Three.js | 0.183 | WebGL rendering (dependency of force-graph) |

## Graph Database

| Technology | Version | Rationale |
|------------|---------|-----------|
| KuzuDB WASM | 0.7 | In-browser graph DB with Cypher query language. No server needed. Supports complex relationship queries (CONTRIBUTED, UNDERSTANDS, etc.) |

## AI / Voice

| Technology | Version | Rationale |
|------------|---------|-----------|
| ElevenLabs React SDK | 0.14 | Conversational AI with client tool support, low-latency voice |
| Mistral AI API | — | LLM provider (hackathon sponsor). Models: devstral-small-2507 (voice), codestral (analysis), mistral-medium (quiz) |

## Code Analysis

| Technology | Version | Rationale |
|------------|---------|-----------|
| web-tree-sitter | 0.26 | WASM-based incremental parser, multi-language support |
| tree-sitter-wasms | 0.1 | Pre-built WASM grammars (TypeScript, JavaScript, Python) |
| simple-git | 3.32 | Git log parsing for contributor analysis |

## Server

| Technology | Version | Rationale |
|------------|---------|-----------|
| Express | 5 | Lightweight proxy for ElevenLabs → Mistral API forwarding |
| cors | 2.8 | CORS middleware for cross-origin requests |

## Dev Tools

| Technology | Version | Rationale |
|------------|---------|-----------|
| ESLint | 9 | Linting with flat config |
| Prettier | 3.5 | Code formatting |
| tsx | 4.19 | TypeScript execution for scripts and server |

## UI Utilities

| Technology | Version | Rationale |
|------------|---------|-----------|
| clsx | 2.1 | Conditional class names |
| tailwind-merge | 3.0 | Merge Tailwind classes without conflicts |
| lucide-react | 0.475 | Icon library |
