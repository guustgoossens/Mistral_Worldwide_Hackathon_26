/**
 * Multi-step reasoning loop that follows the L0→L1→L2 progressive disclosure pattern.
 */

import type kuzu from "kuzu";
import { queryRows } from "../mcp/kuzu-server.js";
import { LoopDetector } from "./loop-detector.js";
import { reasonerSystemPrompt } from "./prompts.js";

export interface ReasoningStep {
  stepNumber: number;
  dimension: "structural" | "contribution" | "knowledge";
  level: "L0" | "L1" | "L2" | "L3";
  thought: string;
  cypher: string;
  results: unknown[];
  analysis: string;
}

export interface ReasoningResult {
  question: string;
  steps: ReasoningStep[];
  answer: string;
  nodeIds: string[];
}

interface MistralConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface AgentResponse {
  thought: string;
  dimension?: "structural" | "contribution" | "knowledge";
  level?: "L0" | "L1" | "L2" | "L3";
  cypher?: string;
  done: boolean;
  answer?: string;
  nodeIds?: string[];
}

async function callMistral(
  config: MistralConfig,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    throw new Error(`Mistral API error: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const MAX_STEPS = 8;

export async function reason(
  conn: kuzu.Connection,
  question: string,
  config: MistralConfig,
): Promise<ReasoningResult> {
  const loopDetector = new LoopDetector();
  const steps: ReasoningStep[] = [];
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: reasonerSystemPrompt() },
    { role: "user", content: `Question: ${question}\n\nBegin your reasoning. Start with L0 structural queries to understand the scope.` },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    // Check loop detector
    const loopCheck = loopDetector.shouldConclude();
    if (loopCheck.conclude) {
      messages.push({
        role: "user",
        content: `SYSTEM: Loop detected (${loopCheck.reason}). You must conclude NOW with your best answer based on the data gathered so far. Respond with done: true.`,
      });
    }

    // Call the model
    let responseText: string;
    try {
      responseText = await callMistral(config, messages);
    } catch (err) {
      console.error(`[reasoner] Step ${step} model call failed:`, err);
      break;
    }

    // Parse response
    let parsed: AgentResponse;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error(`[reasoner] Step ${step} invalid JSON:`, responseText.slice(0, 200));
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          break;
        }
      } else {
        break;
      }
    }

    messages.push({ role: "assistant", content: responseText });

    // Check if done
    if (parsed.done) {
      return {
        question,
        steps,
        answer: parsed.answer ?? "Unable to determine an answer from the available data.",
        nodeIds: parsed.nodeIds ?? [],
      };
    }

    // Execute the Cypher query
    if (!parsed.cypher) {
      messages.push({
        role: "user",
        content: "You must provide a 'cypher' query in your response, or set 'done': true with an answer.",
      });
      continue;
    }

    // Check for repeated queries
    const isRepeat = loopDetector.recordQuery(parsed.cypher);
    if (isRepeat) {
      messages.push({
        role: "user",
        content: `SYSTEM: This query is too similar to a previous one. Try a different dimension or approach, or conclude with done: true.`,
      });
      continue;
    }

    // Execute query
    let results: unknown[] = [];
    let error: string | null = null;
    try {
      results = await queryRows(conn, parsed.cypher);
    } catch (err) {
      error = String(err);
    }

    loopDetector.recordEmpty(results.length === 0 && !error);

    const stepRecord: ReasoningStep = {
      stepNumber: step,
      dimension: parsed.dimension ?? "structural",
      level: parsed.level ?? "L0",
      thought: parsed.thought,
      cypher: parsed.cypher,
      results: results.slice(0, 50), // Limit result size
      analysis: "",
    };
    steps.push(stepRecord);

    console.error(
      `[reasoner] Step ${step}: ${parsed.dimension}/${parsed.level} → ${results.length} rows${error ? ` (error: ${error})` : ""}`,
    );

    // Feed results back to the model
    const resultSummary = error
      ? `Query error: ${error}`
      : results.length === 0
        ? "Query returned 0 rows."
        : `Query returned ${results.length} rows:\n${JSON.stringify(results.slice(0, 20), null, 2)}`;

    messages.push({
      role: "user",
      content: `Step ${step} results (${parsed.dimension}/${parsed.level}):\n${resultSummary}\n\nContinue reasoning. What dimension/level should you explore next? Or if you have enough information, set done: true.`,
    });
  }

  // Ran out of steps — force conclusion
  const finalMessages = [
    ...messages,
    {
      role: "user",
      content: "SYSTEM: Maximum steps reached. Synthesize your findings into a final answer NOW. Respond with done: true.",
    },
  ];

  try {
    const finalResponse = await callMistral(config, finalMessages);
    const final = JSON.parse(finalResponse);
    return {
      question,
      steps,
      answer: final.answer ?? "Reached maximum reasoning steps without a definitive answer.",
      nodeIds: final.nodeIds ?? [],
    };
  } catch {
    return {
      question,
      steps,
      answer: "Reasoning completed but could not produce a final synthesis.",
      nodeIds: [],
    };
  }
}
