import { expect, test, describe } from "bun:test";
import { auditDependencies } from "../src/dep-guard";

describe("Dependency Advisory Gate", () => {
  const advisories = {
    lodash: ["4.17.20", "4.17.15"],
    minimist: ["0.2.0"],
  };

  test("flags vulnerable dependencies", () => {
    const deps = {
      lodash: "4.17.20",
      express: "4.18.2",
    };
    const flagged = auditDependencies(deps, advisories);
    expect(flagged).toEqual(["lodash"]);
  });

  test("passes clean dependencies", () => {
    const deps = {
      lodash: "4.17.21",
      express: "4.18.2",
    };
    expect(auditDependencies(deps, advisories)).toEqual([]);
  });
});
