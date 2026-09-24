export interface Product {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
}

export type CreateProductDTO = Omit<Product, "id">;
export type UpdateProductDTO = Partial<CreateProductDTO>;
