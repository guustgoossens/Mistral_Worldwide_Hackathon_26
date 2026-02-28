// === KuzuDB Schema Types ===

export type CodeNodeType = "file" | "function" | "class" | "method";

export interface FileNode {
  id: string;
  name: string;
  filePath: string;
}

export interface FunctionNode {
  id: string;
  name: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  summary_l1: string;
  summary_l2: string;
  summary_l3: string;
  structuralImportance: number;
}

export interface ClassNode {
  id: string;
  name: string;
  filePath: string;
}

// Person nodes: invisible infrastructure in KuzuDB (not rendered by default)
export interface PersonNode {
  id: string;
  name: string;
  email: string;
}

// Relationship types
export interface ContributedRel {
  commits: number;
  lastTouch: string;
  linesChanged: number;
}

export interface UnderstandsRel {
  confidence: "deep" | "surface" | "none";
  source: "quiz" | "voice_interview" | "git" | "inferred";
  topics: string[];
  lastAssessed: string;
}

export interface DiscussedRel {
  timestamp: string;
  transcript: string;
  quizResult: string;
  confidenceBefore: string;
  confidenceAfter: string;
}

// === Overlay Modes ===

export type OverlayMode = "structure" | "contributors" | "knowledge" | "people";
// structure:     code nodes only, colored by type (file/fn/class), edges = CALLS/IMPORTS
// contributors:  code nodes colored/sized by contributor activity, filter by person
// knowledge:     code nodes colored by knowledge coverage (green=deep, red=gap), filter by person
// people:        Person nodes become visible, showing human topology around code clusters

// === Visualization Types (derived from KuzuDB for react-force-graph) ===

export interface VizNode {
  id: string;
  name: string;
  type: CodeNodeType | "person"; // 'person' only visible in people overlay
  filePath?: string;
  val?: number;
  color?: string;
  // Metadata attached for display (from KuzuDB queries per overlay mode)
  contributors?: { person: string; commits: number }[];
  knowledgeScore?: number;
  summary?: string;
}

export interface VizLink {
  source: string;
  target: string;
  type: "contains" | "calls" | "imports" | "inherits" | "contributed" | "understands";
}

export interface GraphData {
  nodes: VizNode[];
  links: VizLink[];
}
