import { useRef, useCallback, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RefreshCcw, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/Layout";
import { OverlayBar } from "@/components/OverlayBar";
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

export function RepoView() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const kuzu = useKuzu(repoId);
  const {
    graphData,
    setOverlayMode,
    overlayModes,
    toggleOverlayMode,
    selectedNode,
    selectNode,
    highlightedIds,
    highlightNodes,
    personFilter,
    togglePerson,
    clearPersonFilter,
  } = useGraph(kuzu);
  const knowledge = useKnowledge(kuzu.conn);
  const graphRef = useRef<Graph3DHandle>(null);

  const [persons, setPersons] = useState<string[]>([]);

  useEffect(() => {
    if (!kuzu.isReady || !kuzu.conn) return;
    queryGraph(kuzu.conn, "MATCH (p:Person) RETURN DISTINCT p.name ORDER BY p.name")
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
        <img src="/favicon.svg" alt="HackStral" className="mb-6 h-16 w-16 pixel-art" />
        <div className="spinner-gradient mb-4" />
        <h2 className="text-lg font-semibold text-text">Loading {repoId ?? "HackStral"}</h2>
        <p className="mt-2 text-sm text-text-muted">Initializing graph database...</p>
      </div>
    );
  }

  // Error screen if KuzuDB failed to initialize
  if (kuzu.error && !kuzu.isReady) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-bg">
        <div className="flex max-w-md flex-col items-center rounded-[12px] border border-border bg-surface p-8 text-center">
          <div className="mb-4 h-12 w-12 rounded-full bg-warm-red/20 flex items-center justify-center">
            <span className="text-warm-red text-xl">!</span>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-text">Failed to initialize</h2>
          <p className="mb-6 text-sm text-text-muted">{kuzu.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-[10px] gradient-cta px-4 py-2 text-sm font-bold text-white"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Layout>
        {/* Back to repos button */}
        <button
          onClick={() => navigate("/")}
          className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-[10px] border border-border bg-surface/80 px-3 py-1.5 text-sm font-medium text-text-muted backdrop-blur-sm transition-colors hover:bg-elevated hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Repos
        </button>

        <Graph3D ref={graphRef} data={graphData} onNodeClick={selectNode} highlightedIds={highlightedIds} />
        <OverlayBar
          overlayModes={overlayModes}
          onToggle={toggleOverlayMode}
        />
        <AgentStatus
          kuzuReady={kuzu.isReady}
          voiceStatus={interview.voiceStatus}
          dataSource={kuzu.dataSource}
          nodeCount={graphData.nodes.length}
          persons={persons}
          personFilter={personFilter}
          onTogglePerson={togglePerson}
          onClearPersonFilter={clearPersonFilter}
          showContributors={overlayModes.has("contributors")}
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
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-border"
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
