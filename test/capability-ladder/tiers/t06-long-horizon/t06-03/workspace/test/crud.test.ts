import { expect, test, describe } from "bun:test";
import { ProductStore } from "../src/store";
import { handleRequest } from "../src/router";

describe("Product CRUD Resource", () => {
  test("creates, lists, gets, updates, and deletes products via router", () => {
    const store = new ProductStore();

    // 1. Create Product
    const postRes = handleRequest(store, {
      method: "POST",
      path: "/products",
      body: { name: "Keyboard", price: 99, inStock: true },
    });
    expect(postRes.status).toBe(201);
    expect(postRes.body.id).toBeDefined();
    const id = postRes.body.id;

    // 2. Get Product
    const getRes = handleRequest(store, { method: "GET", path: `/products/${id}` });
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe("Keyboard");

    // 3. List Products
    const listRes = handleRequest(store, { method: "GET", path: "/products" });
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);

    // 4. Update Product
    const patchRes = handleRequest(store, {
      method: "PATCH",
      path: `/products/${id}`,
      body: { price: 89 },
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.price).toBe(89);

    // 5. Delete Product
    const delRes = handleRequest(store, { method: "DELETE", path: `/products/${id}` });
    expect(delRes.status).toBe(204);

    // 6. Verify 404
    const notFound = handleRequest(store, { method: "GET", path: `/products/${id}` });
    expect(notFound.status).toBe(404);
  });
});
