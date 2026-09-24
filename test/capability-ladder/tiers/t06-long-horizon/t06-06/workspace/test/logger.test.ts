import { expect, test, describe } from "bun:test";
import { startApp } from "../src/app";
import { Logger } from "../packages/logger/src/index";

describe("Internal Logger Package", () => {
  test("formats logs correctly", () => {
    const logger = new Logger();
    expect(logger.formatLog("info", "Server running")).toBe("[INFO] Server running");
    expect(logger.formatLog("error", "Failed connect")).toBe("[ERROR] Failed connect");
  });

  test("app starts and returns initialization log", () => {
    const out = startApp();
    expect(out).toContain("[INFO]");
    expect(out).toContain("Application started");
  });
});
