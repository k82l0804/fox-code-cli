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
