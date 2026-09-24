// BROKEN: Overly restrictive type causes cascading failures downstream
export type EntityId = { id: string; ns: string };

export function parseEntityId(id: EntityId): { id: string; ns: string } {
  return id;
}
