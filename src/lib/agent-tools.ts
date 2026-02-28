/**
 * ElevenLabs client tool definitions.
 *
 * These tools are registered with the ElevenLabs conversation agent
 * and called by the voice AI to interact with the graph.
 *
 * TODO: Implement tool handlers:
 * - query_graph(cypher) — execute Cypher against KuzuDB
 * - highlight_nodes(ids) — highlight specific nodes in 3D viz
 * - set_overlay(mode) — switch overlay mode
 * - start_quiz(functionId) — initiate knowledge quiz
 * - get_node_detail(id) — fetch detailed info for a node
 */

import type { OverlayMode } from "@/types/graph";

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export function createAgentTools(_deps: {
  executeQuery: (cypher: string) => Promise<unknown[]>;
  highlightNodes: (ids: string[]) => void;
  setOverlay: (mode: OverlayMode) => void;
}): AgentTool[] {
  // TODO: Implement agent tools
  return [];
}
