import type { GraphData, VizNode } from "@/types/graph";

/**
 * Sample graph data — mirrors the real HackStral codebase structure.
 */
export const sampleGraph: GraphData = {
  nodes: [
    // ── Files ──────────────────────────────────────────────────────────
    { id: "f:lib/briefing.ts", name: "lib/briefing.ts", type: "file", filePath: "src/lib/briefing.ts", val: 8, color: "#6C5CE7" },
    { id: "f:lib/agent-tools.ts", name: "lib/agent-tools.ts", type: "file", filePath: "src/lib/agent-tools.ts", val: 6, color: "#6C5CE7" },
    { id: "f:lib/kuzu.ts", name: "lib/kuzu.ts", type: "file", filePath: "src/lib/kuzu.ts", val: 9, color: "#6C5CE7" },
    { id: "f:lib/graph-builder.ts", name: "lib/graph-builder.ts", type: "file", filePath: "src/lib/graph-builder.ts", val: 5, color: "#6C5CE7" },
    { id: "f:lib/git-data.ts", name: "lib/git-data.ts", type: "file", filePath: "src/lib/git-data.ts", val: 5, color: "#6C5CE7" },
    { id: "f:lib/utils.ts", name: "lib/utils.ts", type: "file", filePath: "src/lib/utils.ts", val: 3, color: "#6C5CE7" },
    { id: "f:hooks/useInterview.ts", name: "hooks/useInterview.ts", type: "file", filePath: "src/hooks/useInterview.ts", val: 8, color: "#6C5CE7" },
    { id: "f:hooks/useVoiceAgent.ts", name: "hooks/useVoiceAgent.ts", type: "file", filePath: "src/hooks/useVoiceAgent.ts", val: 7, color: "#6C5CE7" },
    { id: "f:hooks/useKnowledge.ts", name: "hooks/useKnowledge.ts", type: "file", filePath: "src/hooks/useKnowledge.ts", val: 7, color: "#6C5CE7" },
    { id: "f:hooks/useGraph.ts", name: "hooks/useGraph.ts", type: "file", filePath: "src/hooks/useGraph.ts", val: 6, color: "#6C5CE7" },
    { id: "f:hooks/useKuzu.ts", name: "hooks/useKuzu.ts", type: "file", filePath: "src/hooks/useKuzu.ts", val: 6, color: "#6C5CE7" },
    { id: "f:hooks/useTreeSitter.ts", name: "hooks/useTreeSitter.ts", type: "file", filePath: "src/hooks/useTreeSitter.ts", val: 4, color: "#6C5CE7" },
    { id: "f:components/VoiceControls.tsx", name: "VoiceControls.tsx", type: "file", filePath: "src/components/VoiceControls.tsx", val: 6, color: "#6C5CE7" },
    { id: "f:components/QuizPanel.tsx", name: "QuizPanel.tsx", type: "file", filePath: "src/components/QuizPanel.tsx", val: 6, color: "#6C5CE7" },
    { id: "f:components/Graph3D.tsx", name: "Graph3D.tsx", type: "file", filePath: "src/components/Graph3D.tsx", val: 7, color: "#6C5CE7" },
    { id: "f:components/NodeDetail.tsx", name: "NodeDetail.tsx", type: "file", filePath: "src/components/NodeDetail.tsx", val: 5, color: "#6C5CE7" },
    { id: "f:components/Layout.tsx", name: "Layout.tsx", type: "file", filePath: "src/components/Layout.tsx", val: 4, color: "#6C5CE7" },
    { id: "f:components/AgentStatus.tsx", name: "AgentStatus.tsx", type: "file", filePath: "src/components/AgentStatus.tsx", val: 5, color: "#6C5CE7" },
    { id: "f:types/graph.ts", name: "types/graph.ts", type: "file", filePath: "src/types/graph.ts", val: 5, color: "#6C5CE7" },
    { id: "f:App.tsx", name: "App.tsx", type: "file", filePath: "src/App.tsx", val: 10, color: "#6C5CE7" },
    { id: "f:server/proxy.ts", name: "server/proxy.ts", type: "file", filePath: "server/proxy.ts", val: 8, color: "#6C5CE7" },

    // ── Functions ───────────────────────────────────────────────────────
    // AI Agent Engineering (deep knowledge)
    { id: "fn:gatherContext", name: "gatherContext", type: "function", filePath: "src/lib/briefing.ts", val: 8, color: "#00CFDD", summary: "Queries KuzuDB for codebase context: files, functions, classes, relationships" },
    { id: "fn:generateBriefing", name: "generateBriefing", type: "function", filePath: "src/lib/briefing.ts", val: 10, color: "#00CFDD", summary: "Sends codebase context to Mistral to generate interview questions as JSON" },
    { id: "fn:composeBriefingPrompt", name: "composeBriefingPrompt", type: "function", filePath: "src/lib/briefing.ts", val: 7, color: "#00CFDD", summary: "Composes full system prompt for voice agent from briefing packet" },
    { id: "fn:createAgentTools", name: "createAgentTools", type: "function", filePath: "src/lib/agent-tools.ts", val: 8, color: "#00CFDD", summary: "Factory creating fire-and-forget visualization tools for ElevenLabs client" },
    { id: "fn:useInterview", name: "useInterview", type: "function", filePath: "src/hooks/useInterview.ts", val: 10, color: "#00CFDD", summary: "Hook managing interview lifecycle: idle → preparing → ready → interviewing → complete" },
    { id: "fn:useVoiceAgent", name: "useVoiceAgent", type: "function", filePath: "src/hooks/useVoiceAgent.ts", val: 9, color: "#00CFDD", summary: "Hook wrapping ElevenLabs useConversation with client tools and transcript tracking" },
    { id: "fn:useKnowledge", name: "useKnowledge", type: "function", filePath: "src/hooks/useKnowledge.ts", val: 9, color: "#00CFDD", summary: "Hook managing quiz state, knowledge scores, question generation, answer evaluation" },

    // KuzuDB / Graph infra (no knowledge)
    { id: "fn:initKuzu", name: "initKuzu", type: "function", filePath: "src/lib/kuzu.ts", val: 7, color: "#00CFDD", summary: "Initialize KuzuDB WASM in-browser with SharedArrayBuffer" },
    { id: "fn:setupSchema", name: "setupSchema", type: "function", filePath: "src/lib/kuzu.ts", val: 6, color: "#00CFDD", summary: "Create node and relationship tables in KuzuDB" },
    { id: "fn:queryGraph", name: "queryGraph", type: "function", filePath: "src/lib/kuzu.ts", val: 8, color: "#00CFDD", summary: "Execute a Cypher query against KuzuDB with error handling" },
    { id: "fn:deriveVizData", name: "deriveVizData", type: "function", filePath: "src/lib/kuzu.ts", val: 9, color: "#00CFDD", summary: "Derive visualization data from KuzuDB based on active overlay modes" },
    { id: "fn:upsertUnderstands", name: "upsertUnderstands", type: "function", filePath: "src/lib/kuzu.ts", val: 6, color: "#00CFDD", summary: "Create or update UNDERSTANDS edge between Person and Function" },
    { id: "fn:getQuizCandidates", name: "getQuizCandidates", type: "function", filePath: "src/lib/kuzu.ts", val: 7, color: "#00CFDD", summary: "Find functions a person should be quizzed on, prioritized by confidence" },
    { id: "fn:getFunctionContext", name: "getFunctionContext", type: "function", filePath: "src/lib/kuzu.ts", val: 7, color: "#00CFDD", summary: "Get rich context about a function for quiz question generation" },
    { id: "fn:parseTable", name: "parseTable", type: "function", filePath: "src/lib/kuzu.ts", val: 5, color: "#00CFDD", summary: "Parse KuzuDB WASM table result into array of row objects" },
    { id: "fn:loadGraphFromJSON", name: "loadGraphFromJSON", type: "function", filePath: "src/lib/graph-builder.ts", val: 6, color: "#00CFDD", summary: "Loads parsed repo graph.json into KuzuDB nodes and edges" },
    { id: "fn:loadGitData", name: "loadGitData", type: "function", filePath: "src/lib/git-data.ts", val: 6, color: "#00CFDD", summary: "Loads git contributor data into KuzuDB Person nodes and CONTRIBUTED edges" },
    { id: "fn:useKuzu", name: "useKuzu", type: "function", filePath: "src/hooks/useKuzu.ts", val: 7, color: "#00CFDD", summary: "Hook initializing KuzuDB WASM and providing query executor" },
    { id: "fn:useTreeSitter", name: "useTreeSitter", type: "function", filePath: "src/hooks/useTreeSitter.ts", val: 4, color: "#00CFDD", summary: "Hook for in-browser code parsing with tree-sitter WASM (placeholder)" },

    // Basics / UI (surface knowledge)
    { id: "fn:useGraph", name: "useGraph", type: "function", filePath: "src/hooks/useGraph.ts", val: 7, color: "#00CFDD", summary: "Hook managing graph visualization state, overlay modes, selection, filtering" },

    // ── Classes / Components (as class nodes) ───────────────────────────
    // No actual classes in this codebase, but key components as class nodes for visual variety
  ],
  links: [
    // ── CONTAINS: file → function ──────────────────────────────────────
    { source: "f:lib/briefing.ts", target: "fn:gatherContext", type: "contains" },
    { source: "f:lib/briefing.ts", target: "fn:generateBriefing", type: "contains" },
    { source: "f:lib/briefing.ts", target: "fn:composeBriefingPrompt", type: "contains" },
    { source: "f:lib/agent-tools.ts", target: "fn:createAgentTools", type: "contains" },
    { source: "f:lib/kuzu.ts", target: "fn:initKuzu", type: "contains" },
    { source: "f:lib/kuzu.ts", target: "fn:setupSchema", type: "contains" },
    { source: "f:lib/kuzu.ts", target: "fn:queryGraph", type: "contains" },
    { source: "f:lib/kuzu.ts", target: "fn:deriveVizData", type: "contains" },
    { source: "f:lib/kuzu.ts", target: "fn:upsertUnderstands", type: "contains" },
    { source: "f:lib/kuzu.ts", target: "fn:getQuizCandidates", type: "contains" },
    { source: "f:lib/kuzu.ts", target: "fn:getFunctionContext", type: "contains" },
    { source: "f:lib/kuzu.ts", target: "fn:parseTable", type: "contains" },
    { source: "f:lib/graph-builder.ts", target: "fn:loadGraphFromJSON", type: "contains" },
    { source: "f:lib/git-data.ts", target: "fn:loadGitData", type: "contains" },
    { source: "f:hooks/useInterview.ts", target: "fn:useInterview", type: "contains" },
    { source: "f:hooks/useVoiceAgent.ts", target: "fn:useVoiceAgent", type: "contains" },
    { source: "f:hooks/useKnowledge.ts", target: "fn:useKnowledge", type: "contains" },
    { source: "f:hooks/useGraph.ts", target: "fn:useGraph", type: "contains" },
    { source: "f:hooks/useKuzu.ts", target: "fn:useKuzu", type: "contains" },
    { source: "f:hooks/useTreeSitter.ts", target: "fn:useTreeSitter", type: "contains" },

    // ── CALLS: function → function ─────────────────────────────────────
    // Briefing pipeline
    { source: "fn:generateBriefing", target: "fn:gatherContext", type: "calls" },
    { source: "fn:gatherContext", target: "fn:queryGraph", type: "calls" },
    { source: "fn:generateBriefing", target: "fn:composeBriefingPrompt", type: "calls" },

    // Interview uses briefing + voice
    { source: "fn:useInterview", target: "fn:generateBriefing", type: "calls" },
    { source: "fn:useInterview", target: "fn:useVoiceAgent", type: "calls" },

    // Knowledge/quiz uses KuzuDB helpers
    { source: "fn:useKnowledge", target: "fn:getQuizCandidates", type: "calls" },
    { source: "fn:useKnowledge", target: "fn:getFunctionContext", type: "calls" },
    { source: "fn:useKnowledge", target: "fn:upsertUnderstands", type: "calls" },

    // KuzuDB internals
    { source: "fn:initKuzu", target: "fn:setupSchema", type: "calls" },
    { source: "fn:deriveVizData", target: "fn:queryGraph", type: "calls" },
    { source: "fn:getQuizCandidates", target: "fn:queryGraph", type: "calls" },
    { source: "fn:getFunctionContext", target: "fn:queryGraph", type: "calls" },
    { source: "fn:upsertUnderstands", target: "fn:queryGraph", type: "calls" },

    // useKuzu initializes KuzuDB and loads data
    { source: "fn:useKuzu", target: "fn:initKuzu", type: "calls" },
    { source: "fn:useKuzu", target: "fn:loadGraphFromJSON", type: "calls" },
    { source: "fn:useKuzu", target: "fn:loadGitData", type: "calls" },

    // Graph builder uses queryGraph
    { source: "fn:loadGraphFromJSON", target: "fn:queryGraph", type: "calls" },
    { source: "fn:loadGitData", target: "fn:queryGraph", type: "calls" },

    // useGraph uses deriveVizData
    { source: "fn:useGraph", target: "fn:deriveVizData", type: "calls" },

    // ── IMPORTS: file → file ───────────────────────────────────────────
    // App.tsx imports everything
    { source: "f:App.tsx", target: "f:hooks/useInterview.ts", type: "imports" },
    { source: "f:App.tsx", target: "f:hooks/useVoiceAgent.ts", type: "imports" },
    { source: "f:App.tsx", target: "f:hooks/useKnowledge.ts", type: "imports" },
    { source: "f:App.tsx", target: "f:hooks/useGraph.ts", type: "imports" },
    { source: "f:App.tsx", target: "f:hooks/useKuzu.ts", type: "imports" },
    { source: "f:App.tsx", target: "f:components/VoiceControls.tsx", type: "imports" },
    { source: "f:App.tsx", target: "f:components/QuizPanel.tsx", type: "imports" },
    { source: "f:App.tsx", target: "f:components/Graph3D.tsx", type: "imports" },
    { source: "f:App.tsx", target: "f:components/NodeDetail.tsx", type: "imports" },
    { source: "f:App.tsx", target: "f:components/Layout.tsx", type: "imports" },
    { source: "f:App.tsx", target: "f:components/AgentStatus.tsx", type: "imports" },

    // Briefing imports kuzu
    { source: "f:lib/briefing.ts", target: "f:lib/kuzu.ts", type: "imports" },

    // Hooks import libs
    { source: "f:hooks/useInterview.ts", target: "f:lib/briefing.ts", type: "imports" },
    { source: "f:hooks/useInterview.ts", target: "f:hooks/useVoiceAgent.ts", type: "imports" },
    { source: "f:hooks/useKnowledge.ts", target: "f:lib/kuzu.ts", type: "imports" },
    { source: "f:hooks/useKuzu.ts", target: "f:lib/kuzu.ts", type: "imports" },
    { source: "f:hooks/useKuzu.ts", target: "f:lib/graph-builder.ts", type: "imports" },
    { source: "f:hooks/useKuzu.ts", target: "f:lib/git-data.ts", type: "imports" },
    { source: "f:hooks/useGraph.ts", target: "f:lib/kuzu.ts", type: "imports" },
    { source: "f:hooks/useGraph.ts", target: "f:types/graph.ts", type: "imports" },

    // Voice agent imports agent tools
    { source: "f:hooks/useVoiceAgent.ts", target: "f:lib/agent-tools.ts", type: "imports" },

    // Server imports briefing
    { source: "f:server/proxy.ts", target: "f:lib/briefing.ts", type: "imports" },
  ],
};

