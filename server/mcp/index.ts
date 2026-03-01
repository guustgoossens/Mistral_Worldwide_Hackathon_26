#!/usr/bin/env node
/**
 * HackStral KuzuDB MCP Server
 *
 * Exposes the codebase graph via MCP tools for Claude Code, Cursor, etc.
 * Uses stdio transport.
 *
 * Usage:
 *   bun run server/mcp/index.ts -- public/data/hackstral
 *   # or via npm script:
 *   bun run mcp -- public/data/hackstral
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "path";
import { initKuzuServer } from "./kuzu-server.js";
import { registerTools } from "./tools.js";

async function main() {
  // Parse data directory from args
  const args = process.argv.slice(2);
  // Skip past "--" if present
  const dashIdx = args.indexOf("--");
  const effectiveArgs = dashIdx >= 0 ? args.slice(dashIdx + 1) : args;
  const dataDir = effectiveArgs[0] ?? "public/data/hackstral";
  const resolvedDir = path.resolve(dataDir);

  console.error(`[mcp] Starting HackStral MCP Server`);
  console.error(`[mcp] Data directory: ${resolvedDir}`);

  // Initialize KuzuDB with data
  const { conn, repoId } = await initKuzuServer(resolvedDir);

  // Create MCP server
  const server = new McpServer({
    name: "hackstral-graph",
    version: "1.0.0",
  });

  // Register tools
  registerTools(server, conn);

  console.error(`[mcp] Tools registered for repo: ${repoId}`);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[mcp] Server running on stdio`);
}

main().catch((err) => {
  console.error("[mcp] Fatal error:", err);
  process.exit(1);
});
