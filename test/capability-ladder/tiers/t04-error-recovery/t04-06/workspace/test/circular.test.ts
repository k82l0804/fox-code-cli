import { expect, test, describe } from "bun:test";
import { User } from "../src/user";
import { Account } from "../src/account";

describe("circular dependency resolution", () => {
  test("instantiates User and Account without inheritance error", () => {
    const user = new User("u-1");
    const account = new Account("a-1", 500);

    user.setAccount(account);

    expect(user.id).toBe("u-1");
    expect(account.id).toBe("a-1");
    expect(user.account?.balance).toBe(500);
  });
});