// ── Person + knowledge seed data ─────────────────────────────────────

export interface PersonSeed {
  id: string;
  name: string;
  email: string;
}

export interface UnderstandsSeed {
  personId: string;
  funcId: string;
  confidence: "deep" | "surface" | "none";
  source: "quiz" | "voice_interview" | "git" | "inferred";
  topics: string[];
}

export interface ContributedSeed {
  personId: string;
  fileId: string;
  commits: number;
  linesChanged: number;
  ownershipPct: number;
}

export const samplePersons: PersonSeed[] = [
  { id: "p:guust", name: "Guust", email: "guust@hackstral.dev" },
];

/**
 * Knowledge distribution:
 *  - deep:    AI agent engineering (briefing, voice, interview, knowledge/quiz)
 *  - surface: basics (React hooks, UI components, graph state)
 *  - none:    KuzuDB internals, graph builder, git data, tree-sitter
 */
export const sampleUnderstands: UnderstandsSeed[] = [
  // ── Deep: AI agent patterns ──────────────────────────────────────────
  { personId: "p:guust", funcId: "fn:generateBriefing", confidence: "deep", source: "voice_interview", topics: ["LLM prompting", "JSON mode", "Mistral API", "briefing pipeline"] },
  { personId: "p:guust", funcId: "fn:gatherContext", confidence: "deep", source: "voice_interview", topics: ["context assembly", "graph queries for LLM input"] },
  { personId: "p:guust", funcId: "fn:composeBriefingPrompt", confidence: "deep", source: "voice_interview", topics: ["system prompt design", "voice agent constraints"] },
  { personId: "p:guust", funcId: "fn:createAgentTools", confidence: "deep", source: "voice_interview", topics: ["ElevenLabs client tools", "fire-and-forget pattern", "visualization hooks"] },
  { personId: "p:guust", funcId: "fn:useInterview", confidence: "deep", source: "voice_interview", topics: ["state machine", "interview lifecycle", "voice agent orchestration"] },
  { personId: "p:guust", funcId: "fn:useVoiceAgent", confidence: "deep", source: "voice_interview", topics: ["ElevenLabs SDK", "useConversation wrapper", "transcript tracking"] },
  { personId: "p:guust", funcId: "fn:useKnowledge", confidence: "deep", source: "quiz", topics: ["quiz generation", "answer evaluation", "knowledge scoring", "Mistral JSON mode"] },

  // ── Surface: basics ──────────────────────────────────────────────────
  { personId: "p:guust", funcId: "fn:useGraph", confidence: "surface", source: "inferred", topics: ["overlay modes", "node selection"] },

  // ── None: KuzuDB / graph infrastructure ──────────────────────────────
  { personId: "p:guust", funcId: "fn:initKuzu", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:setupSchema", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:queryGraph", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:deriveVizData", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:upsertUnderstands", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:getQuizCandidates", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:getFunctionContext", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:parseTable", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:loadGraphFromJSON", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:loadGitData", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:useKuzu", confidence: "none", source: "inferred", topics: [] },
  { personId: "p:guust", funcId: "fn:useTreeSitter", confidence: "none", source: "inferred", topics: [] },
];

