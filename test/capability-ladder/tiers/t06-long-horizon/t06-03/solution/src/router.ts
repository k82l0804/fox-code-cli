import { ProductStore } from "./store";

export interface HttpRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: any;
}

export interface HttpResponse {
  status: number;
  body?: any;
}

export function handleRequest(store: ProductStore, req: HttpRequest): HttpResponse {
  const { method, path, body } = req;

  if (path === "/products") {
    if (method === "GET") {
      return { status: 200, body: store.list() };
    }
    if (method === "POST") {
      const created = store.create(body);
      return { status: 201, body: created };
    }
  }

  const idMatch = path.match(/^\/products\/([^/]+)$/);
  if (idMatch) {
    const id = idMatch[1];
    if (method === "GET") {
      const item = store.get(id);
      return item ? { status: 200, body: item } : { status: 404, body: { error: "Not found" } };
    }
    if (method === "PATCH") {
      const updated = store.update(id, body);
      return updated ? { status: 200, body: updated } : { status: 404, body: { error: "Not found" } };
    }
    if (method === "DELETE") {
      const deleted = store.delete(id);
      return deleted ? { status: 204 } : { status: 404, body: { error: "Not found" } };
    }
  }

  return { status: 404, body: { error: "Not found" } };
}
