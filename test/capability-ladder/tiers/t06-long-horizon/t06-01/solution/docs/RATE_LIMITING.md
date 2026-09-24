# Rate Limiting

The application uses an in-memory sliding window rate limiter to protect endpoints against abuse.

## Configuration
In `src/config.ts`, `defaultConfig.rateLimit` defines:
- `maxRequests`: Maximum number of requests allowed per window (default: 5)
- `windowMs`: Time window in milliseconds (default: 1000)

## Usage
```ts
import { RateLimiter } from './src/limiter';
import { defaultConfig } from './src/config';

const limiter = new RateLimiter(defaultConfig.rateLimit);
if (!limiter.isAllowed(req.ip)) {
  res.status(429).send("Too Many Requests");
}
```
