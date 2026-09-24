import { expect, test, describe } from "bun:test";
import { fetchUserProfile } from "../src/fetcher";

describe("fetchUserProfile", () => {
  test("handles successful resolution", async () => {
    const res = await fetchUserProfile(async () => ({ id: "101", name: "Alice" }));
    expect(res.success).toBe(true);
    expect(res.data?.name).toBe("Alice");
    expect(res.error).toBeNull();
  });

  test("handles rejection without throwing", async () => {
    const res = await fetchUserProfile(async () => {
      throw new Error("Network timeout");
    });
    expect(res.success).toBe(false);
    expect(res.data).toBeNull();
    expect(res.error).toBe("Network timeout");
  });
});
