import { createResponse, type Request, type Response } from "./http";
import { verifyApiKey } from "./auth";

export function handleRoute(req: Request): Response {
  if (!verifyApiKey(req.headers["x-api-key"])) {
    return createResponse(401, "Unauthorized");
  }
  if (req.path === "/status") {
    return createResponse(200, "OK");
  }
  return createResponse(404, "Not Found");
}
