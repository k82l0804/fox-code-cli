export class BankAccount {
  private queue: Promise<any> = Promise.resolve();

  constructor(public id: string, public balance: number) {}

  async withdraw(amount: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.queue = this.queue.then(async () => {
        const current = this.balance;
        await new Promise((r) => setTimeout(r, 5));
        if (current >= amount) {
          this.balance = current - amount;
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }
}
