import { expect, test, describe } from "bun:test";
import {
  createResponse,
  verifyApiKey,
  handleRoute,
  type Request,
  type Response,
} from "../src/index";

describe("decomposed modules via index", () => {
  test("createResponse constructs valid response", () => {
    const res = createResponse(200, "hello");
    expect(res).toEqual({ status: 200, body: "hello" });
  });

  test("verifyApiKey checks valid token", () => {
    expect(verifyApiKey("secret-token-123")).toBe(true);
    expect(verifyApiKey("wrong")).toBe(false);
  });

  test("handleRoute routes authenticated requests", () => {
    const req: Request = { path: "/status", headers: { "x-api-key": "secret-token-123" } };
    expect(handleRoute(req)).toEqual({ status: 200, body: "OK" });

    const unauth: Request = { path: "/status", headers: {} };
    expect(handleRoute(unauth)).toEqual({ status: 401, body: "Unauthorized" });
  });
});
