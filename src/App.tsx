import { Layout } from "@/components/Layout";
import { Graph3D } from "@/components/Graph3D";
import { VoiceControls } from "@/components/VoiceControls";
import { NodeDetail } from "@/components/NodeDetail";
import { QuizPanel } from "@/components/QuizPanel";
import { AgentStatus } from "@/components/AgentStatus";
import { useGraph } from "@/hooks/useGraph";
import { useKuzu } from "@/hooks/useKuzu";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { useKnowledge } from "@/hooks/useKnowledge";

export default function App() {
  const kuzu = useKuzu();
  const { graphData, overlayMode, setOverlayMode, selectedNode, selectNode, highlightedIds } = useGraph(kuzu);
  const voice = useVoiceAgent();
  const knowledge = useKnowledge();

  return (
    <Layout overlayMode={overlayMode} onOverlayChange={setOverlayMode} sidebar={<SidebarContent />}>
      <Graph3D data={graphData} onNodeClick={selectNode} highlightedIds={highlightedIds} />
      <AgentStatus kuzuReady={kuzu.isReady} voiceConnected={voice.isConnected} />
      <NodeDetail node={selectedNode} onClose={() => selectNode(null)} />
      <QuizPanel question={knowledge.activeQuiz?.question ?? null} onAnswer={knowledge.submitAnswer} />
      <VoiceControls
        isConnected={voice.isConnected}
        isSpeaking={voice.isSpeaking}
        transcript={voice.transcript}
        onStart={voice.start}
        onStop={voice.stop}
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
