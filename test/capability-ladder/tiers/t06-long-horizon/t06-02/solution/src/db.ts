import { UserV2 } from "./types";

export class UserDB {
  private users: Map<string, UserV2> = new Map();

  save(user: UserV2): void {
    this.users.set(user.id, user);
  }

  findById(id: string): UserV2 | undefined {
    return this.users.get(id);
  }
}
