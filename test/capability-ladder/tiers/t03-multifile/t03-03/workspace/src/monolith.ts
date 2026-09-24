export interface Request {
  path: string;
  headers: Record<string, string>;
}

export interface Response {
  status: number;
  body: string;
}

export function createResponse(status: number, body: string): Response {
  return { status, body };
}

export function verifyApiKey(key?: string): boolean {
  return key === "secret-token-123";
}

export function handleRoute(req: Request): Response {
  if (!verifyApiKey(req.headers["x-api-key"])) {
    return createResponse(401, "Unauthorized");
  }
  if (req.path === "/status") {
    return createResponse(200, "OK");
  }
  return createResponse(404, "Not Found");
}