/**
 * Contributor data — Guust has commits across the codebase,
 * heavier on agent files, lighter on KuzuDB infra.
 */
export const sampleContributed: ContributedSeed[] = [
  { personId: "p:guust", fileId: "f:lib/briefing.ts", commits: 18, linesChanged: 340, ownershipPct: 0.95 },
  { personId: "p:guust", fileId: "f:lib/agent-tools.ts", commits: 12, linesChanged: 180, ownershipPct: 1.0 },
  { personId: "p:guust", fileId: "f:hooks/useInterview.ts", commits: 22, linesChanged: 520, ownershipPct: 0.92 },
  { personId: "p:guust", fileId: "f:hooks/useVoiceAgent.ts", commits: 15, linesChanged: 280, ownershipPct: 1.0 },
  { personId: "p:guust", fileId: "f:hooks/useKnowledge.ts", commits: 16, linesChanged: 410, ownershipPct: 0.88 },
  { personId: "p:guust", fileId: "f:server/proxy.ts", commits: 14, linesChanged: 260, ownershipPct: 0.90 },
  { personId: "p:guust", fileId: "f:components/VoiceControls.tsx", commits: 10, linesChanged: 220, ownershipPct: 0.85 },
  { personId: "p:guust", fileId: "f:components/QuizPanel.tsx", commits: 8, linesChanged: 190, ownershipPct: 0.80 },
  { personId: "p:guust", fileId: "f:App.tsx", commits: 20, linesChanged: 480, ownershipPct: 0.75 },
  { personId: "p:guust", fileId: "f:components/Graph3D.tsx", commits: 6, linesChanged: 150, ownershipPct: 0.70 },
  { personId: "p:guust", fileId: "f:components/NodeDetail.tsx", commits: 5, linesChanged: 120, ownershipPct: 0.65 },
  { personId: "p:guust", fileId: "f:components/Layout.tsx", commits: 3, linesChanged: 60, ownershipPct: 1.0 },
  { personId: "p:guust", fileId: "f:components/AgentStatus.tsx", commits: 4, linesChanged: 90, ownershipPct: 0.75 },
  { personId: "p:guust", fileId: "f:hooks/useGraph.ts", commits: 7, linesChanged: 160, ownershipPct: 0.70 },
  { personId: "p:guust", fileId: "f:types/graph.ts", commits: 6, linesChanged: 140, ownershipPct: 0.80 },
  // Lighter on KuzuDB / infra (less involved)
  { personId: "p:guust", fileId: "f:lib/kuzu.ts", commits: 3, linesChanged: 80, ownershipPct: 0.30 },
  { personId: "p:guust", fileId: "f:lib/graph-builder.ts", commits: 2, linesChanged: 40, ownershipPct: 0.25 },
  { personId: "p:guust", fileId: "f:lib/git-data.ts", commits: 2, linesChanged: 35, ownershipPct: 0.20 },
  { personId: "p:guust", fileId: "f:hooks/useKuzu.ts", commits: 3, linesChanged: 70, ownershipPct: 0.35 },
  { personId: "p:guust", fileId: "f:hooks/useTreeSitter.ts", commits: 1, linesChanged: 20, ownershipPct: 0.15 },
  { personId: "p:guust", fileId: "f:lib/utils.ts", commits: 2, linesChanged: 15, ownershipPct: 1.0 },
];

