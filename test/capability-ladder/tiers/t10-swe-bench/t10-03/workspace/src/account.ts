export class BankAccount {
  constructor(public id: string, public balance: number) {}

  // BUG: Race condition! Between reading balance and writing balance,
  // another async transfer can read the old balance.
  async withdraw(amount: number): Promise<boolean> {
    const current = this.balance;
    await new Promise((r) => setTimeout(r, 10)); // simulate async I/O
    if (current >= amount) {
      this.balance = current - amount;
      return true;
    }
    return false;
  }
}
