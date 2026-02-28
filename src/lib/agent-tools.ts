/**
 * ElevenLabs client tool handlers.
 *
 * Fire-and-forget visualization tools only.
 * No queryGraph or startQuiz — the interview flow pre-computes everything.
 */

import type { OverlayMode } from "@/types/graph";

export interface AgentToolDeps {
  highlightNodes: (ids: string[]) => void;
  setOverlay: (mode: OverlayMode) => void;
  selectNode: (nodeId: string) => void;
  flyToNode?: (nodeId: string) => void;
}

export function createAgentTools(deps: AgentToolDeps) {
  return {
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
  };
}
