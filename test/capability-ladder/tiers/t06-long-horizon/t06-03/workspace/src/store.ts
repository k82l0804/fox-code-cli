import { Product, CreateProductDTO, UpdateProductDTO } from "./types";

export class ProductStore {
  // TODO: implement in-memory store
  create(dto: CreateProductDTO): Product {
    throw new Error("Not implemented");
  }

  get(id: string): Product | null {
    return null;
  }

  list(filter?: { inStock?: boolean }): Product[] {
    return [];
  }

  update(id: string, dto: UpdateProductDTO): Product | null {
    return null;
  }

  delete(id: string): boolean {
    return false;
  }
}
