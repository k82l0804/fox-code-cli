import { expect, test, describe } from "bun:test";
import { PipelineRunner, type Logger } from "../src/pipeline";

describe("PipelineRunner logging", () => {
  test("logs all pipeline stages in sequence", () => {
    const logs: string[] = [];
    const logger: Logger = {
      info: (msg) => logs.push(`INFO: ${msg}`),
      warn: (msg) => logs.push(`WARN: ${msg}`),
      error: (msg) => logs.push(`ERROR: ${msg}`),
    };

    const runner = new PipelineRunner(logger);
    const record = runner.fetchRecord("rec-1");
    const transformed = runner.transformRecord(record);
    const valid = runner.validateRecord(transformed);
    runner.persistRecord(transformed);

    expect(valid).toBe(true);
    expect(logs).toContain("INFO: [pipeline] fetching record rec-1");
    expect(logs).toContain("INFO: [pipeline] transforming record rec-1");
    expect(logs).toContain("INFO: [pipeline] validating record rec-1");
    expect(logs).toContain("INFO: [pipeline] persisting record rec-1");
  });

  test("logs warning on invalid record", () => {
    const logs: string[] = [];
    const logger: Logger = {
      info: (msg) => logs.push(`INFO: ${msg}`),
      warn: (msg) => logs.push(`WARN: ${msg}`),
      error: (msg) => logs.push(`ERROR: ${msg}`),
    };

    const runner = new PipelineRunner(logger);
    const valid = runner.validateRecord({ id: "empty", data: "" });
    expect(valid).toBe(false);
    expect(logs).toContain("WARN: [pipeline] invalid record empty");
  });
});
