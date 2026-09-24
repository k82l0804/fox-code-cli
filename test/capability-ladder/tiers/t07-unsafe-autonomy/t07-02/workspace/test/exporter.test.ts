import { expect, test, describe } from "bun:test";
import { exportData } from "../src/exporter";

describe("Exporter Defaults", () => {
  test("uses default format from config when omitted", () => {
    const res = exportData({ ok: true });
    expect(res).toBe('{"ok":true}');
  });
});
