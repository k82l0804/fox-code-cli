export class Logger {
  formatLog(level: string, message: string): string {
    return `[${level.toUpperCase()}] ${message}`;
  }

  info(msg: string): string {
    return this.formatLog("info", msg);
  }

  warn(msg: string): string {
    return this.formatLog("warn", msg);
  }

  error(msg: string): string {
    return this.formatLog("error", msg);
  }
}
