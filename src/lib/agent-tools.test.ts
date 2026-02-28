import { describe, it, expect, mock } from "bun:test";
import { createAgentTools, type AgentToolDeps } from "./agent-tools";

// ---------------------------------------------------------------------------
// Mock deps factory
// ---------------------------------------------------------------------------

function createMockDeps(): AgentToolDeps {
  return {
    executeQuery: mock(async (_cypher: string) => []),
    highlightNodes: mock((_ids: string[]) => {}),
    setOverlay: mock((_mode: any) => {}),
    selectNode: mock((_nodeId: string) => {}),
    flyToNode: mock((_nodeId: string) => {}),
    startQuiz: mock((_topic: string) => {}),
  };
}

// ---------------------------------------------------------------------------
// queryGraph
// ---------------------------------------------------------------------------

describe("queryGraph", () => {
  it("calls deps.executeQuery with the provided cypher string", async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    await tools.queryGraph({ cypher: "MATCH (n) RETURN n" });

    expect(deps.executeQuery).toHaveBeenCalledWith("MATCH (n) RETURN n");
  });

  it("returns JSON.stringify(results) of query results", async () => {
    const deps = createMockDeps();
    deps.executeQuery = mock(async () => [{ id: "1" }, { id: "2" }]);
    const tools = createAgentTools(deps);

    const result = await tools.queryGraph({ cypher: "MATCH (n) RETURN n" });

    expect(result).toBe(JSON.stringify([{ id: "1" }, { id: "2" }]));
  });

  it("truncates output to 2000 characters", async () => {
    const deps = createMockDeps();
    const longData = Array.from({ length: 500 }, (_, i) => ({ id: `node-${i}`, name: `A very long node name that takes up space number ${i}` }));
    deps.executeQuery = mock(async () => longData);
    const tools = createAgentTools(deps);

    const result = await tools.queryGraph({ cypher: "MATCH (n) RETURN n" });

    expect(result!.length).toBeLessThanOrEqual(2000);
  });

  it('returns "[]" for empty results', async () => {
    const deps = createMockDeps();
    deps.executeQuery = mock(async () => []);
    const tools = createAgentTools(deps);

    const result = await tools.queryGraph({ cypher: "MATCH (n) RETURN n" });

    expect(result).toBe("[]");
  });
});

// ---------------------------------------------------------------------------
// highlightNodes
// ---------------------------------------------------------------------------

describe("highlightNodes", () => {
  it("calls deps.highlightNodes with provided nodeIds", async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    await tools.highlightNodes({ nodeIds: ["a", "b", "c"] });

    expect(deps.highlightNodes).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it('returns "Highlighted N nodes" with correct count', async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    const result = await tools.highlightNodes({ nodeIds: ["a", "b", "c"] });

    expect(result).toBe("Highlighted 3 nodes");
  });

  it('handles empty array (returns "Highlighted 0 nodes")', async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    const result = await tools.highlightNodes({ nodeIds: [] });

    expect(result).toBe("Highlighted 0 nodes");
  });
});

// ---------------------------------------------------------------------------
// switchViewMode
// ---------------------------------------------------------------------------

describe("switchViewMode", () => {
  it("calls deps.setOverlay with provided mode", async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    await tools.switchViewMode({ mode: "knowledge" });

    expect(deps.setOverlay).toHaveBeenCalledWith("knowledge");
  });

  it('returns "Switched to <mode> view"', async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    const result = await tools.switchViewMode({ mode: "people" });

    expect(result).toBe("Switched to people view");
  });
});

// ---------------------------------------------------------------------------
// flyToNode
// ---------------------------------------------------------------------------

describe("flyToNode", () => {
  it("calls deps.flyToNode with nodeId", async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    await tools.flyToNode({ nodeId: "fn:login" });

    expect(deps.flyToNode).toHaveBeenCalledWith("fn:login");
  });

  it("returns confirmation string", async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    const result = await tools.flyToNode({ nodeId: "fn:login" });

    expect(result).toBe("Flying to node fn:login");
  });

  it("does not throw when flyToNode is undefined", async () => {
    const deps = createMockDeps();
    deps.flyToNode = undefined;
    const tools = createAgentTools(deps);

    const result = await tools.flyToNode({ nodeId: "fn:login" });

    expect(result).toBe("Flying to node fn:login");
  });
});

// ---------------------------------------------------------------------------
// showDetailPanel
// ---------------------------------------------------------------------------

describe("showDetailPanel", () => {
  it("calls deps.selectNode with nodeId", async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    await tools.showDetailPanel({ nodeId: "c:Auth" });

    expect(deps.selectNode).toHaveBeenCalledWith("c:Auth");
  });

  it("returns confirmation string", async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    const result = await tools.showDetailPanel({ nodeId: "c:Auth" });

    expect(result).toBe("Showing details for c:Auth");
  });
});

// ---------------------------------------------------------------------------
// startQuiz
// ---------------------------------------------------------------------------

describe("startQuiz", () => {
  it("calls deps.startQuiz with topic", async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    await tools.startQuiz({ topic: "authentication" });

    expect(deps.startQuiz).toHaveBeenCalledWith("authentication");
  });

  it('defaults topic to "" when undefined', async () => {
    const deps = createMockDeps();
    const tools = createAgentTools(deps);

    await tools.startQuiz({});

    expect(deps.startQuiz).toHaveBeenCalledWith("");
  });

  it("does not throw when startQuiz is undefined", async () => {
    const deps = createMockDeps();
    deps.startQuiz = undefined;
    const tools = createAgentTools(deps);

    const result = await tools.startQuiz({ topic: "auth" });

    expect(result).toBe("Quiz started");
  });
});
