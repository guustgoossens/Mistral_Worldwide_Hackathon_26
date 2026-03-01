#!/usr/bin/env node
/**
 * Metadata Enricher — populates L0 summaries + L1 relationship summaries.
 *
 * Usage:
 *   bun run server/enricher/index.ts -- public/data/hackstral
 *   # or via npm script:
 *   bun run enrich -- public/data/hackstral
 */

import path from "path";
import { initKuzuServer, queryRows } from "../mcp/kuzu-server.js";
import { enrichNodeSummaries } from "./node-summaries.js";
import { enrichRelationshipL1 } from "./relationship-l1.js";
import type kuzu from "kuzu";

interface MistralConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export async function enrichRepo(
  conn: kuzu.Connection,
  config: MistralConfig,
): Promise<{ nodeSummaries: number; relationshipL1: number }> {
  console.error(`[enricher] Starting enrichment with model: ${config.model}`);

  const nodeSummaries = await enrichNodeSummaries(conn, config);
  const relationshipL1 = await enrichRelationshipL1(conn, config);

  console.error(`[enricher] Complete: ${nodeSummaries} node summaries, ${relationshipL1} L1 summaries`);
  return { nodeSummaries, relationshipL1 };
}

async function main() {
  const args = process.argv.slice(2);
  const dashIdx = args.indexOf("--");
  const effectiveArgs = dashIdx >= 0 ? args.slice(dashIdx + 1) : args;
  const dataDir = effectiveArgs[0] ?? "public/data/hackstral";
  const resolvedDir = path.resolve(dataDir);

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error("[enricher] MISTRAL_API_KEY not set");
    process.exit(1);
  }

  const config: MistralConfig = {
    apiKey,
    model: process.env.ENRICHER_MODEL ?? "devstral-small-2507",
    baseUrl: "https://api.mistral.ai",
  };

  console.error(`[enricher] Data directory: ${resolvedDir}`);
  const { conn } = await initKuzuServer(resolvedDir);

  const result = await enrichRepo(conn, config);

  // Verify
  const withSummary = await queryRows(conn, `MATCH (f:Function) WHERE f.summary <> '' RETURN count(f) AS cnt`);
  console.error(`[enricher] Verification: ${JSON.stringify(withSummary[0])} functions with summaries`);

  console.error(`[enricher] Done: ${JSON.stringify(result)}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("enricher/index.ts")) {
  main().catch((err) => {
    console.error("[enricher] Fatal:", err);
    process.exit(1);
  });
}
