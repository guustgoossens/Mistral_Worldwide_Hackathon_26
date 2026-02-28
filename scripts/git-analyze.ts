/**
 * Git history analysis → data/output/git-data.json
 *
 * Usage: bun run git-analyze -- /path/to/repo
 *
 * TODO: Implement:
 * 1. Use simple-git to read commit history
 * 2. Extract per-file contributor stats (commits, lines changed, last touch)
 * 3. Build contributor map: { [email]: { name, files: { [path]: stats } } }
 * 4. Write to data/output/git-data.json
 */

const repoPath = process.argv[2];

if (!repoPath) {
  console.error("Usage: bun run git-analyze -- /path/to/repo");
  process.exit(1);
}

console.log(`[git-analyze] Would analyze: ${repoPath}`);
console.log("[git-analyze] Not yet implemented");
