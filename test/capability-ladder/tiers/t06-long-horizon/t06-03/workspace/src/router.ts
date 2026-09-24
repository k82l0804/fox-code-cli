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
  // TODO: Implement routing
  return { status: 404, body: { error: "Not found" } };
}
