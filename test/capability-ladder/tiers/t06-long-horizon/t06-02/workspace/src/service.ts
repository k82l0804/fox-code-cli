import { UserDB } from "./db";
import { UserV1 } from "./types";

export class UserService {
  constructor(private db: UserDB) {}

  createUser(id: number, name: string): UserV1 {
    const user: UserV1 = { id, full_name: name };
    this.db.save(user);
    return user;
  }

  getUser(id: number): UserV1 | undefined {
    return this.db.findById(id);
  }
}
