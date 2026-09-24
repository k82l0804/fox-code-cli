import { type EntityId, parseEntityId } from "./types";

export class EntityRepo {
  private data = new Map<string, string>();

  save(entityId: EntityId, value: string): void {
    const parsed = parseEntityId(entityId);
    this.data.set(`${parsed.ns}:${parsed.id}`, value);
  }

  find(entityId: EntityId): string | undefined {
    const parsed = parseEntityId(entityId);
    return this.data.get(`${parsed.ns}:${parsed.id}`);
  }
}
