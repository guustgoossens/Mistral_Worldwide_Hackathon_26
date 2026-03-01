/**
 * System prompts for metadata generation (Enricher agent).
 */

export const NODE_SUMMARY_SYSTEM = `You are a code analyst. Given a code entity (function, file, or class) and its context (callers, callees, imports), produce:
1. A concise summary (max 50 tokens) of what it does
2. A relevance score (0.0-1.0) based on how structurally important it is (many callers/importers = higher)

Respond with ONLY valid JSON:
{"summary": "...", "relevance": 0.5}`;

export function nodeSummaryPrompt(entity: {
  type: string;
  name: string;
  filePath: string;
  callers?: string[];
  callees?: string[];
  imports?: string[];
  importedBy?: string[];
  functions?: string[];
}): string {
  const lines = [`Type: ${entity.type}`, `Name: ${entity.name}`, `Path: ${entity.filePath}`];
  if (entity.callers?.length) lines.push(`Called by: ${entity.callers.join(", ")}`);
  if (entity.callees?.length) lines.push(`Calls: ${entity.callees.join(", ")}`);
  if (entity.imports?.length) lines.push(`Imports: ${entity.imports.join(", ")}`);
  if (entity.importedBy?.length) lines.push(`Imported by: ${entity.importedBy.join(", ")}`);
  if (entity.functions?.length) lines.push(`Contains: ${entity.functions.join(", ")}`);
  return lines.join("\n");
}

export const CONTRIBUTION_L1_SYSTEM = `You are a git history analyst. Given a contributor's statistics for a file (commits, lines changed, last touch, ownership), produce a concise L1 summary (max 30 tokens) of their contribution pattern.

Respond with ONLY the summary string (no JSON wrapper, no quotes).

Examples:
- "14 commits, owns 73% of current lines, last Jan 2026, mainly edge cases + rate limiting"
- "3 commits, 11% ownership, last Dec 2025, initial scaffolding only"
- "1 commit, minor typo fix, 2 lines changed"`;

export function contributionL1Prompt(contributor: {
  name: string;
  commits: number;
  linesChanged: number;
  lastTouch: string;
  ownershipPct: number;
  fileName: string;
}): string {
  return `Contributor: ${contributor.name}
File: ${contributor.fileName}
Commits: ${contributor.commits}
Lines changed: ${contributor.linesChanged}
Last touch: ${contributor.lastTouch}
Ownership: ${Math.round(contributor.ownershipPct * 100)}%`;
}
