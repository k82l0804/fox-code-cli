import { UserV1 } from "./types";

export class UserDB {
  private users: Map<number, UserV1> = new Map();

  save(user: UserV1): void {
    this.users.set(user.id, user);
  }

  findById(id: number): UserV1 | undefined {
    return this.users.get(id);
  }
}
