/**
 * MCP tool definitions and handlers for HackStral graph queries.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type kuzu from "kuzu";
import { getSchemaDescription, queryRows } from "./kuzu-server.js";
import { reason } from "../reasoner/index.js";
import { enrichRepo } from "../enricher/index.js";

export function registerTools(server: McpServer, conn: kuzu.Connection): void {
  // 1. get_schema — Returns full graph schema DDL + patterns
  server.tool(
    "get_schema",
    "Returns the full KuzuDB graph schema (DDL), ID conventions, and example Cypher patterns. Call this first to understand the data model before writing queries.",
    {},
    async () => ({
      content: [{ type: "text", text: getSchemaDescription() }],
    }),
  );

  // 2. query_graph — Raw Cypher execution
  server.tool(
    "query_graph",
    "Execute a Cypher query against the codebase graph. Returns JSON rows. Use get_schema first to understand the schema.",
    { cypher: z.string().describe("The Cypher query to execute") },
    async ({ cypher }) => {
      try {
        const rows = await queryRows(conn, cypher);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(rows, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text",
            text: `Query failed: ${String(err)}`,
          }],
          isError: true,
        };
      }
    },
  );

  // 3. search_nodes — Convenience name search
  server.tool(
    "search_nodes",
    "Search for nodes by name (case-insensitive substring match). Optionally filter by type.",
    {
      name: z.string().describe("Substring to match against node names"),
      type: z.enum(["File", "Function", "Class", "Person"]).optional().describe("Filter by node type"),
    },
    async ({ name, type }) => {
      try {
        const tables = type ? [type] : ["File", "Function", "Class", "Person"];
        const allRows: Record<string, unknown>[] = [];

        for (const table of tables) {
          const nameCol = table === "Person" ? "p" : "n";
          const idField = `${nameCol}.id`;
          const nameField = `${nameCol}.name`;

          let query: string;
          if (table === "Person") {
            query = `MATCH (p:Person) WHERE lower(p.name) CONTAINS lower('${name.replace(/'/g, "\\'")}') RETURN p.id, p.name, p.email LIMIT 20`;
          } else if (table === "File") {
            query = `MATCH (n:File) WHERE lower(n.name) CONTAINS lower('${name.replace(/'/g, "\\'")}') OR lower(n.filePath) CONTAINS lower('${name.replace(/'/g, "\\'")}') RETURN n.id, n.name, n.filePath LIMIT 20`;
          } else {
            query = `MATCH (n:${table}) WHERE lower(n.name) CONTAINS lower('${name.replace(/'/g, "\\'")}') RETURN n.id, n.name, n.filePath LIMIT 20`;
          }

          try {
            const rows = await queryRows(conn, query);
            allRows.push(...rows.map(r => ({ ...r, _type: table })));
          } catch {
            // Table might be empty
          }
        }

        return {
          content: [{
            type: "text",
            text: allRows.length > 0
              ? JSON.stringify(allRows, null, 2)
              : `No nodes found matching "${name}"`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Search failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 4. get_node_context — Rich context about a node
  server.tool(
    "get_node_context",
    "Get rich context about a node: its relationships (callers, callees, imports, contributors, knowledge). Works for File, Function, and Class nodes.",
    {
      nodeId: z.string().describe("The node ID (e.g., 'fn:src/lib/kuzu.ts::queryGraph' or 'f:src/App.tsx')"),
    },
    async ({ nodeId }) => {
      try {
        const context: Record<string, unknown> = { nodeId };

        // Detect node type from ID prefix
        const isFile = nodeId.startsWith("f:");
        const isClass = nodeId.startsWith("c:");
        const isFunction = nodeId.startsWith("fn:");
        const isPerson = nodeId.startsWith("p:");
        const safeId = nodeId.replace(/'/g, "\\'");

        if (isFunction) {
          // Function details
          const details = await queryRows(conn, `MATCH (fn:Function {id: '${safeId}'}) RETURN fn.id, fn.name, fn.filePath, fn.summary, fn.startLine, fn.endLine, fn.relevance`);
          context.details = details[0] ?? null;

          // What it calls
          const callees = await queryRows(conn, `MATCH (fn:Function {id: '${safeId}'})-[:CALLS]->(c:Function) RETURN c.id, c.name, c.filePath`);
          context.callees = callees;

          // What calls it
          const callers = await queryRows(conn, `MATCH (c:Function)-[:CALLS]->(fn:Function {id: '${safeId}'}) RETURN c.id, c.name, c.filePath`);
          context.callers = callers;

          // Containing file
          const containingFile = await queryRows(conn, `MATCH (f:File)-[:CONTAINS]->(fn:Function {id: '${safeId}'}) RETURN f.id, f.name, f.filePath`);
          context.containingFile = containingFile[0] ?? null;

          // Who understands it
          try {
            const understanders = await queryRows(conn, `MATCH (p:Person)-[u:UNDERSTANDS]->(fn:Function {id: '${safeId}'}) RETURN p.name, u.confidence, u.summary_l1`);
            context.understanders = understanders;
          } catch { context.understanders = []; }

          // Contributors (via containing file)
          if (containingFile.length > 0) {
            const fileId = (containingFile[0] as Record<string, string>)["f.id"];
            if (fileId) {
              try {
                const contribs = await queryRows(conn, `MATCH (p:Person)-[c:CONTRIBUTED]->(f:File {id: '${fileId.replace(/'/g, "\\'")}'}) RETURN p.name, c.commits, c.linesChanged, c.summary_l1`);
                context.contributors = contribs;
              } catch { context.contributors = []; }
            }
          }
        } else if (isFile) {
          // File details
          const details = await queryRows(conn, `MATCH (f:File {id: '${safeId}'}) RETURN f.id, f.name, f.filePath, f.summary, f.relevance`);
          context.details = details[0] ?? null;

          // Functions in this file
          const functions = await queryRows(conn, `MATCH (f:File {id: '${safeId}'})-[:CONTAINS]->(fn:Function) RETURN fn.id, fn.name`);
          context.functions = functions;

          // Classes in this file
          const classes = await queryRows(conn, `MATCH (f:File {id: '${safeId}'})-[:CONTAINS]->(c:Class) RETURN c.id, c.name`);
          context.classes = classes;

          // Files it imports
          const imports = await queryRows(conn, `MATCH (f:File {id: '${safeId}'})-[:IMPORTS]->(i:File) RETURN i.id, i.name, i.filePath`);
          context.imports = imports;

          // Files that import this
          const importedBy = await queryRows(conn, `MATCH (i:File)-[:IMPORTS]->(f:File {id: '${safeId}'}) RETURN i.id, i.name, i.filePath`);
          context.importedBy = importedBy;

          // Contributors
          try {
            const contribs = await queryRows(conn, `MATCH (p:Person)-[c:CONTRIBUTED]->(f:File {id: '${safeId}'}) RETURN p.name, c.commits, c.linesChanged, c.ownershipPct, c.summary_l1`);
            context.contributors = contribs;
          } catch { context.contributors = []; }
        } else if (isClass) {
          const details = await queryRows(conn, `MATCH (c:Class {id: '${safeId}'}) RETURN c.id, c.name, c.filePath, c.summary, c.relevance`);
          context.details = details[0] ?? null;

          const containingFile = await queryRows(conn, `MATCH (f:File)-[:CONTAINS]->(c:Class {id: '${safeId}'}) RETURN f.id, f.name, f.filePath`);
          context.containingFile = containingFile[0] ?? null;
        } else if (isPerson) {
          const details = await queryRows(conn, `MATCH (p:Person {id: '${safeId}'}) RETURN p.id, p.name, p.email`);
          context.details = details[0] ?? null;

          try {
            const contributions = await queryRows(conn, `MATCH (p:Person {id: '${safeId}'})-[c:CONTRIBUTED]->(f:File) RETURN f.name, f.filePath, c.commits, c.linesChanged ORDER BY c.commits DESC LIMIT 20`);
            context.contributions = contributions;
          } catch { context.contributions = []; }

          try {
            const understands = await queryRows(conn, `MATCH (p:Person {id: '${safeId}'})-[u:UNDERSTANDS]->(fn:Function) RETURN fn.name, fn.filePath, u.confidence, u.summary_l1`);
            context.understands = understands;
          } catch { context.understands = []; }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(context, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Context lookup failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 5. get_graph_stats — Quick counts
  server.tool(
    "get_graph_stats",
    "Get summary statistics: counts of all node and edge types in the graph.",
    {},
    async () => {
      try {
        const stats: Record<string, number> = {};

        const nodeTables = ["File", "Function", "Class", "Person", "Discussion"];
        for (const table of nodeTables) {
          try {
            const rows = await queryRows(conn, `MATCH (n:${table}) RETURN count(n) AS cnt`);
            stats[`${table} nodes`] = Number((rows[0] as Record<string, unknown>)?.cnt ?? 0);
          } catch {
            stats[`${table} nodes`] = 0;
          }
        }

        const relQueries = [
          ["CONTAINS edges", "MATCH ()-[r:CONTAINS]->() RETURN count(r) AS cnt"],
          ["CALLS edges", "MATCH ()-[r:CALLS]->() RETURN count(r) AS cnt"],
          ["IMPORTS edges", "MATCH ()-[r:IMPORTS]->() RETURN count(r) AS cnt"],
          ["CONTRIBUTED edges", "MATCH ()-[r:CONTRIBUTED]->() RETURN count(r) AS cnt"],
          ["UNDERSTANDS edges", "MATCH ()-[r:UNDERSTANDS]->() RETURN count(r) AS cnt"],
        ];
        for (const [label, query] of relQueries) {
          try {
            const rows = await queryRows(conn, query);
            stats[label] = Number((rows[0] as Record<string, unknown>)?.cnt ?? 0);
          } catch {
            stats[label] = 0;
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(stats, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Stats failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 6. reason_about — Multi-step graph reasoning
  server.tool(
    "reason_about",
    "Ask a complex question about the codebase. Uses multi-step Cypher reasoning across structural, contribution, and knowledge dimensions with progressive disclosure (L0→L1→L2). Good for questions like 'what's the blast radius of refactoring X?' or 'who should fix this bug?'",
    {
      question: z.string().describe("The question to reason about"),
    },
    async ({ question }) => {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        return {
          content: [{ type: "text", text: "MISTRAL_API_KEY not set — cannot run reasoner" }],
          isError: true,
        };
      }

      try {
        const result = await reason(conn, question, {
          apiKey,
          model: process.env.REASONER_MODEL ?? "devstral-2507",
          baseUrl: "https://api.mistral.ai",
        });

        const output = {
          question: result.question,
          answer: result.answer,
          nodeIds: result.nodeIds,
          stepsCount: result.steps.length,
          steps: result.steps.map(s => ({
            step: s.stepNumber,
            dimension: s.dimension,
            level: s.level,
            thought: s.thought,
            cypher: s.cypher,
            resultCount: s.results.length,
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Reasoning failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 7. enrich_repo — Trigger metadata enrichment
  server.tool(
    "enrich_repo",
    "Generate L0 summaries for all nodes and L1 summaries for contributor relationships. This populates the 'summary' and 'summary_l1' fields used by the reasoner. Takes a few minutes for large repos.",
    {},
    async () => {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        return {
          content: [{ type: "text", text: "MISTRAL_API_KEY not set — cannot run enricher" }],
          isError: true,
        };
      }

      try {
        const result = await enrichRepo(conn, {
          apiKey,
          model: process.env.ENRICHER_MODEL ?? "devstral-small-2507",
          baseUrl: "https://api.mistral.ai",
        });

        return {
          content: [{
            type: "text",
            text: `Enrichment complete: ${result.nodeSummaries} node summaries generated, ${result.relationshipL1} L1 relationship summaries generated.`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Enrichment failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
