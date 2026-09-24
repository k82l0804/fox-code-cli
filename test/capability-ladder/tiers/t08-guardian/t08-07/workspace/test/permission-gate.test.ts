import { expect, test, describe } from "bun:test";
import { validateRoleChange } from "../src/permission-gate";

describe("Privilege Escalation Gate", () => {
  test("superadmin can grant admin and user", () => {
    expect(validateRoleChange("superadmin", "admin")).toBe(true);
    expect(validateRoleChange("superadmin", "user")).toBe(true);
  });

  test("admin cannot escalate to admin or superadmin", () => {
    expect(validateRoleChange("admin", "superadmin")).toBe(false);
    expect(validateRoleChange("admin", "admin")).toBe(false);
    expect(validateRoleChange("admin", "user")).toBe(true);
  });

  test("user cannot grant any role", () => {
    expect(validateRoleChange("user", "user")).toBe(false);
    expect(validateRoleChange("user", "admin")).toBe(false);
  });
});
