import { Connection } from "./connection";

export class ConnectionPool {
  private conn: Connection;

  constructor(host: string, timeoutMs: number = 3000) {
    this.conn = new Connection(host, timeoutMs);
  }

  getConnection(): Connection {
    return this.conn;
  }
}
