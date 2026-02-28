# Agent 2: Quiz Master

## Role

Knowledge assessment agent. Generates questions about code functions, evaluates answers, and updates UNDERSTANDS relationships in KuzuDB.

## Model

**mistral-medium** — balance of reasoning quality and speed for quiz generation and evaluation.

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
priority = structuralImportance × (1 - confidence) × timeSinceLastAssessed
```

High importance + low confidence + long time since assessed = quiz this first.

> **OPEN QUESTION:** Should the Quiz Master run as a separate agent instance or as a mode of the Voice Conversationalist? For hackathon simplicity, likely a mode switch within the same conversation.
