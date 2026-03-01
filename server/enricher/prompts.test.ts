import { describe, it, expect } from "bun:test";
import { nodeSummaryPrompt, contributionL1Prompt } from "./prompts";

// ---------------------------------------------------------------------------
// nodeSummaryPrompt
// ---------------------------------------------------------------------------

describe("nodeSummaryPrompt", () => {
  it("includes type, name, and path", () => {
    const result = nodeSummaryPrompt({ type: "function", name: "login", filePath: "src/auth.ts" });
    expect(result).toContain("Type: function");
    expect(result).toContain("Name: login");
    expect(result).toContain("Path: src/auth.ts");
  });

  it("includes optional fields only when present", () => {
    const result = nodeSummaryPrompt({
      type: "function",
      name: "login",
      filePath: "src/auth.ts",
      callers: ["useAuth", "App"],
      callees: ["hash", "validate"],
      imports: ["bcrypt"],
      importedBy: ["app.ts"],
      functions: ["helper1"],
    });

    expect(result).toContain("Called by: useAuth, App");
    expect(result).toContain("Calls: hash, validate");
    expect(result).toContain("Imports: bcrypt");
    expect(result).toContain("Imported by: app.ts");
    expect(result).toContain("Contains: helper1");
  });

  it("omits optional fields when arrays are empty", () => {
    const result = nodeSummaryPrompt({
      type: "file",
      name: "utils.ts",
      filePath: "src/lib/utils.ts",
      callers: [],
      callees: [],
      imports: [],
    });

    expect(result).not.toContain("Called by:");
    expect(result).not.toContain("Calls:");
    expect(result).not.toContain("Imports:");
  });

  it("omits optional fields when undefined", () => {
    const result = nodeSummaryPrompt({ type: "class", name: "Auth", filePath: "src/auth.ts" });

    expect(result).not.toContain("Called by:");
    expect(result).not.toContain("Calls:");
    expect(result).not.toContain("Imports:");
    expect(result).not.toContain("Imported by:");
    expect(result).not.toContain("Contains:");
  });
});

// ---------------------------------------------------------------------------
// contributionL1Prompt
// ---------------------------------------------------------------------------

describe("contributionL1Prompt", () => {
  it("formats all fields correctly", () => {
    const result = contributionL1Prompt({
      name: "Alice",
      commits: 14,
      linesChanged: 350,
      lastTouch: "2026-01-15",
      ownershipPct: 0.73,
      fileName: "auth.ts",
    });

    expect(result).toContain("Contributor: Alice");
    expect(result).toContain("File: auth.ts");
    expect(result).toContain("Commits: 14");
    expect(result).toContain("Lines changed: 350");
    expect(result).toContain("Last touch: 2026-01-15");
    expect(result).toContain("Ownership: 73%");
  });

  it("rounds ownership percentage", () => {
    const result = contributionL1Prompt({
      name: "Bob",
      commits: 3,
      linesChanged: 40,
      lastTouch: "2025-12-01",
      ownershipPct: 0.1111,
      fileName: "utils.ts",
    });

    expect(result).toContain("Ownership: 11%");
  });
});
