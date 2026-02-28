/**
 * Tree-sitter repo parsing → public/data/graph.json
 *
 * Usage: bun run parse -- /path/to/repo
 *
 * 4-phase pipeline:
 * 1. File discovery — walk repo, filter by language
 * 2. Parse definitions — extract functions, classes, methods
 * 3. Import resolution — resolve import paths to file edges
 * 4. Call resolution — trace function calls with confidence scores
 *
 * Uses native tree-sitter bindings (not WASM) for speed + compatibility.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LANGUAGE_QUERIES } from './lib/queries';
import type { SupportedLanguage } from './lib/queries';
import { getLanguageFromFilename, shouldIgnoreDir, MAX_FILE_SIZE } from './lib/languages';
import { createSymbolTable } from './lib/symbol-table';

// Native tree-sitter (CJS modules)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Parser = require('tree-sitter');
const TSTypescript = require('tree-sitter-typescript');
const TSJavascript = require('tree-sitter-javascript');
const TSPython = require('tree-sitter-python');

// ===== Types =====

interface SourceFile {
  path: string;      // relative path from repo root
  content: string;
  language: SupportedLanguage;
  isTSX: boolean;
}

interface GraphJSON {
  repoPath: string;
  parsedAt: string;
  stats: {
    files: number;
    functions: number;
    classes: number;
    methods: number;
    imports: number;
    calls: number;
  };
  nodes: {
    files: Array<{ id: string; name: string; filePath: string }>;
    functions: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>;
    classes: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>;
    methods: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>;
  };
  edges: {
    contains: Array<{ source: string; target: string }>;
    calls: Array<{ source: string; target: string; confidence: number; reason: string }>;
    imports: Array<{ source: string; target: string }>;
  };
}

// ===== Built-in/noise filter =====

const BUILT_IN_NAMES = new Set([
  'console', 'log', 'warn', 'error', 'info', 'debug',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
  'JSON', 'parse', 'stringify',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
  'Map', 'Set', 'WeakMap', 'WeakSet',
  'Promise', 'resolve', 'reject', 'then', 'catch', 'finally',
  'Math', 'Date', 'RegExp', 'Error',
  'require', 'import', 'export',
  'fetch', 'Response', 'Request',
  'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext',
  'useReducer', 'useLayoutEffect', 'useImperativeHandle', 'useDebugValue',
  'createElement', 'createContext', 'createRef', 'forwardRef', 'memo', 'lazy',
  'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'some', 'every',
  'includes', 'indexOf', 'slice', 'splice', 'concat', 'join', 'split',
  'push', 'pop', 'shift', 'unshift', 'sort', 'reverse',
  'keys', 'values', 'entries', 'assign', 'freeze', 'seal',
  'hasOwnProperty', 'toString', 'valueOf',
  'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple',
  'open', 'read', 'write', 'close', 'append', 'extend', 'update',
  'super', 'type', 'isinstance', 'issubclass', 'getattr', 'setattr', 'hasattr',
  'enumerate', 'zip', 'sorted', 'reversed', 'min', 'max', 'sum', 'abs',
]);

// ===== Function node types for enclosing function detection =====

const FUNCTION_NODE_TYPES = new Set([
  'function_declaration', 'arrow_function', 'function_expression',
  'method_definition', 'generator_function_declaration',
  'function_definition', // Python
  'async_function_declaration', 'async_arrow_function',
]);

// ===== Language grammar mapping =====

function getGrammar(lang: SupportedLanguage, isTSX: boolean): any {
  switch (lang) {
    case 'typescript':
      return isTSX ? TSTypescript.tsx : TSTypescript.typescript;
    case 'javascript':
      return TSJavascript;
    case 'python':
      return TSPython;
  }
}

// ===== Main =====

const repoPath = process.argv[2];
if (!repoPath) {
  console.error('Usage: bun run parse -- /path/to/repo');
  process.exit(1);
}

const absRepoPath = path.resolve(repoPath);
if (!fs.existsSync(absRepoPath)) {
  console.error(`Repo path does not exist: ${absRepoPath}`);
  process.exit(1);
}

console.log(`[parse-repo] Parsing: ${absRepoPath}`);
const startTime = Date.now();

// ===== Phase 1: File Discovery =====

console.log('\n--- Phase 1: File Discovery ---');

function discoverFiles(rootDir: string): SourceFile[] {
  const files: SourceFile[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(rootDir, fullPath);

        // Check file size
        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_FILE_SIZE) continue;

        // Check language
        const langInfo = getLanguageFromFilename(entry.name);
        if (!langInfo) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          path: relPath,
          content,
          language: langInfo.language,
          isTSX: langInfo.isTSX,
        });
      }
    }
  }

  walk(rootDir);
  return files;
}

const sourceFiles = discoverFiles(absRepoPath);
console.log(`Found ${sourceFiles.length} source files`);

// ===== Initialize Parser =====

const parser = new Parser();

// ===== Graph output accumulators =====

const graph: GraphJSON = {
  repoPath: absRepoPath,
  parsedAt: new Date().toISOString(),
  stats: { files: 0, functions: 0, classes: 0, methods: 0, imports: 0, calls: 0 },
  nodes: { files: [], functions: [], classes: [], methods: [] },
  edges: { contains: [], calls: [], imports: [] },
};

// Add File nodes
const filePathSet = new Set<string>();
for (const file of sourceFiles) {
  const fileId = `f:${file.path}`;
  const fileName = path.basename(file.path);
  graph.nodes.files.push({ id: fileId, name: fileName, filePath: file.path });
  filePathSet.add(file.path);
}
graph.stats.files = graph.nodes.files.length;
console.log(`Created ${graph.stats.files} File nodes`);

// ===== Phase 2: Parse Definitions =====

console.log('\n--- Phase 2: Parse Definitions ---');

const symbolTable = createSymbolTable();
// Store parsed trees for reuse in phases 3 & 4
const treeCache = new Map<string, { tree: any; lang: any }>();

for (const file of sourceFiles) {
  const grammar = getGrammar(file.language, file.isTSX);
  parser.setLanguage(grammar);

  const tree = parser.parse(file.content);
  treeCache.set(file.path, { tree, lang: grammar });

  const queryStr = LANGUAGE_QUERIES[file.language];
  if (!queryStr) continue;

  let query: any;
  try {
    query = new Parser.Query(grammar, queryStr);
  } catch (err) {
    console.warn(`Query compile error for ${file.path}:`, String(err).slice(0, 200));
    continue;
  }

  const matches = query.matches(tree.rootNode);

  for (const match of matches) {
    const captureMap: Record<string, any> = {};
    for (const capture of match.captures) {
      captureMap[capture.name] = capture.node;
    }

    // Skip imports and calls (handled in phases 3 & 4)
    if (captureMap['import'] || captureMap['call']) continue;

    const nameNode = captureMap['name'];
    if (!nameNode) continue;

    const nodeName = nameNode.text;
    const defNode = captureMap['definition.function'] || captureMap['definition.class'] ||
                    captureMap['definition.interface'] || captureMap['definition.method'];
    if (!defNode) continue;

    let nodeLabel: 'Function' | 'Class' | 'Method';
    if (captureMap['definition.function']) nodeLabel = 'Function';
    else if (captureMap['definition.class'] || captureMap['definition.interface']) nodeLabel = 'Class';
    else if (captureMap['definition.method']) nodeLabel = 'Method';
    else continue;

    // Readable IDs: fn:path:name, c:path:name, m:path:name
    const prefix = nodeLabel === 'Function' ? 'fn' : nodeLabel === 'Class' ? 'c' : 'm';
    const nodeId = `${prefix}:${file.path}:${nodeName}`;
    const startLine = defNode.startPosition.row + 1; // 1-indexed
    const endLine = defNode.endPosition.row + 1;

    if (nodeLabel === 'Function') {
      graph.nodes.functions.push({ id: nodeId, name: nodeName, filePath: file.path, startLine, endLine });
      graph.stats.functions++;
    } else if (nodeLabel === 'Class') {
      graph.nodes.classes.push({ id: nodeId, name: nodeName, filePath: file.path, startLine, endLine });
      graph.stats.classes++;
    } else if (nodeLabel === 'Method') {
      graph.nodes.methods.push({ id: nodeId, name: nodeName, filePath: file.path, startLine, endLine });
      graph.stats.methods++;
    }

    // CONTAINS edge: File → node
    graph.edges.contains.push({ source: `f:${file.path}`, target: nodeId });

    // Register in symbol table
    symbolTable.add(file.path, nodeName, nodeId, nodeLabel);
  }
}

console.log(`Extracted: ${graph.stats.functions} functions, ${graph.stats.classes} classes, ${graph.stats.methods} methods`);

// ===== Phase 3: Import Resolution =====

console.log('\n--- Phase 3: Import Resolution ---');

const importMap = new Map<string, Set<string>>(); // filePath → Set<resolvedFilePath>
const seenImports = new Set<string>(); // deduplicate import edges

function resolveImportPath(currentFile: string, rawImportPath: string): string | null {
  let normalized: string;

  if (rawImportPath.startsWith('@/')) {
    // Path alias: @/ maps to src/
    normalized = path.normalize('src/' + rawImportPath.slice(2));
  } else if (rawImportPath.startsWith('.')) {
    // Relative import
    const currentDir = path.dirname(currentFile);
    normalized = path.normalize(path.join(currentDir, rawImportPath));
  } else {
    // External package — skip
    return null;
  }

  // Try extensions
  const extensions = [
    '', '.ts', '.tsx', '.js', '.jsx', '.py',
    '/index.ts', '/index.tsx', '/index.js', '/index.jsx',
  ];

  for (const ext of extensions) {
    const candidate = normalized + ext;
    if (filePathSet.has(candidate)) return candidate;
  }

  return null;
}

for (const file of sourceFiles) {
  const cached = treeCache.get(file.path);
  if (!cached) continue;

  const queryStr = LANGUAGE_QUERIES[file.language];
  if (!queryStr) continue;

  let query: any;
  try {
    query = new Parser.Query(cached.lang, queryStr);
  } catch { continue; }

  const matches = query.matches(cached.tree.rootNode);

  for (const match of matches) {
    const captureMap: Record<string, any> = {};
    for (const capture of match.captures) {
      captureMap[capture.name] = capture.node;
    }

    if (!captureMap['import']) continue;
    const sourceNode = captureMap['import.source'];
    if (!sourceNode) continue;

    const rawPath = sourceNode.text.replace(/['"]/g, '');
    const resolvedPath = resolveImportPath(file.path, rawPath);

    if (resolvedPath) {
      const importKey = `${file.path}->${resolvedPath}`;
      if (!seenImports.has(importKey)) {
        seenImports.add(importKey);
        graph.edges.imports.push({
          source: `f:${file.path}`,
          target: `f:${resolvedPath}`,
        });
        graph.stats.imports++;
      }

      // Build import map for call resolution
      if (!importMap.has(file.path)) {
        importMap.set(file.path, new Set());
      }
      importMap.get(file.path)!.add(resolvedPath);
    }
  }
}

console.log(`Resolved ${graph.stats.imports} import edges`);

// ===== Phase 4: Call Resolution =====

console.log('\n--- Phase 4: Call Resolution ---');

/**
 * Walk up AST to find the enclosing function node and return its ID.
 */
