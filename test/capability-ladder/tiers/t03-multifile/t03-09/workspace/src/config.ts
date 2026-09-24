export interface AppConfig {
  host: string;
  // Missing: timeoutMs
}

export const defaultConfig: AppConfig = {
  host: "localhost",
};
