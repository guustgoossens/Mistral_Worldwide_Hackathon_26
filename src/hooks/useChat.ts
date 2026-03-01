/**
 * Chat hook: text-based conversation with graph-aware tool calls.
 *
 * Flow:
 * 1. User types a question
 * 2. Send to proxy → Mistral with execute_cypher + highlight_nodes tools
 * 3. If Mistral returns tool calls, execute Cypher against browser WASM KuzuDB
 * 4. Feed results back, repeat until Mistral gives a text answer
 * 5. Highlight referenced nodes on the 3D graph
 */

import { useState, useCallback, useRef } from "react";
import type { OverlayMode } from "@/types/graph";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Node IDs to highlight when this message is displayed */
  nodeIds?: string[];
  /** Whether this message is still streaming */
  isStreaming?: boolean;
}

interface UseChatDeps {
  executeQuery: (cypher: string) => Promise<unknown[]>;
  highlightNodes: (ids: string[]) => void;
  selectNode: (nodeId: string) => void;
  setOverlay: (mode: OverlayMode) => void;
  flyToNode?: (nodeId: string) => void;
  proxyUrl: string;
}

const SCHEMA_CONTEXT = `You have access to a KuzuDB graph database representing a codebase. Use the execute_cypher tool to query it.

## Schema
-- Node Tables
CREATE NODE TABLE File (id STRING, name STRING, filePath STRING, summary STRING, relevance DOUBLE, PRIMARY KEY (id))
CREATE NODE TABLE Function (id STRING, name STRING, filePath STRING, startLine INT64, endLine INT64, summary STRING, relevance DOUBLE, PRIMARY KEY (id))
CREATE NODE TABLE Class (id STRING, name STRING, filePath STRING, summary STRING, relevance DOUBLE, PRIMARY KEY (id))
CREATE NODE TABLE Person (id STRING, name STRING, email STRING, PRIMARY KEY (id))

-- Relationship Tables
CREATE REL TABLE CONTAINS (FROM File TO Function, FROM File TO Class)
CREATE REL TABLE CALLS (FROM Function TO Function)
CREATE REL TABLE IMPORTS (FROM File TO File)
CREATE REL TABLE CONTRIBUTED (FROM Person TO File, commits INT64, lastTouch STRING, linesChanged INT64, ownershipPct DOUBLE, summary_l1 STRING)
CREATE REL TABLE UNDERSTANDS (FROM Person TO Function, confidence STRING, source STRING, topics STRING[], summary_l1 STRING)

## ID Conventions
- File: 'f:<filePath>' (e.g., 'f:src/App.tsx')
- Function: 'fn:<filePath>::<name>' (e.g., 'fn:src/lib/kuzu.ts::initKuzu')
- Class: 'c:<filePath>::<name>'
- Person: 'p:<id>_<email>'

## Example Patterns
- Functions in a file: MATCH (f:File {id: 'f:src/App.tsx'})-[:CONTAINS]->(fn:Function) RETURN fn.name
- Call chain: MATCH (fn:Function {name: 'initKuzu'})-[:CALLS]->(c:Function) RETURN c.name
- Who calls a function: MATCH (c:Function)-[:CALLS]->(fn:Function {name: 'queryGraph'}) RETURN c.name, c.filePath
- Contributors: MATCH (p:Person)-[c:CONTRIBUTED]->(f:File) WHERE f.name = 'kuzu.ts' RETURN p.name, c.commits
- Blast radius: MATCH (fn:Function {name: 'queryGraph'})<-[:CALLS*1..2]-(caller:Function) RETURN DISTINCT caller.name, caller.filePath
- Search: MATCH (n:Function) WHERE n.name CONTAINS 'graph' RETURN n.id, n.name

## Rules
- Use execute_cypher to query the graph. You can call it multiple times.
- After getting results, use highlight_nodes to show relevant nodes on the 3D graph.
- When done, give a clear text answer summarizing what you found.
- If a query fails, try a simpler version or a different approach.
- ALWAYS include node IDs in your highlight_nodes call so the user can see them on the graph.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_cypher",
      description: "Execute a Cypher query against the codebase graph database. Returns JSON rows.",
      parameters: {
        type: "object",
        properties: {
          cypher: { type: "string", description: "The Cypher query to execute" },
        },
        required: ["cypher"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "highlight_nodes",
      description: "Highlight specific nodes on the 3D graph visualization. Call this to show the user which nodes your answer relates to.",
      parameters: {
        type: "object",
        properties: {
          nodeIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of node IDs to highlight (e.g., ['fn:src/lib/kuzu.ts::queryGraph', 'f:src/App.tsx'])",
          },
        },
        required: ["nodeIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "switch_view",
      description: "Switch the graph overlay mode to show different data dimensions.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["structure", "contributors", "knowledge", "people"],
            description: "The overlay mode to switch to",
          },
        },
        required: ["mode"],
      },
    },
  },
];

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

const MAX_TOOL_ROUNDS = 6;

export function useChat(deps: UseChatDeps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isLoading) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: userText.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Build conversation for the API
      const apiMessages: Array<{ role: string; content: string; tool_calls?: ToolCall[]; tool_call_id?: string; name?: string }> = [
        { role: "system", content: SCHEMA_CONTEXT },
      ];

      // Include recent conversation history (last 10 messages)
      const recentMessages = [...messages.slice(-10), userMsg];
      for (const msg of recentMessages) {
        apiMessages.push({ role: msg.role, content: msg.content });
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        let collectedNodeIds: string[] = [];

        // Tool call loop
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await fetch(`${deps.proxyUrl}/v1/chat/graph`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: apiMessages,
              model: "devstral-small-2507",
              tools: TOOLS,
              max_tokens: 2048,
              temperature: 0.3,
              stream: false,
            }),
            signal: abortController.signal,
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
          }

          const data = await response.json();
          const choice = data.choices?.[0];
          if (!choice) throw new Error("No response from model");

          const assistantMessage = choice.message;

          // Add assistant message to API history
          apiMessages.push(assistantMessage);

          // Check for tool calls
          if (assistantMessage.tool_calls?.length) {
            // Process each tool call
            for (const tc of assistantMessage.tool_calls as ToolCall[]) {
              let args: Record<string, unknown>;
              try {
                args = JSON.parse(tc.function.arguments);
              } catch {
                args = {};
              }

              let toolResult: string;

              if (tc.function.name === "execute_cypher") {
                const cypher = String(args.cypher ?? "");
                console.log(`[chat] Executing Cypher: ${cypher.slice(0, 120)}`);
                try {
                  const rows = await deps.executeQuery(cypher);
                  toolResult = JSON.stringify(rows.slice(0, 30), null, 2);
                  console.log(`[chat] Query returned ${rows.length} rows`);
                } catch (err) {
                  toolResult = `Query error: ${String(err)}`;
                  console.warn(`[chat] Query failed:`, err);
                }
              } else if (tc.function.name === "highlight_nodes") {
                const nodeIds = (args.nodeIds as string[]) ?? [];
                deps.highlightNodes(nodeIds);
                collectedNodeIds = [...collectedNodeIds, ...nodeIds];
                toolResult = `Highlighted ${nodeIds.length} nodes`;
                // Also fly to first node
                if (nodeIds.length > 0 && deps.flyToNode) {
                  deps.flyToNode(nodeIds[0]!);
                }
              } else if (tc.function.name === "switch_view") {
                const mode = String(args.mode ?? "structure") as OverlayMode;
                deps.setOverlay(mode);
                toolResult = `Switched to ${mode} view`;
              } else {
                toolResult = `Unknown tool: ${tc.function.name}`;
              }

              // Add tool result to API history
              apiMessages.push({
                role: "tool",
                content: toolResult,
                tool_call_id: tc.id,
                name: tc.function.name,
              });
            }

            // Continue the loop — model needs to process tool results
            continue;
          }

          // No tool calls — we have a final text response
          const assistantContent = assistantMessage.content ?? "";
          const assistantChatMsg: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: "assistant",
            content: assistantContent,
            nodeIds: collectedNodeIds.length > 0 ? collectedNodeIds : undefined,
          };

          setMessages((prev) => [...prev, assistantChatMsg]);
          break;
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[chat] Error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-error`,
            role: "assistant",
            content: `Error: ${(err as Error).message}`,
          },
        ]);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [deps, isLoading, messages],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    stopGeneration,
  };
}