// ── KuzuDB insertion helpers ─────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/'/g, "\\'");
}

/**
 * Insert all sample data into KuzuDB: nodes, edges, persons, knowledge, and contributions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadSampleIntoKuzu(conn: any): Promise<void> {
  // Insert code nodes
  for (const node of sampleGraph.nodes) {
    try {
      const cypher = nodeInsertCypher(node);
      if (cypher) await conn.execute(cypher);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already exists") || msg.includes("duplicate")) continue;
      console.warn("[KuzuDB] Failed to insert node:", node.id, err);
    }
  }

  // Insert code edges
  for (const link of sampleGraph.links) {
    try {
      const cypher = linkInsertCypher(link.source as string, link.target as string, link.type);
      if (cypher) await conn.execute(cypher);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already exists") || msg.includes("duplicate")) continue;
      console.warn("[KuzuDB] Failed to insert link:", link.source, "->", link.target, err);
    }
  }

  // Insert Person nodes
  for (const person of samplePersons) {
    try {
      await conn.execute(
        `CREATE (p:Person {id: '${esc(person.id)}', name: '${esc(person.name)}', email: '${esc(person.email)}'})`,
      );
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already exists") || msg.includes("duplicate")) continue;
      console.warn("[KuzuDB] Failed to insert person:", person.id, err);
    }
  }

  // Insert CONTRIBUTED edges
  const now = new Date().toISOString();
  for (const c of sampleContributed) {
    try {
      await conn.execute(
        `MATCH (p:Person {id: '${esc(c.personId)}'}), (f:File {id: '${esc(c.fileId)}'}) ` +
          `CREATE (p)-[:CONTRIBUTED {commits: ${c.commits}, lastTouch: '${now}', linesChanged: ${c.linesChanged}, blameLines: ${c.linesChanged}, ownershipPct: ${c.ownershipPct}, summary_l1: '', commits_json: '[]'}]->(f)`,
      );
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already exists") || msg.includes("duplicate")) continue;
      console.warn("[KuzuDB] Failed to insert CONTRIBUTED:", c.personId, "->", c.fileId, err);
    }
  }

  // Insert UNDERSTANDS edges
  for (const u of sampleUnderstands) {
    try {
      const topicsLiteral = `[${u.topics.map((t) => `'${esc(t)}'`).join(", ")}]`;
      await conn.execute(
        `MATCH (p:Person {id: '${esc(u.personId)}'}), (f:Function {id: '${esc(u.funcId)}'}) ` +
          `CREATE (p)-[:UNDERSTANDS {confidence: '${esc(u.confidence)}', source: '${esc(u.source)}', topics: ${topicsLiteral}, lastAssessed: '${now}', needsRetest: false, summary_l1: '', sessions_json: '[]'}]->(f)`,
      );
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already exists") || msg.includes("duplicate")) continue;
      console.warn("[KuzuDB] Failed to insert UNDERSTANDS:", u.personId, "->", u.funcId, err);
    }
  }

  console.log("[KuzuDB] Sample data loaded (nodes, edges, persons, knowledge, contributions)");
}

function nodeInsertCypher(node: VizNode): string | null {
  switch (node.type) {
    case "file":
      return `CREATE (n:File {id: '${esc(node.id)}', name: '${esc(node.name)}', filePath: '${esc(node.filePath ?? "")}', summary: '', relevance: 0.5})`;
    case "function":
      return `CREATE (n:Function {id: '${esc(node.id)}', name: '${esc(node.name)}', filePath: '${esc(node.filePath ?? "")}', startLine: 0, endLine: 0, summary: '${esc(node.summary ?? "")}', relevance: 0.5})`;
    case "class":
      return `CREATE (n:Class {id: '${esc(node.id)}', name: '${esc(node.name)}', filePath: '${esc(node.filePath ?? "")}', summary: '', relevance: 0.5})`;
    default:
      return null;
  }
}

function linkInsertCypher(source: string, target: string, type: string): string | null {
  switch (type) {
    case "contains": {
      const targetLabel = target.startsWith("c:") ? "Class" : "Function";
      return `MATCH (a:File {id: '${esc(source)}'}), (b:${targetLabel} {id: '${esc(target)}'}) CREATE (a)-[:CONTAINS]->(b)`;
    }
    case "calls":
      return `MATCH (a:Function {id: '${esc(source)}'}), (b:Function {id: '${esc(target)}'}) CREATE (a)-[:CALLS]->(b)`;
    case "imports":
      return `MATCH (a:File {id: '${esc(source)}'}), (b:File {id: '${esc(target)}'}) CREATE (a)-[:IMPORTS]->(b)`;
    default:
      return null;
  }
}

// ── Knowledge seeding for parsed data ────────────────────────────────

/**
 * File path patterns → knowledge level.
 * Matched against function filePath from KuzuDB.
 */
