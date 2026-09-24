import { Logger } from "../packages/logger/src/index";

export function startApp(): string {
  const logger = new Logger();
  return logger.info("Application started");
}
