import { Account } from "./account";

export class BaseEntity {
  constructor(public id: string) {}
}

export class User extends BaseEntity {
  account?: Account;

  setAccount(acc: Account) {
    this.account = acc;
  }
}
