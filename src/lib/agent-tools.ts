/**
 * ElevenLabs client tool handlers.
 *
 * These tools are registered with the ElevenLabs conversation agent
 * and called by the voice AI to interact with the graph.
 * Return type matches ElevenLabs clientTools format:
 * Record<string, (params: any) => Promise<string | undefined>>
 */

import type { OverlayMode } from "@/types/graph";

export interface AgentToolDeps {
  executeQuery: (cypher: string) => Promise<unknown[]>;
  highlightNodes: (ids: string[]) => void;
  setOverlay: (mode: OverlayMode) => void;
  selectNode: (nodeId: string) => void;
  flyToNode?: (nodeId: string) => void;
  startQuiz?: (topic: string) => void;
}

export function createAgentTools(deps: AgentToolDeps) {
  return {
    queryGraph: async ({ cypher }: { cypher: string }): Promise<string | undefined> => {
      const results = await deps.executeQuery(cypher);
      return JSON.stringify(results).slice(0, 2000);
    },
    highlightNodes: async ({ nodeIds }: { nodeIds: string[] }): Promise<string | undefined> => {
      deps.highlightNodes(nodeIds);
      return `Highlighted ${nodeIds.length} nodes`;
    },
    switchViewMode: async ({ mode }: { mode: string }): Promise<string | undefined> => {
      deps.setOverlay(mode as OverlayMode);
      return `Switched to ${mode} view`;
    },
    flyToNode: async ({ nodeId }: { nodeId: string }): Promise<string | undefined> => {
      deps.flyToNode?.(nodeId);
      return `Flying to node ${nodeId}`;
    },
    showDetailPanel: async ({ nodeId }: { nodeId: string }): Promise<string | undefined> => {
      deps.selectNode(nodeId);
      return `Showing details for ${nodeId}`;
    },
    startQuiz: async ({ topic }: { topic?: string }): Promise<string | undefined> => {
      deps.startQuiz?.(topic ?? "");
      return "Quiz started";
    },
  };
}
