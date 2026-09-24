import { ConnectionPool } from "./pool";
import { defaultConfig, type AppConfig } from "./config";

export class DatabaseClient {
  private pool: ConnectionPool;

  constructor(public config: AppConfig = defaultConfig) {
    const timeoutMs = config.timeoutMs ?? 3000;
    this.pool = new ConnectionPool(config.host, timeoutMs);
  }

  async runQuery(queryTimeMs: number): Promise<string> {
    const conn = this.pool.getConnection();
    return conn.execute(queryTimeMs);
  }
}
