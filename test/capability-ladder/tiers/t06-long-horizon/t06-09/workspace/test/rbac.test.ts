import { expect, test, describe } from "bun:test";
import { hasPermission, createRouteGuard, Role } from "../src/rbac";

describe("RBAC System", () => {
  test("role hierarchy permissions work correctly", () => {
    expect(hasPermission("admin", "admin")).toBe(true);
    expect(hasPermission("admin", "editor")).toBe(true);
    expect(hasPermission("admin", "viewer")).toBe(true);

    expect(hasPermission("editor", "admin")).toBe(false);
    expect(hasPermission("editor", "editor")).toBe(true);
    expect(hasPermission("editor", "viewer")).toBe(true);

    expect(hasPermission("viewer", "editor")).toBe(false);
    expect(hasPermission("viewer", "viewer")).toBe(true);
  });

  test("route guard handles unauthenticated, unauthorized, and authorized requests", () => {
    const editorGuard = createRouteGuard("editor");

    const noAuth = editorGuard(undefined);
    expect(noAuth.allowed).toBe(false);
    expect(noAuth.statusCode).toBe(401);

    const viewerUser = editorGuard({ role: "viewer" });
    expect(viewerUser.allowed).toBe(false);
    expect(viewerUser.statusCode).toBe(403);

    const editorUser = editorGuard({ role: "editor" });
    expect(editorUser.allowed).toBe(true);
    expect(editorUser.statusCode).toBe(200);

    const adminUser = editorGuard({ role: "admin" });
    expect(adminUser.allowed).toBe(true);
    expect(adminUser.statusCode).toBe(200);
  });
});
