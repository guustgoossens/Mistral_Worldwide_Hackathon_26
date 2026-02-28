/**
 * Tree-sitter WASM hook for in-browser code parsing.
 *
 * TODO: Implement:
 * 1. Load web-tree-sitter WASM
 * 2. Load language grammars from public/grammars/
 * 3. Expose parse(code, language) function
 */

export function useTreeSitter() {
  // TODO: Implement tree-sitter WASM initialization
  return {
    isReady: false,
    parse: async (_code: string, _language: string) => {
      console.warn("[useTreeSitter] Not yet implemented");
      return null;
    },
  };
}