const DEEP_PATHS = [
  "agent-tools.ts",
  "useVoiceAgent.ts",
  "useKnowledge.ts",
  "useInterview.ts",
  "VoiceControls.tsx",
  "QuizPanel.tsx",
  "briefing.ts",
  "proxy.ts",
];

const SURFACE_PATHS = [
  "App.tsx",
  "useGraph.ts",
  "Graph3D.tsx",
  "NodeDetail.tsx",
  "AgentStatus.tsx",
  "Layout.tsx",
  "utils.ts",
  "graph.ts", // types/graph.ts
];

// Everything else (kuzu.ts, graph-builder.ts, git-data.ts, useKuzu.ts,
// useTreeSitter.ts, sample-graph.ts, scripts/, tests) → "none"

function classifyFunction(filePath: string): "deep" | "surface" | "none" {
  if (DEEP_PATHS.some((p) => filePath.endsWith(p))) return "deep";
  if (SURFACE_PATHS.some((p) => filePath.endsWith(p))) return "surface";
  return "none";
}

/**
 * Seed UNDERSTANDS edges into KuzuDB using real function IDs from parsed data.
 * Queries all Function nodes, finds the first Person, and creates edges
 * based on file path classification.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedKnowledgeData(conn: any): Promise<void> {
  type Row = Record<string, string>;

  // Find the person node (created by git-data loader)
  let personId: string | null = null;
  try {
    const persons = await conn.execute(`MATCH (p:Person) RETURN p.id LIMIT 1`);
    if (persons.table) {
      const raw = persons.table.toString();
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          personId = (parsed[0] as Row)["p.id"] ?? null;
        }
      } catch {
        // ignore parse failure
      }
    }
  } catch {
    // no person nodes
  }

  if (!personId) {
    console.log("[knowledge-seed] No Person node found, skipping knowledge seeding");
    return;
  }

  // Get all functions
  let functions: Row[] = [];
  try {
    const result = await conn.execute(`MATCH (f:Function) RETURN f.id, f.filePath`);
    if (result.table) {
      const raw = result.table.toString();
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) functions = parsed as Row[];
      } catch {
        // ignore
      }
    }
  } catch {
    // no functions
  }

  if (functions.length === 0) {
    console.log("[knowledge-seed] No Function nodes found, skipping");
    return;
  }

  const now = new Date().toISOString();
  let created = 0;

  for (const fn of functions) {
    const funcId = fn["f.id"] ?? "";
    const filePath = fn["f.filePath"] ?? "";
    const confidence = classifyFunction(filePath);

    try {
      await conn.execute(
        `MATCH (p:Person {id: '${esc(personId)}'}), (f:Function {id: '${esc(funcId)}'}) ` +
          `CREATE (p)-[:UNDERSTANDS {confidence: '${confidence}', source: 'inferred', topics: [], lastAssessed: '${now}', needsRetest: false, summary_l1: '', sessions_json: '[]'}]->(f)`,
      );
      created++;
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already exists") || msg.includes("duplicate")) continue;
      // silently skip failures
    }
  }

  console.log(`[knowledge-seed] Created ${created} UNDERSTANDS edges for ${personId} (${functions.length} functions)`);
}
