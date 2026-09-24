import { EntityRepo } from "./repo";

export class EntityService {
  constructor(private repo: EntityRepo) {}

  // Passes plain string
  registerUser(userId: string, name: string): void {
    this.repo.save(userId as any, name);
  }

  getUser(userId: string): string | undefined {
    return this.repo.find(userId as any);
  }
}
