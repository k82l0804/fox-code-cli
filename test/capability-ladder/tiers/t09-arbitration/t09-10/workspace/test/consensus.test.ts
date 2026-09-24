import { expect, test, describe } from "bun:test";
import { resolveConsensus } from "../src/consensus";

describe("Consensus Arbitration", () => {
  test("resolves 2-to-1 majority", () => {
    expect(resolveConsensus(["fixA", "fixB", "fixA"])).toBe("fixA");
    expect(resolveConsensus(["opt1", "opt2", "opt2"])).toBe("opt2");
  });

  test("falls back to first candidate on 3-way disagreement", () => {
    expect(resolveConsensus(["cand1", "cand2", "cand3"])).toBe("cand1");
  });
});
