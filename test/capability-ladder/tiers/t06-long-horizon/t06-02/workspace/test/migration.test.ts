import { expect, test, describe } from "bun:test";
import { UserDB } from "../src/db";
import { UserService } from "../src/service";
import { formatUserResponse } from "../src/api";

describe("UserV2 Migration", () => {
  test("migrates end-to-end across db, service, and api", () => {
    const db = new UserDB();
    const service = new UserService(db as any);

    const user = (service as any).createUser("usr_123", "Alice", "Smith");
    expect(user.id).toBe("usr_123");
    expect(user.firstName).toBe("Alice");
    expect(user.lastName).toBe("Smith");
    expect(user.active).toBe(true);

    const retrieved = (service as any).getUser("usr_123");
    expect(retrieved).toEqual(user);

    const response = (formatUserResponse as any)(user);
    expect(response.userId).toBe("usr_123");
    expect(response.displayName).toBe("Alice Smith");
    expect(response.active).toBe(true);
  });
});
