/**
 * Load git contributor data into KuzuDB.
 *
 * Reads pre-analyzed git data (from scripts/git-analyze.ts output)
 * and creates Person nodes + CONTRIBUTED relationships in KuzuDB.
 *
 * TODO: Implement:
 * 1. Load data/output/git-data.json
 * 2. Create Person nodes for each contributor
 * 3. Create CONTRIBUTED edges from Person → File with commit stats
 */

export async function loadGitData(_dataPath: string): Promise<void> {
  // TODO: Implement git data loading
  console.log("[git-data] Not yet implemented");
}