function findEnclosingFunction(node: any, filePath: string): string | null {
  let current = node.parent;

  while (current) {
    if (FUNCTION_NODE_TYPES.has(current.type)) {
      let funcName: string | null = null;
      let label = 'fn';

      if (['function_declaration', 'function_definition', 'async_function_declaration',
           'generator_function_declaration'].includes(current.type)) {
        funcName = current.childForFieldName?.('name')?.text ?? null;
      } else if (current.type === 'method_definition') {
        funcName = current.childForFieldName?.('name')?.text ?? null;
        label = 'm';
      } else if (current.type === 'arrow_function' || current.type === 'function_expression') {
        const parent = current.parent;
        if (parent?.type === 'variable_declarator') {
          funcName = parent.childForFieldName?.('name')?.text ?? null;
        }
      }

      if (funcName) {
        const nodeId = symbolTable.lookupExact(filePath, funcName);
        if (nodeId) return nodeId;
        return `${label}:${filePath}:${funcName}`;
      }
    }
    current = current.parent;
  }

  return null;
}

interface ResolveResult {
  nodeId: string;
  confidence: number;
  reason: string;
}

function resolveCallTarget(calledName: string, currentFile: string): ResolveResult | null {
  // Strategy A: Check imported files (HIGH confidence)
  const importedFiles = importMap.get(currentFile);
  if (importedFiles) {
    for (const importedFile of importedFiles) {
      const nodeId = symbolTable.lookupExact(importedFile, calledName);
      if (nodeId) {
        return { nodeId, confidence: 0.9, reason: 'import-resolved' };
      }
    }
  }

  // Strategy B: Same-file definition (HIGH confidence)
  const localNodeId = symbolTable.lookupExact(currentFile, calledName);
  if (localNodeId) {
    return { nodeId: localNodeId, confidence: 0.85, reason: 'same-file' };
  }

  // Strategy C: Fuzzy global search (LOW confidence)
  const fuzzyMatches = symbolTable.lookupFuzzy(calledName);
  if (fuzzyMatches.length > 0) {
    const confidence = fuzzyMatches.length === 1 ? 0.5 : 0.3;
    return { nodeId: fuzzyMatches[0].nodeId, confidence, reason: 'fuzzy-global' };
  }

  return null;
}

