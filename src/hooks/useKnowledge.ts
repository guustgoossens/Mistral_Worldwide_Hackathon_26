/**
 * Knowledge tracking hook for quiz state and knowledge scores.
 *
 * Manages:
 * - Per-function knowledge confidence tracking (UNDERSTANDS edges)
 * - Quiz question generation via Mistral proxy
 * - Answer evaluation and score updates
 * - Quiz history via Discussion nodes
 */

import { useState, useCallback, useRef } from "react";
import { queryGraph } from "@/lib/kuzu";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuzuConnection = any;

const PROXY_URL =
  import.meta.env.VITE_PROXY_URL || "http://localhost:3001";

const DEFAULT_PERSON_ID = "current-user";
const DEFAULT_PERSON_NAME = "You";
const DEFAULT_PERSON_EMAIL = "user@hackstral.local";

interface ActiveQuiz {
  functionId: string;
  functionName: string;
  filePath: string;
  question: string;
  context: string; // function context used to generate the question
}

interface QuizHistoryEntry {
  functionId: string;
  functionName: string;
  question: string;
  answer: string;
  result: "correct" | "incorrect";
  explanation: string;
  timestamp: string;
}

interface QuizCandidate {
  id: string;
  name: string;
  filePath: string;
  summary: string;
  confidence: string | null; // null = no UNDERSTANDS edge
  needsRetest: boolean;
  priority: number; // lower = quiz first
}

/**
 * Escape a string for use in Cypher string literals.
 */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Call the Mistral proxy for non-streaming chat completions.
 */
