export class TenantCache {
  private store: Map<string, any> = new Map();

  private makeKey(tenantId: string, entity: string): string {
    return `${tenantId}:${entity}`;
  }

  set(tenantId: string, entity: string, data: any): void {
    this.store.set(this.makeKey(tenantId, entity), data);
  }

  get(tenantId: string, entity: string): any {
    return this.store.get(this.makeKey(tenantId, entity));
  }

  invalidate(tenantId: string, entity: string): void {
    this.store.delete(this.makeKey(tenantId, entity));
  }
}
