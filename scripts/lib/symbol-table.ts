/**
 * Dual-index symbol table for resolving function/class calls.
 * File-specific index for high-confidence lookups,
 * global reverse index for fuzzy fallback.
 */

export interface SymbolDefinition {
  nodeId: string;
  filePath: string;
  type: string; // 'Function', 'Class', 'Method'
}

export interface SymbolTable {
  add: (filePath: string, name: string, nodeId: string, type: string) => void;
  lookupExact: (filePath: string, name: string) => string | undefined;
  lookupFuzzy: (name: string) => SymbolDefinition[];
  getStats: () => { fileCount: number; globalSymbolCount: number };
  clear: () => void;
}

export function createSymbolTable(): SymbolTable {
  // File-Specific Index: FilePath → (SymbolName → NodeID)
  const fileIndex = new Map<string, Map<string, string>>();

  // Global Reverse Index: SymbolName → [Definitions]
  const globalIndex = new Map<string, SymbolDefinition[]>();

  const add = (filePath: string, name: string, nodeId: string, type: string) => {
    if (!fileIndex.has(filePath)) {
      fileIndex.set(filePath, new Map());
    }
    fileIndex.get(filePath)!.set(name, nodeId);

    if (!globalIndex.has(name)) {
      globalIndex.set(name, []);
    }
    globalIndex.get(name)!.push({ nodeId, filePath, type });
  };

  const lookupExact = (filePath: string, name: string): string | undefined => {
    return fileIndex.get(filePath)?.get(name);
  };

  const lookupFuzzy = (name: string): SymbolDefinition[] => {
    return globalIndex.get(name) || [];
  };

  const getStats = () => ({
    fileCount: fileIndex.size,
    globalSymbolCount: globalIndex.size,
  });

  const clear = () => {
    fileIndex.clear();
    globalIndex.clear();
  };

  return { add, lookupExact, lookupFuzzy, getStats, clear };
}
