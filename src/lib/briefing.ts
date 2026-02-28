/**
 * Pre-computed interview briefing.
 *
 * Gathers codebase context from KuzuDB, sends it to Mistral to generate
 * interview questions, and composes the final system prompt for the voice agent.
 */

export interface CodebaseContext {
  files: Array<{ name: string; filePath: string }>;
  functions: Array<{ name: string; filePath: string }>;
  classes: Array<{ name: string; filePath: string }>;
  calls: Array<{ caller: string; callee: string }>;
  imports: Array<{ importer: string; imported: string }>;
  contributors: Array<{ person: string; file: string }>;
}

export interface BriefingQuestion {
  question: string;
  groundTruth: string;
  relatedNodes: string[];
}

export interface BriefingPacket {
  questions: BriefingQuestion[];
  summary: string;
}

/**
 * Gather codebase context from KuzuDB via Cypher queries.
 */
export async function gatherContext(
  executeQuery: (cypher: string) => Promise<unknown[]>,
): Promise<CodebaseContext> {
  const [files, functions, classes, calls, imports, contributors] = await Promise.all([
    executeQuery("MATCH (f:File) RETURN f.name, f.filePath LIMIT 50").catch(() => []),
    executeQuery("MATCH (fn:Function) RETURN fn.name, fn.filePath LIMIT 100").catch(() => []),
    executeQuery("MATCH (c:Class) RETURN c.name, c.filePath LIMIT 50").catch(() => []),
    executeQuery("MATCH (a)-[r:CALLS]->(b) RETURN a.name, b.name LIMIT 100").catch(() => []),
    executeQuery("MATCH (a)-[r:IMPORTS]->(b) RETURN a.name, b.name LIMIT 100").catch(() => []),
    executeQuery("MATCH (p:Person)-[r:CONTRIBUTED]->(f:File) RETURN p.name, f.name LIMIT 100").catch(() => []),
  ]);

  return {
    files: (files as any[]).map((r) => ({ name: r["f.name"] ?? r.name ?? "", filePath: r["f.filePath"] ?? r.filePath ?? "" })),
    functions: (functions as any[]).map((r) => ({ name: r["fn.name"] ?? r.name ?? "", filePath: r["fn.filePath"] ?? r.filePath ?? "" })),
    classes: (classes as any[]).map((r) => ({ name: r["c.name"] ?? r.name ?? "", filePath: r["c.filePath"] ?? r.filePath ?? "" })),
    calls: (calls as any[]).map((r) => ({ caller: r["a.name"] ?? "", callee: r["b.name"] ?? "" })),
    imports: (imports as any[]).map((r) => ({ importer: r["a.name"] ?? "", imported: r["b.name"] ?? "" })),
    contributors: (contributors as any[]).map((r) => ({ person: r["p.name"] ?? "", file: r["f.name"] ?? "" })),
  };
}

/**
 * Send codebase context to Mistral to generate interview questions.
 */
export async function generateBriefing(
  context: CodebaseContext,
  proxyUrl: string,
): Promise<BriefingPacket> {
  const contextStr = JSON.stringify(context, null, 2);

  const systemPrompt = `You are a codebase analyst. Given the following codebase context (files, functions, classes, call graph, imports, contributors), generate 5-8 interview questions to test a developer's understanding of this codebase.

For each question, provide:
- "question": The question to ask (conversational, suitable for voice)
- "groundTruth": The correct answer based on the data
- "relatedNodes": Array of node IDs that relate to this question (format: "file:path" or "fn:path:name" or "class:path:name")

Also provide a "summary": A 2-3 sentence overview of the codebase.

Respond with valid JSON only, no markdown fences:
{
  "summary": "...",
  "questions": [
    { "question": "...", "groundTruth": "...", "relatedNodes": ["..."] }
  ]
}`;

  const response = await fetch(`${proxyUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "devstral-small-2507",
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here is the codebase context:\n\n${contextStr}` },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Briefing generation failed (${response.status}): ${err}`);
  }

  // Handle both JSON and SSE responses (Mistral may stream despite stream:false)
  const rawText = await response.text();
  let content: string;

  if (rawText.trimStart().startsWith("data: ")) {
    // SSE format — extract content from streamed chunks
    console.log("[briefing] Got SSE response, parsing chunks...");
    let assembled = "";
    for (const line of rawText.split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        const parsed = JSON.parse(line.slice(6));
        const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? "";
        assembled += delta;
      } catch {}
    }
    content = assembled;
  } else {
    // Standard JSON response
    const data = JSON.parse(rawText);
    content = data.choices?.[0]?.message?.content ?? "";
  }

  try {
    // Strip markdown fences if present
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as BriefingPacket;
  } catch {
    console.error("[briefing] Failed to parse Mistral response:", content.slice(0, 500));
    // Return a fallback
    return {
      summary: "Could not generate a codebase summary.",
      questions: [
        {
          question: "Can you walk me through the main files in this codebase?",
          groundTruth: `The codebase has ${context.files.length} files including ${context.files.slice(0, 3).map((f) => f.name).join(", ")}.`,
          relatedNodes: context.files.slice(0, 3).map((f) => `file:${f.filePath}`),
        },
      ],
    };
  }
}

/**
 * Compose the full system prompt for the voice agent from a briefing packet.
 */
export function composeBriefingPrompt(packet: BriefingPacket): string {
  const questionsBlock = packet.questions
    .map(
      (q, i) => `### Question ${i + 1}
Ask: "${q.question}"
Ground truth: ${q.groundTruth}
Related nodes: ${JSON.stringify(q.relatedNodes)}
When asking this question, call highlightNodes with the related node IDs.`,
    )
    .join("\n\n");

  return `# Personality
You are HackStral, a friendly codebase interview assistant. You speak like a knowledgeable colleague — concise, warm, and encouraging. Keep responses under 3 sentences. You're conducting an interview to assess the developer's understanding of their codebase.

# Codebase Summary
${packet.summary}

# Interview Questions
You have ${packet.questions.length} pre-prepared questions. Ask them one at a time, in order. After each answer:
1. Evaluate if the answer matches the ground truth (be generous — partial credit is fine)
2. Give brief feedback ("That's right!", "Close — actually...", "Good thinking, but...")
3. Move to the next question

${questionsBlock}

# Visualization Tools
- highlightNodes({ nodeIds: [...] }) — highlight relevant nodes when asking a question
- flyToNode({ nodeId: "..." }) — fly camera to a specific node
- switchViewMode({ mode: "structure" | "contributors" | "knowledge" | "people" }) — switch overlay

Use these to make the interview visual and engaging. Highlight related nodes before asking each question.

# Flow
1. Greet the developer briefly and tell them you have ${packet.questions.length} questions about their codebase
2. Ask Question 1 (highlight related nodes first)
3. Listen to answer, evaluate, give feedback
4. Continue through all questions
5. After the last question, give a brief overall assessment

# Voice Guidelines
- Speak naturally — this is a voice conversation
- Say file names as words: "kuzu dot tee ess" not "kuzu.ts"
- Don't dump data — summarize naturally
- Keep it conversational and encouraging
- If the developer seems stuck, give a hint based on the ground truth

# Guardrails
- Stay on topic — this is about the codebase
- Don't make up information — only use what's in the briefing
- If asked something outside the briefing, say "That's outside what I prepared, but great question"`;
}
