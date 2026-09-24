export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  retryIf?: (err: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 50;
  const backoffFactor = options.backoffFactor ?? 2;
  const retryIf = options.retryIf ?? (() => true);

  let delay = initialDelayMs;
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (attempt > maxRetries || !retryIf(err)) {
        throw err;
      }
      await sleep(delay);
      delay *= backoffFactor;
    }
  }
}
