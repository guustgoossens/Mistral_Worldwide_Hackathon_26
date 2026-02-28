/**
 * Tree-sitter AST → KuzuDB inserts.
 *
 * Parses source files using web-tree-sitter, extracts code structure
 * (files, functions, classes, method calls), and inserts nodes/edges
 * into KuzuDB.
 *
 * TODO: Implement multi-pass parsing pipeline:
 * 1. File discovery → File nodes
 * 2. AST parsing → Function/Class nodes + CONTAINS edges
 * 3. Call resolution → CALLS edges
 * 4. Import resolution → IMPORTS edges
 */

export async function buildGraphFromAST(_repoPath: string): Promise<void> {
  // TODO: Implement tree-sitter parsing pipeline
  console.log("[graph-builder] Not yet implemented");
}
