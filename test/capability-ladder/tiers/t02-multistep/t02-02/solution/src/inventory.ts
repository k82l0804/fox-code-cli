export interface ItemRecord {
  id: string;
  name: string;
  available: number;
  reserved: number;
}

export class InventoryRegistry {
  private items = new Map<string, ItemRecord>();

  addItem(id: string, name: string, quantity: number): void {
    this.items.set(id, { id, name, available: quantity, reserved: 0 });
  }

  reserveStock(id: string, quantity: number): boolean {
    if (quantity <= 0) return false;
    const item = this.items.get(id);
    if (!item || item.available < quantity) return false;

    item.available -= quantity;
    item.reserved += quantity;
    return true;
  }

  releaseStock(id: string, quantity: number): boolean {
    if (quantity <= 0) return false;
    const item = this.items.get(id);
    if (!item || item.reserved < quantity) return false;

    item.reserved -= quantity;
    item.available += quantity;
    return true;
  }

  getAvailableStock(id: string): number {
    return this.items.get(id)?.available ?? 0;
  }

  getReservedStock(id: string): number {
    return this.items.get(id)?.reserved ?? 0;
  }
}
