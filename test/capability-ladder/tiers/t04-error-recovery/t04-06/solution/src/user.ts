import { BaseEntity } from "./base";
import type { Account } from "./account";

export class User extends BaseEntity {
  account?: Account;

  setAccount(acc: Account) {
    this.account = acc;
  }
}
