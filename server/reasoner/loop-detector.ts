/**
 * Prevents semantic query repetition in the reasoning loop.
 * Adapted from HackEurope26's ToolLoopDetector.
 */

export class LoopDetector {
  private queryHashes = new Map<string, number>();
  private consecutiveEmpty = 0;

  /** Normalize a Cypher query for comparison (strip whitespace, lowercase). */
  private normalize(cypher: string): string {
    return cypher.replace(/\s+/g, " ").trim().toLowerCase();
  }

  /** Record a query execution. Returns true if the query is a repeat. */
  recordQuery(cypher: string): boolean {
    const key = this.normalize(cypher);
    const count = (this.queryHashes.get(key) ?? 0) + 1;
    this.queryHashes.set(key, count);
    return count >= 2;
  }

  /** Record whether a query returned empty results. */
  recordEmpty(isEmpty: boolean): void {
    if (isEmpty) {
      this.consecutiveEmpty++;
    } else {
      this.consecutiveEmpty = 0;
    }
  }

  /** Should the reasoning loop be forced to conclude? */
  shouldConclude(): { conclude: boolean; reason?: string } {
    if (this.consecutiveEmpty >= 3) {
      return { conclude: true, reason: "3 consecutive empty results — insufficient data" };
    }

    // Check for any query repeated 3+ times
    for (const [, count] of this.queryHashes) {
      if (count >= 3) {
        return { conclude: true, reason: "same query pattern repeated 3+ times" };
      }
    }

    return { conclude: false };
  }

  /** Reset state. */
  reset(): void {
    this.queryHashes.clear();
    this.consecutiveEmpty = 0;
  }
}
