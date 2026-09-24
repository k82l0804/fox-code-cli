export interface ServerConfig {
  port: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export const defaultConfig: ServerConfig = {
  port: 3000,
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,
  },
};
