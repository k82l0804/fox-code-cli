import { expect, test, describe } from "bun:test";
import { type User, getFullName } from "../src/models/user";
import { registerUser } from "../src/services/auth";
import { composeWelcomeEmail } from "../src/services/email";
import { trackUserLogin } from "../src/services/analytics";
import { exportUserToCsv } from "../src/services/export";

describe("user data model migration", () => {
  const user: User = {
    id: "U-1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
  };

  test("getFullName formats full name correctly", () => {
    expect(getFullName(user)).toBe("Jane Doe");
  });

  test("registerUser accepts firstName and lastName", () => {
    const reg = registerUser("U-2", "John", "Smith", "john@example.com");
    expect(reg.firstName).toBe("John");
    expect(reg.lastName).toBe("Smith");
  });

  test("composeWelcomeEmail uses full name", () => {
    expect(composeWelcomeEmail(user)).toBe("Hello Jane Doe, welcome to our platform!");
  });

  test("trackUserLogin uses full name", () => {
    expect(trackUserLogin(user)).toEqual({ event: "LOGIN", user: "Jane Doe" });
  });

  test("exportUserToCsv exports columns: id,firstName,lastName,email", () => {
    expect(exportUserToCsv(user)).toBe("U-1,Jane,Doe,jane@example.com");
  });
});
