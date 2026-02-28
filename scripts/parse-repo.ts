/**
 * Tree-sitter repo parsing → data/output/graph.json
 *
 * Usage: bun run parse -- /path/to/repo
 *
 * TODO: Implement:
 * 1. Walk repo files (filter by language: .ts, .tsx, .js, .py)
 * 2. Init web-tree-sitter with appropriate grammar
 * 3. Parse each file → extract functions, classes, imports, calls
 * 4. Build graph JSON: { nodes: [...], edges: [...] }
 * 5. Write to data/output/graph.json
 */

const repoPath = process.argv[2];

if (!repoPath) {
  console.error("Usage: bun run parse -- /path/to/repo");
  process.exit(1);
}

console.log(`[parse-repo] Would parse: ${repoPath}`);
console.log("[parse-repo] Not yet implemented");
