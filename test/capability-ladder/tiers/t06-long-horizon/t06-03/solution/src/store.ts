import { Product, CreateProductDTO, UpdateProductDTO } from "./types";

export class ProductStore {
  private products: Map<string, Product> = new Map();
  private nextId = 1;

  create(dto: CreateProductDTO): Product {
    const id = String(this.nextId++);
    const product: Product = { id, ...dto };
    this.products.set(id, product);
    return product;
  }

  get(id: string): Product | null {
    return this.products.get(id) || null;
  }

  list(filter?: { inStock?: boolean }): Product[] {
    const all = Array.from(this.products.values());
    if (!filter || filter.inStock === undefined) return all;
    return all.filter((p) => p.inStock === filter.inStock);
  }

  update(id: string, dto: UpdateProductDTO): Product | null {
    const existing = this.products.get(id);
    if (!existing) return null;
    const updated: Product = { ...existing, ...dto };
    this.products.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.products.delete(id);
  }
}
