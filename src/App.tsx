import { useRef, useCallback, useState, useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Graph3D } from "@/components/Graph3D";
import type { Graph3DHandle } from "@/components/Graph3D";
import { VoiceControls } from "@/components/VoiceControls";
import { NodeDetail } from "@/components/NodeDetail";
import { QuizPanel } from "@/components/QuizPanel";
import { AgentStatus } from "@/components/AgentStatus";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useGraph } from "@/hooks/useGraph";
import { useKuzu } from "@/hooks/useKuzu";
import { useInterview } from "@/hooks/useInterview";
import { useKnowledge } from "@/hooks/useKnowledge";
import { queryGraph } from "@/lib/kuzu";
import type { VizNode } from "@/types/graph";

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? "http://localhost:3001";

export default function App() {
  const kuzu = useKuzu();
  const {
    graphData,
    overlayMode,
    setOverlayMode,
    selectedNode,
    selectNode,
    highlightedIds,
    highlightNodes,
    personFilter,
    setPersonFilter,
  } = useGraph(kuzu);
  const knowledge = useKnowledge(kuzu.conn);
  const graphRef = useRef<Graph3DHandle>(null);

  // Query person names for contributor filter
  const [persons, setPersons] = useState<string[]>([]);

  useEffect(() => {
    if (!kuzu.isReady || !kuzu.conn) return;
    queryGraph(kuzu.conn, "MATCH (p:Person) RETURN p.name ORDER BY p.name")
      .then((rows) => setPersons(rows.map((r) => (r as Record<string, unknown>)["p.name"] as string)))
      .catch(() => {});
  }, [kuzu.isReady, kuzu.conn]);

  const selectNodeById = useCallback(
    (nodeId: string) => {
      const node = graphData.nodes.find((n) => n.id === nodeId);
      if (node) selectNode(node as VizNode);
    },
    [graphData.nodes, selectNode],
  );

  const interview = useInterview({
    executeQuery: kuzu.executeQuery,
    highlightNodes,
    setOverlay: setOverlayMode,
    selectNode: selectNodeById,
    flyToNode: (nodeId: string) => graphRef.current?.flyToNode(nodeId),
    proxyUrl: PROXY_URL,
  });

  const handleStartQuiz = useCallback(() => {
    interview.startQuizMode();
    knowledge.startQuiz();
  }, [interview.startQuizMode, knowledge.startQuiz]);

  const handleStopQuiz = useCallback(() => {
    knowledge.dismissQuiz();
    interview.reset();
  }, [knowledge.dismissQuiz, interview.reset]);

  // Loading screen while KuzuDB initializes
  if (!kuzu.isReady && !kuzu.error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-bg">
        <div className="flex space-x-2 mb-4">
          <div className="h-3 w-3 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="h-3 w-3 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="h-3 w-3 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <h2 className="text-lg font-semibold text-text">Loading HackStral</h2>
        <p className="mt-2 text-sm text-text-muted">Initializing graph database...</p>
      </div>
    );
  }

  // Error screen if KuzuDB failed to initialize
  if (kuzu.error && !kuzu.isReady) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-bg">
        <div className="flex max-w-md flex-col items-center rounded-lg border border-border bg-surface p-8 text-center">
          <div className="mb-4 h-12 w-12 rounded-full bg-red-400/20 flex items-center justify-center">
            <span className="text-red-400 text-xl">!</span>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-text">Failed to initialize</h2>
          <p className="mb-6 text-sm text-text-muted">{kuzu.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Layout
        overlayMode={overlayMode}
        onOverlayChange={setOverlayMode}
        persons={persons}
        personFilter={personFilter}
        onPersonFilterChange={setPersonFilter}
        dataSource={kuzu.dataSource}
        nodeCount={graphData.nodes.length}
        sidebar={<SidebarContent />}
      >
        <Graph3D ref={graphRef} data={graphData} onNodeClick={selectNode} highlightedIds={highlightedIds} />
        <AgentStatus
          kuzuReady={kuzu.isReady}
          voiceStatus={interview.voiceStatus}
          dataSource={kuzu.dataSource}
          nodeCount={graphData.nodes.length}
        />
        <NodeDetail node={selectedNode} onClose={() => selectNode(null)} />
        <QuizPanel
          question={knowledge.activeQuiz?.question ?? null}
          onAnswer={knowledge.submitAnswer}
          isLoading={knowledge.isLoading}
          feedback={knowledge.feedback}
          sessionStats={knowledge.sessionStats}
          onNextQuestion={knowledge.nextQuestion}
          onClose={knowledge.dismissQuiz}
          targetName={knowledge.activeQuiz?.functionName}
        />

        {/* Voice error retry overlay */}
        {interview.error && interview.state === "idle" && (
          <div className="absolute bottom-36 left-1/2 z-30 -translate-x-1/2">
            <button
              onClick={interview.prepare}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text shadow-lg transition-colors hover:bg-border"
            >
              <RefreshCcw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        <VoiceControls
          interviewState={interview.state}
          voiceStatus={interview.voiceStatus}
          isSpeaking={interview.isSpeaking}
          transcript={interview.transcript}
          kuzuReady={kuzu.isReady}
          onPrepare={interview.prepare}
          onStartInterview={interview.startInterview}
          onStopInterview={interview.stopInterview}
          onStartQuiz={handleStartQuiz}
          onStopQuiz={handleStopQuiz}
          error={interview.error}
        />
      </Layout>
    </ErrorBoundary>
  );
}

function SidebarContent() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 text-sm font-medium text-text">Getting Started</h2>
        <p className="text-xs text-text-muted">
          Click on nodes in the 3D graph to explore code structure. Use the overlay buttons above to switch views.
        </p>
      </div>
      <div>
        <h2 className="mb-1 text-sm font-medium text-text">Voice Agent</h2>
        <p className="text-xs text-text-muted">
          Click the microphone button to start a voice conversation about the codebase.
        </p>
      </div>
    </div>
  );
}
