import { Connection } from "./connection";

export class ConnectionPool {
  private conn: Connection;

  constructor(host: string) {
    this.conn = new Connection(host);
  }

  getConnection(): Connection {
    return this.conn;
  }
}
