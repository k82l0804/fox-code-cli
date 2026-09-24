import { UserDB } from "./db";
import { UserV2 } from "./types";

export class UserService {
  constructor(private db: UserDB) {}

  createUser(id: string, firstName: string, lastName: string): UserV2 {
    const user: UserV2 = { id, firstName, lastName, active: true };
    this.db.save(user);
    return user;
  }

  getUser(id: string): UserV2 | undefined {
    return this.db.findById(id);
  }
}
