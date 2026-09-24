export class TenantCache {
  private store: Map<string, any> = new Map();

  // BUG: ignores tenantId in key construction!
  set(tenantId: string, entity: string, data: any): void {
    this.store.set(entity, data);
  }

  get(tenantId: string, entity: string): any {
    return this.store.get(entity);
  }

  invalidate(tenantId: string, entity: string): void {
    this.store.delete(entity);
  }
}
