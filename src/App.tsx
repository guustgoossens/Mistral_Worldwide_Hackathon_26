import { useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Graph3D } from "@/components/Graph3D";
import type { Graph3DHandle } from "@/components/Graph3D";
import { VoiceControls } from "@/components/VoiceControls";
import { NodeDetail } from "@/components/NodeDetail";
import { QuizPanel } from "@/components/QuizPanel";
import { AgentStatus } from "@/components/AgentStatus";
import { useGraph } from "@/hooks/useGraph";
import { useKuzu } from "@/hooks/useKuzu";
import { useInterview } from "@/hooks/useInterview";
import { useKnowledge } from "@/hooks/useKnowledge";
import type { VizNode } from "@/types/graph";

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? "http://localhost:3001";

export default function App() {
  const kuzu = useKuzu();
  const { graphData, overlayMode, setOverlayMode, selectedNode, selectNode, highlightedIds, highlightNodes } =
    useGraph(kuzu);
  const knowledge = useKnowledge(kuzu.conn);
  const graphRef = useRef<Graph3DHandle>(null);

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

  return (
    <Layout overlayMode={overlayMode} onOverlayChange={setOverlayMode} sidebar={<SidebarContent />}>
      <Graph3D ref={graphRef} data={graphData} onNodeClick={selectNode} highlightedIds={highlightedIds} />
      <AgentStatus kuzuReady={kuzu.isReady} voiceStatus={interview.voiceStatus} />
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
