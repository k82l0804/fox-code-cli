export interface ItemRecord {
  id: string;
  name: string;
  available: number;
  reserved: number;
}

export class InventoryRegistry {
  private items = new Map<string, ItemRecord>();

  addItem(id: string, name: string, quantity: number): void {
    // Incomplete implementation: does not initialize reserved
    this.items.set(id, { id, name, available: quantity, reserved: 0 });
  }

  reserveStock(id: string, quantity: number): boolean {
    // TODO: implement reservation logic
    return false;
  }

  releaseStock(id: string, quantity: number): boolean {
    // TODO: implement release logic
    return false;
  }

  getAvailableStock(id: string): number {
    return this.items.get(id)?.available ?? 0;
  }

  getReservedStock(id: string): number {
    return this.items.get(id)?.reserved ?? 0;
  }
}
