/**
 * L0 enrichment: Generate summaries + relevance scores for all nodes.
 */

import type kuzu from "kuzu";
import { queryRows } from "../mcp/kuzu-server.js";
import { NODE_SUMMARY_SYSTEM, nodeSummaryPrompt } from "./prompts.js";

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
      max_tokens: 200,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    throw new Error(`Mistral API error: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function enrichNodeSummaries(
  conn: kuzu.Connection,
  config: MistralConfig,
): Promise<number> {
  let enriched = 0;

  // Get all functions missing summaries
  const functions = await queryRows(
    conn,
    `MATCH (f:Function) WHERE f.summary = '' OR f.summary IS NULL RETURN f.id, f.name, f.filePath`,
  );

  console.error(`[enricher] ${functions.length} functions need summaries`);

  // Process in batches of 5
  for (let i = 0; i < functions.length; i += 5) {
    const batch = functions.slice(i, i + 5);

    for (const row of batch) {
      const id = String((row as Record<string, unknown>)["f.id"]);
      const name = String((row as Record<string, unknown>)["f.name"]);
      const filePath = String((row as Record<string, unknown>)["f.filePath"]);

      // Gather context
      let callers: string[] = [];
      let callees: string[] = [];
      try {
        const callerRows = await queryRows(conn, `MATCH (c:Function)-[:CALLS]->(f:Function {id: '${esc(id)}'}) RETURN c.name`);
        callers = callerRows.map(r => String((r as Record<string, unknown>)["c.name"]));
      } catch {}
      try {
        const calleeRows = await queryRows(conn, `MATCH (f:Function {id: '${esc(id)}'})-[:CALLS]->(c:Function) RETURN c.name`);
        callees = calleeRows.map(r => String((r as Record<string, unknown>)["c.name"]));
      } catch {}

      const prompt = nodeSummaryPrompt({
        type: "Function",
        name,
        filePath,
        callers,
        callees,
      });

      try {
        const response = await callMistral(config, NODE_SUMMARY_SYSTEM, prompt);
        const parsed = JSON.parse(response);
        const summary = String(parsed.summary ?? "").slice(0, 200);
        const relevance = Math.max(0, Math.min(1, Number(parsed.relevance) || 0.5));

        await conn.query(
          `MATCH (f:Function {id: '${esc(id)}'}) SET f.summary = '${esc(summary)}', f.relevance = ${relevance}`,
        );
        enriched++;
        console.error(`[enricher] Function ${name}: "${summary}" (${relevance})`);
      } catch (err) {
        console.error(`[enricher] Failed to enrich function ${name}:`, err);
      }
    }

    // Small delay between batches
    if (i + 5 < functions.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Enrich files
  const files = await queryRows(
    conn,
    `MATCH (f:File) WHERE f.summary = '' OR f.summary IS NULL RETURN f.id, f.name, f.filePath`,
  );

  console.error(`[enricher] ${files.length} files need summaries`);

  for (let i = 0; i < files.length; i += 5) {
    const batch = files.slice(i, i + 5);

    for (const row of batch) {
      const id = String((row as Record<string, unknown>)["f.id"]);
      const name = String((row as Record<string, unknown>)["f.name"]);
      const filePath = String((row as Record<string, unknown>)["f.filePath"]);

      // Gather context
      let functions_in: string[] = [];
      let imports: string[] = [];
      let importedBy: string[] = [];
      try {
        const fnRows = await queryRows(conn, `MATCH (f:File {id: '${esc(id)}'})-[:CONTAINS]->(fn:Function) RETURN fn.name`);
        functions_in = fnRows.map(r => String((r as Record<string, unknown>)["fn.name"]));
      } catch {}
      try {
        const impRows = await queryRows(conn, `MATCH (f:File {id: '${esc(id)}'})-[:IMPORTS]->(i:File) RETURN i.name`);
        imports = impRows.map(r => String((r as Record<string, unknown>)["i.name"]));
      } catch {}
      try {
        const ibRows = await queryRows(conn, `MATCH (i:File)-[:IMPORTS]->(f:File {id: '${esc(id)}'}) RETURN i.name`);
        importedBy = ibRows.map(r => String((r as Record<string, unknown>)["i.name"]));
      } catch {}

      const prompt = nodeSummaryPrompt({
        type: "File",
        name,
        filePath,
        functions: functions_in,
        imports,
        importedBy,
      });

      try {
        const response = await callMistral(config, NODE_SUMMARY_SYSTEM, prompt);
        const parsed = JSON.parse(response);
        const summary = String(parsed.summary ?? "").slice(0, 200);
        const relevance = Math.max(0, Math.min(1, Number(parsed.relevance) || 0.5));

        await conn.query(
          `MATCH (f:File {id: '${esc(id)}'}) SET f.summary = '${esc(summary)}', f.relevance = ${relevance}`,
        );
        enriched++;
        console.error(`[enricher] File ${name}: "${summary}" (${relevance})`);
      } catch (err) {
        console.error(`[enricher] Failed to enrich file ${name}:`, err);
      }
    }

    if (i + 5 < files.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return enriched;
}
