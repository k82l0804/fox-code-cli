import { BaseEntity } from "./user";

// Fails at runtime if user.ts imports account.ts first (BaseEntity is undefined)
export class Account extends BaseEntity {
  constructor(id: string, public balance: number) {
    super(id);
  }
}
