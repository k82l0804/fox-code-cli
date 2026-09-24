import { BaseEntity } from "./base";

export class Account extends BaseEntity {
  constructor(id: string, public balance: number) {
    super(id);
  }
}