// Deduplicate call edges
const seenCalls = new Set<string>();

for (const file of sourceFiles) {
  const cached = treeCache.get(file.path);
  if (!cached) continue;

  const queryStr = LANGUAGE_QUERIES[file.language];
  if (!queryStr) continue;

  let query: any;
  try {
    query = new Parser.Query(cached.lang, queryStr);
  } catch { continue; }

  const matches = query.matches(cached.tree.rootNode);

  for (const match of matches) {
    const captureMap: Record<string, any> = {};
    for (const capture of match.captures) {
      captureMap[capture.name] = capture.node;
    }

    if (!captureMap['call']) continue;
    const nameNode = captureMap['call.name'];
    if (!nameNode) continue;

    const calledName = nameNode.text;
    if (BUILT_IN_NAMES.has(calledName)) continue;

    const resolved = resolveCallTarget(calledName, file.path);
    if (!resolved) continue;

    // Find enclosing function (caller)
    const callNode = captureMap['call'];
    const enclosingId = findEnclosingFunction(callNode, file.path);
    const sourceId = enclosingId || `f:${file.path}`;

    // Deduplicate
    const edgeKey = `${sourceId}->${resolved.nodeId}`;
    if (seenCalls.has(edgeKey)) continue;
    seenCalls.add(edgeKey);

    graph.edges.calls.push({
      source: sourceId,
      target: resolved.nodeId,
      confidence: resolved.confidence,
      reason: resolved.reason,
    });
    graph.stats.calls++;
  }
}

console.log(`Resolved ${graph.stats.calls} call edges`);

// ===== Cleanup =====

treeCache.clear();

// ===== Write Output =====

const outputDir = path.join(absRepoPath, 'public', 'data');
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, 'graph.json');
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n--- Done in ${elapsed}s ---`);
console.log(`Output: ${outputPath}`);
console.log(`Stats: ${JSON.stringify(graph.stats)}`);

const symStats = symbolTable.getStats();
console.log(`Symbol table: ${symStats.fileCount} files, ${symStats.globalSymbolCount} unique symbols`);
