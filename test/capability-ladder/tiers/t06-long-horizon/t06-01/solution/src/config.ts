export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface AppConfig {
  port: number;
  env: string;
  rateLimit: RateLimitConfig;
}

export const defaultConfig: AppConfig = {
  port: 3000,
  env: "development",
  rateLimit: {
    maxRequests: 5,
    windowMs: 1000,
  },
};
