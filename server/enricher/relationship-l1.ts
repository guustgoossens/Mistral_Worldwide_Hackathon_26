/**
 * L1 enrichment: Generate CONTRIBUTED.summary_l1 for person-file relationships.
 */

import type kuzu from "kuzu";
import { queryRows } from "../mcp/kuzu-server.js";
import { CONTRIBUTION_L1_SYSTEM, contributionL1Prompt } from "./prompts.js";

function esc(s: string): string {
  return s.replace(/'/g, "\\'");
}

interface MistralConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

async function callMistral(
  config: MistralConfig,
  system: string,
  user: string,
): Promise<string> {
  const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 100,
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Mistral API error: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function enrichRelationshipL1(
  conn: kuzu.Connection,
  config: MistralConfig,
): Promise<number> {
  let enriched = 0;

  // Get CONTRIBUTED edges missing summary_l1
  type Row = Record<string, unknown>;
  const edges = await queryRows(
    conn,
    `MATCH (p:Person)-[c:CONTRIBUTED]->(f:File) WHERE c.summary_l1 = '' OR c.summary_l1 IS NULL RETURN p.id AS pid, p.name AS pname, f.id AS fid, f.name AS fname, c.commits AS commits, c.linesChanged AS linesChanged, c.lastTouch AS lastTouch, c.ownershipPct AS ownershipPct`,
  ) as Row[];

  console.error(`[enricher] ${edges.length} CONTRIBUTED edges need L1 summaries`);

  for (let i = 0; i < edges.length; i += 5) {
    const batch = edges.slice(i, i + 5);

    for (const row of batch) {
      const pid = String(row["pid"]);
      const pname = String(row["pname"]);
      const fid = String(row["fid"]);
      const fname = String(row["fname"]);
      const commits = Number(row["commits"]) || 0;
      const linesChanged = Number(row["linesChanged"]) || 0;
      const lastTouch = String(row["lastTouch"] ?? "unknown");
      const ownershipPct = Number(row["ownershipPct"]) || 0;

      const prompt = contributionL1Prompt({
        name: pname,
        commits,
        linesChanged,
        lastTouch,
        ownershipPct,
        fileName: fname,
      });

      try {
        const summary = await callMistral(config, CONTRIBUTION_L1_SYSTEM, prompt);
        const cleanSummary = summary.replace(/^["']|["']$/g, "").slice(0, 200);

        // KuzuDB: update edge property — need to delete and recreate since SET on edges can be tricky
        // Try SET first
        try {
          await conn.query(
            `MATCH (p:Person {id: '${esc(pid)}'})-[c:CONTRIBUTED]->(f:File {id: '${esc(fid)}'}) SET c.summary_l1 = '${esc(cleanSummary)}'`,
          );
        } catch {
          console.error(`[enricher] Could not SET summary_l1 on CONTRIBUTED edge ${pname} → ${fname}, skipping`);
          continue;
        }

        enriched++;
        console.error(`[enricher] CONTRIBUTED ${pname} → ${fname}: "${cleanSummary}"`);
      } catch (err) {
        console.error(`[enricher] Failed to enrich CONTRIBUTED ${pname} → ${fname}:`, err);
      }
    }

    if (i + 5 < edges.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return enriched;
}
