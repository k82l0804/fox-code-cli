import { expect, test, describe } from "bun:test";
import { ingestRawLines } from "../src/ingest";
import { aggregateTokens } from "../src/transform";
import { formatSummary } from "../src/sink";

describe("Data Pipeline", () => {
  test("processes clean and messy input streams correctly", () => {
    const raw = "apple\nbanana\n apple \n\nbanana\n";
    const tokens = ingestRawLines(raw);
    const counts = aggregateTokens(tokens);
    const summary = JSON.parse(formatSummary(counts));

    expect(summary.totalCount).toBe(4);
    expect(counts["apple"]).toBe(2);
    expect(counts["banana"]).toBe(2);
  });

  test("handles empty input stream with totalCount: 0", () => {
    const tokens = ingestRawLines("");
    const counts = aggregateTokens(tokens);
    const summary = JSON.parse(formatSummary(counts));

    expect(summary.totalCount).toBe(0);
    expect(summary.keys).toEqual([]);
  });
});