async function callMistral(
  messages: { role: string; content: string }[],
): Promise<string> {
  try {
    const resp = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[useKnowledge] Mistral proxy error:", resp.status, errText);
      throw new Error(`Mistral proxy returned ${resp.status}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[useKnowledge] Failed to call Mistral:", err);
    throw err;
  }
}

export interface QuizFeedback {
  isCorrect: boolean;
  explanation: string;
  correctAnswer?: string;
}

export interface QuizSessionStats {
  questionNumber: number;
  correctCount: number;
  streak: number;
}

export function useKnowledge(conn?: KuzuConnection) {
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null);
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [sessionStats, setSessionStats] = useState<QuizSessionStats>({
    questionNumber: 0,
    correctCount: 0,
    streak: 0,
  });
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track whether we've ensured the default person exists
  const personEnsured = useRef(false);

  /**
   * Ensure the default person node exists in KuzuDB.
   */
  const ensurePerson = useCallback(async () => {
    if (!conn || personEnsured.current) return;
    try {
      await queryGraph(
        conn,
        `MERGE (p:Person {id: '${DEFAULT_PERSON_ID}'}) SET p.name = '${DEFAULT_PERSON_NAME}', p.email = '${DEFAULT_PERSON_EMAIL}'`,
      );
      personEnsured.current = true;
    } catch (err) {
      // MERGE might not be supported — try CREATE with existence check
      console.warn("[useKnowledge] MERGE failed, trying CREATE:", err);
      try {
        const existing = await queryGraph(
          conn,
          `MATCH (p:Person {id: '${DEFAULT_PERSON_ID}'}) RETURN p.id`,
        );
        if (existing.length === 0) {
          await queryGraph(
            conn,
            `CREATE (p:Person {id: '${DEFAULT_PERSON_ID}', name: '${DEFAULT_PERSON_NAME}', email: '${DEFAULT_PERSON_EMAIL}'})`,
          );
        }
        personEnsured.current = true;
      } catch (err2) {
        console.error("[useKnowledge] Failed to ensure person:", err2);
      }
    }
  }, [conn]);

  /**
   * Get quiz candidates: functions sorted by quiz priority.
   * Priority: no UNDERSTANDS edge > confidence=none > confidence=surface > needsRetest
   */
  const getQuizCandidates = useCallback(
    async (topic?: string): Promise<QuizCandidate[]> => {
      if (!conn) return [];

      type Row = Record<string, string>;

      // Get all functions
      const allFns = (await queryGraph(
        conn,
        `MATCH (f:Function) RETURN f.id, f.name, f.filePath, f.summary`,
      )) as Row[];

      // Get existing UNDERSTANDS edges for the current person
      let understandRows: Row[] = [];
      try {
        understandRows = (await queryGraph(
          conn,
          `MATCH (p:Person {id: '${DEFAULT_PERSON_ID}'})-[u:UNDERSTANDS]->(f:Function) RETURN f.id AS funcId, u.confidence AS confidence, u.needsRetest AS needsRetest`,
        )) as Row[];
      } catch {
        // No understanding data yet
      }

      // Build a map of function understanding
      const understandMap = new Map<
        string,
        { confidence: string; needsRetest: boolean }
      >();
      for (const row of understandRows) {
        understandMap.set(row["funcId"] ?? "", {
          confidence: row["confidence"] ?? "none",
          needsRetest: row["needsRetest"] === "true" || row["needsRetest"] === "True",
        });
      }

      // Build candidates with priority
      const candidates: QuizCandidate[] = [];
      for (const fn of allFns) {
        const id = fn["f.id"] ?? "";
        const name = fn["f.name"] ?? "";
        const filePath = fn["f.filePath"] ?? "";
        const summary = fn["f.summary"] ?? "";

        // Apply topic filter if provided
        if (topic) {
          const topicLower = topic.toLowerCase();
          const nameMatch = name.toLowerCase().includes(topicLower);
          const pathMatch = filePath.toLowerCase().includes(topicLower);
          const summaryMatch = summary.toLowerCase().includes(topicLower);
          if (!nameMatch && !pathMatch && !summaryMatch) continue;
        }

        const understanding = understandMap.get(id);
        let priority: number;
        let confidence: string | null = null;
        let needsRetest = false;

        if (!understanding) {
          // No UNDERSTANDS edge at all — highest priority
          priority = 0;
        } else {
          confidence = understanding.confidence;
          needsRetest = understanding.needsRetest;

          if (confidence === "none") {
            priority = 1;
          } else if (confidence === "surface") {
            priority = 2;
          } else if (needsRetest) {
            priority = 3;
          } else {
            // Already deeply understood and no retest needed — lowest priority
            priority = 4;
          }
        }

        candidates.push({
          id,
          name,
          filePath,
          summary,
          confidence,
          needsRetest,
          priority,
        });
      }

      // Sort by priority (ascending), then by name for stability
      candidates.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.name.localeCompare(b.name);
      });

      return candidates;
    },
    [conn],
  );

  /**
   * Start a quiz on a topic or random function.
   * Generates a question via Mistral and sets activeQuiz state.
   */
  const startQuiz = useCallback(
    async (topic?: string) => {
      if (!conn) {
        console.warn("[useKnowledge] Cannot start quiz: no KuzuDB connection");
        return;
      }

      setIsLoading(true);

      try {
        await ensurePerson();

        // Get candidates
        const candidates = await getQuizCandidates(topic);
        if (candidates.length === 0) {
          console.warn("[useKnowledge] No quiz candidates found");
          setIsLoading(false);
          return;
        }

        // Pick the highest priority candidate (first in sorted list)
        // Add some randomness among same-priority candidates
        const topPriority = candidates[0]!.priority;
        const topCandidates = candidates.filter(
          (c) => c.priority === topPriority,
        );
        const candidate =
          topCandidates[Math.floor(Math.random() * topCandidates.length)]!;

        // Fetch additional context: what does this function call/import?
        type Row = Record<string, string>;
        let callsInfo = "";
        let calledByInfo = "";

        try {
          const calls = (await queryGraph(
            conn,
            `MATCH (f:Function {id: '${esc(candidate.id)}'})-[:CALLS]->(target:Function) RETURN target.name, target.filePath`,
          )) as Row[];
          if (calls.length > 0) {
            callsInfo = `It calls: ${calls.map((r) => r["target.name"]).join(", ")}`;
          }
        } catch { /* no call data */ }

        try {
          const calledBy = (await queryGraph(
            conn,
            `MATCH (caller:Function)-[:CALLS]->(f:Function {id: '${esc(candidate.id)}'}) RETURN caller.name, caller.filePath`,
          )) as Row[];
          if (calledBy.length > 0) {
            calledByInfo = `Called by: ${calledBy.map((r) => r["caller.name"]).join(", ")}`;
          }
        } catch { /* no call data */ }

        const contextParts = [
          `Function: ${candidate.name}`,
          `File: ${candidate.filePath}`,
          candidate.summary ? `Summary: ${candidate.summary}` : "",
          callsInfo,
          calledByInfo,
        ].filter(Boolean);
        const context = contextParts.join("\n");

        // Generate question via Mistral
        const questionPrompt = `You are a quiz master for a codebase learning tool. Generate a single short quiz question to test whether someone understands the following function.

${context}

Rules:
- Ask about what the function does, its purpose, or how it fits into the codebase
- Keep the question concise (1-2 sentences)
- The question should be answerable with a brief explanation
- Do NOT include the answer
- Output ONLY the question text, nothing else`;

        let question: string;
        try {
          question = await callMistral([
            { role: "system", content: "You are a concise quiz question generator for code understanding assessment." },
            { role: "user", content: questionPrompt },
          ]);
          question = question.trim();
        } catch {
          // Fallback: generate a simple question without LLM
          question = `What does the function "${candidate.name}" in ${candidate.filePath} do?`;
        }

        if (!question) {
          question = `Can you explain what "${candidate.name}" does and why it exists?`;
        }

        setActiveQuiz({
          functionId: candidate.id,
          functionName: candidate.name,
          filePath: candidate.filePath,
          question,
          context,
        });
        setFeedback(null);
        setSessionStats((prev) => ({
          ...prev,
          questionNumber: prev.questionNumber + 1,
        }));
      } catch (err) {
        console.error("[useKnowledge] Failed to start quiz:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [conn, ensurePerson, getQuizCandidates],
  );

  /**
   * Submit an answer to the active quiz question.
   * Evaluates free-text answers via Mistral, updates KuzuDB, and records history.
   */
  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!activeQuiz || !conn) {
        console.warn("[useKnowledge] No active quiz or no connection");
        return;
      }

      setIsLoading(true);
      const quiz = activeQuiz;
      const isSkip = answer.toLowerCase() === "skip";

      try {
        let result: "correct" | "incorrect";
        let explanation: string;
        let newConfidence: "deep" | "surface" | "none";

        if (isSkip) {
          // User skipped — mark as incorrect, provide explanation
          result = "incorrect";
          newConfidence = "none";
          try {
            const helpResponse = await callMistral([
              {
                role: "system",
                content:
                  "You are a helpful code tutor. Provide a brief explanation (2-3 sentences) of what this function does. Be concise and helpful.",
              },
              {
                role: "user",
                content: `The user skipped this question. Please explain the answer briefly.\n\nQuestion: ${quiz.question}\nFunction context:\n${quiz.context}`,
              },
            ]);
            explanation = helpResponse.trim() || `"${quiz.functionName}" needs further study.`;
          } catch {
            explanation = `Take some time to study "${quiz.functionName}" in ${quiz.filePath}.`;
          }
        } else {
          // Evaluate free-text answer via Mistral
          try {
            const evalResponse = await callMistral([
              {
                role: "system",
                content: `You are evaluating a quiz answer about code. Respond with ONLY a JSON object (no markdown):
{"correct": true/false, "explanation": "brief feedback (1-2 sentences)", "correctAnswer": "brief correct answer if wrong"}`,
              },
              {
                role: "user",
                content: `Question: ${quiz.question}\n\nFunction context:\n${quiz.context}\n\nUser's answer: ${answer}\n\nIs this answer correct? Evaluate whether the user demonstrates understanding of the function.`,
              },
            ]);

            try {
              const cleanJson = evalResponse.replace(/```json\n?|\n?```/g, "").trim();
              const parsed = JSON.parse(cleanJson);
              result = parsed.correct ? "correct" : "incorrect";
              explanation = parsed.explanation || (parsed.correct ? "Good answer!" : "Not quite right.");
            } catch {
              // Couldn't parse JSON — check for keywords
              const lower = evalResponse.toLowerCase();
              result = lower.includes("correct") && !lower.includes("incorrect") ? "correct" : "incorrect";
              explanation = evalResponse.trim() || "Answer evaluated.";
            }
          } catch {
            // Mistral call failed — be generous and mark as correct
            result = "correct";
            explanation = "Answer recorded (could not verify with AI).";
          }
          newConfidence = result === "correct" ? "surface" : "none";
        }

        // Check if this is a repeated success — upgrade to deep
        const previousCorrect = quizHistory.filter(
          (h) =>
            h.functionId === quiz.functionId && h.result === "correct",
        ).length;
        if (result === "correct" && previousCorrect >= 1) {
          newConfidence = "deep";
        }

        const now = new Date().toISOString();

        // Update UNDERSTANDS edge in KuzuDB
        try {
          await queryGraph(
            conn,
            `MERGE (p:Person {id: '${DEFAULT_PERSON_ID}'})-[u:UNDERSTANDS]->(f:Function {id: '${esc(quiz.functionId)}'}) SET u.confidence = '${newConfidence}', u.source = 'quiz', u.lastAssessed = '${now}', u.needsRetest = false, u.summary_l1 = '${esc(`${DEFAULT_PERSON_NAME}: ${newConfidence} — ${quiz.functionName}`)}'`,
          );
        } catch {
          try {
            await queryGraph(
              conn,
              `MATCH (p:Person {id: '${DEFAULT_PERSON_ID}'})-[u:UNDERSTANDS]->(f:Function {id: '${esc(quiz.functionId)}'}) DELETE u`,
            );
          } catch { /* no existing edge to delete */ }

          try {
            await queryGraph(
              conn,
              `MATCH (p:Person {id: '${DEFAULT_PERSON_ID}'}), (f:Function {id: '${esc(quiz.functionId)}'}) CREATE (p)-[:UNDERSTANDS {confidence: '${newConfidence}', source: 'quiz', topics: [], lastAssessed: '${now}', needsRetest: false, summary_l1: '${esc(`${DEFAULT_PERSON_NAME}: ${newConfidence} — ${quiz.functionName}`)}', sessions_json: '[]'}]->(f)`,
            );
          } catch (err) {
            console.error("[useKnowledge] Failed to create UNDERSTANDS edge:", err);
          }
        }

        // Create Discussion node
        const discussionId = `quiz-${Date.now()}`;
        try {
          await queryGraph(
            conn,
            `CREATE (d:Discussion {id: '${discussionId}', timestamp: '${now}', transcript: '${esc(`Q: ${quiz.question}\nA: ${answer}`)}', summary_l1: '${esc(`Quiz on ${quiz.functionName}: ${result}`)}', quizResult: '${result}', confidenceBefore: '${quiz.functionName}', confidenceAfter: '${newConfidence}'})`,
          );

          try {
            await queryGraph(
              conn,
              `MATCH (d:Discussion {id: '${discussionId}'}), (p:Person {id: '${DEFAULT_PERSON_ID}'}) CREATE (d)-[:HAS_PARTICIPANT {role: 'interviewee'}]->(p)`,
            );
          } catch (err) {
            console.warn("[useKnowledge] Failed to create HAS_PARTICIPANT:", err);
          }

          try {
            await queryGraph(
              conn,
              `MATCH (d:Discussion {id: '${discussionId}'}), (f:Function {id: '${esc(quiz.functionId)}'}) CREATE (d)-[:ABOUT {focus: 'quiz'}]->(f)`,
            );
          } catch (err) {
            console.warn("[useKnowledge] Failed to create ABOUT:", err);
          }
        } catch (err) {
          console.warn("[useKnowledge] Failed to create Discussion node:", err);
        }

        // Update local scores
        const scoreVal =
          newConfidence === "deep"
            ? 1.0
            : newConfidence === "surface"
              ? 0.5
              : 0.0;
        setScores((prev) => {
          const next = new Map(prev);
          next.set(quiz.functionId, scoreVal);
          return next;
        });

        // Record history
        const historyEntry: QuizHistoryEntry = {
          functionId: quiz.functionId,
          functionName: quiz.functionName,
          question: quiz.question,
          answer,
          result,
          explanation,
          timestamp: now,
        };
        setQuizHistory((prev) => [...prev, historyEntry]);

        // Set feedback (don't clear activeQuiz — wait for nextQuestion/dismiss)
        setFeedback({
          isCorrect: result === "correct",
          explanation,
        });

        // Update session stats
        setSessionStats((prev) => ({
          questionNumber: prev.questionNumber,
          correctCount: prev.correctCount + (result === "correct" ? 1 : 0),
          streak: result === "correct" ? prev.streak + 1 : 0,
        }));

        console.log(
          `[useKnowledge] Quiz result: ${result} for ${quiz.functionName} (confidence: ${newConfidence})`,
        );

        return { result, explanation, newConfidence };
      } catch (err) {
        console.error("[useKnowledge] Failed to submit answer:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeQuiz, conn, quizHistory],
  );

  const dismissQuiz = useCallback(() => {
    setActiveQuiz(null);
    setFeedback(null);
    setSessionStats({ questionNumber: 0, correctCount: 0, streak: 0 });
  }, []);

  const nextQuestion = useCallback(() => {
    setFeedback(null);
    setActiveQuiz(null);
    startQuiz();
  }, [startQuiz]);

  return {
    scores,
    activeQuiz,
    feedback,
    sessionStats,
    quizHistory,
    isLoading,
    startQuiz,
    submitAnswer,
    dismissQuiz,
    nextQuestion,
    getQuizCandidates,
  };
}
