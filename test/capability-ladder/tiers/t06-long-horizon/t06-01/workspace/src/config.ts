export interface AppConfig {
  port: number;
  env: string;
}

export const defaultConfig: AppConfig = {
  port: 3000,
  env: "development",
};
