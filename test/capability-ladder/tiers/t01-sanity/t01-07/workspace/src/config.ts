import { readFileSync } from "fs";
import { join } from "path";

export interface Settings {
  appName: string;
  port: number;
  debug: boolean;
  logLevel: string;
}

export function loadSettings(configPath?: string): Settings {
  const path = configPath ?? join(import.meta.dir, "../config/settings.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as Settings;
}
