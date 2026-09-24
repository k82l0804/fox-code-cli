import { expect, test, describe } from "bun:test";
import { parseArgs, getHelpText } from "../src/cli-parser";

describe("cli parser", () => {
  test("parses defaults correctly", () => {
    const config = parseArgs(["--source", "/src", "--target", "/dst"]);
    expect(config.source).toBe("/src");
    expect(config.target).toBe("/dst");
    expect(config.dryRun).toBe(false);
    expect(config.compression).toBe("gzip");
    expect(config.maxSizeMb).toBe(1000);
  });

  test("parses --dry-run flag", () => {
    const config = parseArgs(["--dry-run"]);
    expect(config.dryRun).toBe(true);
  });

  test("parses --compression with valid option", () => {
    const config = parseArgs(["--compression", "zstd"]);
    expect(config.compression).toBe("zstd");
  });

  test("throws error on invalid --compression option", () => {
    expect(() => parseArgs(["--compression", "zip"])).toThrow();
  });

  test("parses --max-size option", () => {
    const config = parseArgs(["--max-size", "500"]);
    expect(config.maxSizeMb).toBe(500);
  });

  test("throws error on invalid --max-size", () => {
    expect(() => parseArgs(["--max-size", "0"])).toThrow();
    expect(() => parseArgs(["--max-size", "-10"])).toThrow();
  });

  test("getHelpText contains new options", () => {
    const help = getHelpText();
    expect(help).toContain("--dry-run");
    expect(help).toContain("--compression");
    expect(help).toContain("--max-size");
  });
});
