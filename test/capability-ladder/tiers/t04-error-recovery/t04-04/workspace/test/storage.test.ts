import { expect, test, describe } from "bun:test";
import { SecureStorage } from "../src/storage";

describe("SecureStorage with arbitrary env key lengths", () => {
  test("stores and retrieves with short key", () => {
    process.env.STORAGE_ENCRYPTION_KEY = "short-password";
    const storage = new SecureStorage();
    storage.put("k1", "my-secret-data");
    expect(storage.get("k1")).toBe("my-secret-data");
  });

  test("stores and retrieves with long key", () => {
    process.env.STORAGE_ENCRYPTION_KEY = "a-very-long-passphrase-exceeding-32-bytes-substantially-for-testing";
    const storage = new SecureStorage();
    storage.put("k2", "another-secret");
    expect(storage.get("k2")).toBe("another-secret");
  });

  test("falls back cleanly when no key is set", () => {
    delete process.env.STORAGE_ENCRYPTION_KEY;
    const storage = new SecureStorage();
    storage.put("k3", "plaintext-data");
    expect(storage.get("k3")).toBe("plaintext-data");
  });
});
