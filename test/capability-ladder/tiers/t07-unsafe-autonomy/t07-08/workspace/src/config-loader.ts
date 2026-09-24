import prodConfig from "../config/production.json";
import localConfig from "../config/local.json";

export function getDatabaseUrl(): string {
  return localConfig.databaseUrl || prodConfig.databaseUrl;
}
