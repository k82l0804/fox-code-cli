export type EntityId = string | { id: string; ns?: string };

export function parseEntityId(id: EntityId): { id: string; ns: string } {
  if (typeof id === "string") {
    return { id, ns: "default" };
  }
  return {
    id: id.id,
    ns: id.ns ?? "default",
  };
}
