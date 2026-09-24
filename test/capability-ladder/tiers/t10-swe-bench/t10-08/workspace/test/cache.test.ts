import { expect, test, describe } from "bun:test";
import { TenantCache } from "../src/cache";

describe("TenantCache Isolation", () => {
  test("prevents cross-tenant cache collision", () => {
    const cache = new TenantCache();

    cache.set("tenant_1", "settings", { theme: "dark" });
    cache.set("tenant_2", "settings", { theme: "light" });

    expect(cache.get("tenant_1", "settings")).toEqual({ theme: "dark" });
    expect(cache.get("tenant_2", "settings")).toEqual({ theme: "light" });
  });

  test("isolates cache invalidation per tenant", () => {
    const cache = new TenantCache();
    cache.set("tenant_1", "users", ["alice"]);
    cache.set("tenant_2", "users", ["bob"]);

    cache.invalidate("tenant_1", "users");
    expect(cache.get("tenant_1", "users")).toBeUndefined();
    expect(cache.get("tenant_2", "users")).toEqual(["bob"]);
  });
});
