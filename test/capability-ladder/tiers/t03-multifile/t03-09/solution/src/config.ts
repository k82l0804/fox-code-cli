export interface AppConfig {
  host: string;
  timeoutMs?: number;
}

export const defaultConfig: AppConfig = {
  host: "localhost",
  timeoutMs: 3000,
};
