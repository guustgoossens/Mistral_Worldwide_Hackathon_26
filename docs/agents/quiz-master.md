# Agent 2: Quiz Master

## Role

Knowledge assessment agent. Generates questions about code functions, evaluates answers, and updates UNDERSTANDS relationships in KuzuDB.

## Model

**DevStral Small 2** (24B, 200 t/s) — same model as Agent 1. The Quiz Master is a **mode of Agent 1** (same voice pipeline, different system prompt + state), not a separate agent instance. Evaluation quality comes from the parallel truth-finding pattern (DevStral 2 builds a GroundTruth packet while the user speaks).

## Capabilities

- Generate targeted questions about specific functions
- Parallel truth-finding: composes a GroundTruth packet from code + summaries before asking
- Evaluate free-form voice answers against ground truth
- Update UNDERSTANDS confidence levels in KuzuDB
- Spaced repetition scheduling (prioritize low-confidence + high-importance functions)

## Quiz Flow

```
1. Select target function (triggered by voice agent or scheduled)
2. Build GroundTruth packet:
   - Function source code (from file)
   - summary_l1, l2, l3 (from KuzuDB)
   - Caller/callee context (CALLS relationships)
   - File context (CONTAINS relationships)
3. Generate question (specific, answerable)
4. Present to user via QuizPanel UI
5. User answers (voice or button)
6. Evaluate answer against GroundTruth
7. Update UNDERSTANDS relationship:
   - confidence: deep/surface/none
   - source: 'quiz'
   - lastAssessed: now
8. Create DISCUSSED relationship with transcript
```

## Question Types

- **What does X do?** — tests high-level understanding
- **What does X call?** — tests knowledge of dependencies
- **What calls X?** — tests knowledge of dependents
- **What would break if X changed?** — tests impact understanding
- **Who else knows about X?** — tests team awareness

## Spaced Repetition

Priority scoring for which functions to quiz next:

```
priority = relevance × (1 - confidence) × timeSinceLastAssessed
```

High relevance + low confidence + long time since assessed = quiz this first.

When a node gets new commits, `needsRetest` is set to `true` on all UNDERSTANDS edges for that node. The quiz agent prioritizes retesting affected understanders.

## Parallel Truth-Finding

The key architectural innovation: when a quiz question is asked, DevStral 2 launches **simultaneously** to build a GroundTruth packet while the user thinks and speaks (5-15 seconds). DevStral 2 finishes in ~3-5 seconds, well before the user stops talking.

```
Question asked → TTS speaks it
  │
  ├── User thinks + speaks (5-15 seconds)
  │
  └── DevStral 2 builds GroundTruth packet (3-5 seconds, parallel)
       • Level 2-3 technical detail from KuzuDB
       • Recent commits/changes
       • Past team interview notes (from Discussion nodes)
       • Common wrong answers
       • Related concepts
       • Key nuances for deep vs surface understanding

  → User finishes → Small 2 evaluates against GroundTruth (~500ms)
  → Rich, contextual feedback delivered instantly
  → Update UNDERSTANDS + create Discussion node
```

Result: DevStral 2-quality feedback at Small 2 speed. The latency is hidden behind human thinking time.

## Companion Mode (Activation Triggers)

- User says "quiz me" or "test my knowledge"
- User taps the "I'm waiting" button (V1 — signals inference idle time manually)
- V2 (stretch): silence detected on mic for ~5 seconds
- V3 (post-hackathon): system proactively initiates when coding agent runs inference
- Spaced repetition trigger: a node has `needsRetest = true`
