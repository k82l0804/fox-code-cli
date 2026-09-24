import { expect, test, describe } from "bun:test";
import { renderProfile } from "../src/views/profile";
import { renderActivity } from "../src/views/activity";
import { renderBilling } from "../src/views/billing";
import { renderSummary } from "../src/reports/summary";
import { renderAudit } from "../src/reports/audit";

describe("multi-file date format consumers", () => {
  // Fixed timestamp: 2026-09-24 14:05:09 UTC/local
  const ts = new Date(2026, 8, 24, 14, 5, 9).getTime();

  test("profile uses YYYY/MM/DD", () => {
    expect(renderProfile({ name: "Alice", joinedAt: ts })).toBe("Alice joined on 2026/09/24");
  });

  test("activity uses YYYY-MM-DD HH:mm", () => {
    expect(renderActivity({ action: "LOGIN", timestamp: ts })).toBe("[2026-09-24 14:05] LOGIN");
  });

  test("billing uses MM/DD/YYYY", () => {
    expect(renderBilling({ id: "INV-1", dueDate: ts })).toBe("Invoice INV-1 due: 09/24/2026");
  });

  test("summary uses YYYY-MM-DD", () => {
    expect(renderSummary({ title: "Q3 Report", date: ts })).toBe("Q3 Report (2026-09-24)");
  });

  test("audit uses YYYY-MM-DD HH:mm:ss", () => {
    expect(renderAudit({ message: "System reboot", timestamp: ts })).toBe("2026-09-24 14:05:09 - System reboot");
  });
});
