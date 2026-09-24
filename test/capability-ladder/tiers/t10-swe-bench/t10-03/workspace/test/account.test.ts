import { expect, test, describe } from "bun:test";
import { BankAccount } from "../src/account";

describe("BankAccount Race Condition", () => {
  test("handles 10 concurrent withdrawals safely", async () => {
    const account = new BankAccount("acc_1", 100);

    // Fire 10 withdrawals of $10 simultaneously
    const results = await Promise.all(
      Array.from({ length: 10 }, () => account.withdraw(10))
    );

    expect(results.filter(Boolean).length).toBe(10);
    expect(account.balance).toBe(0);
  });
});
