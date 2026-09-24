export interface BackupConfig {
  source: string;
  target: string;
  dryRun: boolean;
  compression: "none" | "gzip" | "zstd";
  maxSizeMb: number;
}

export function parseArgs(args: string[]): BackupConfig {
  const sourceIdx = args.indexOf("--source");
  const targetIdx = args.indexOf("--target");

  const source = sourceIdx >= 0 ? args[sourceIdx + 1] : "";
  const target = targetIdx >= 0 ? args[targetIdx + 1] : "";

  // Incomplete: needs dryRun, compression, maxSizeMb
  return {
    source,
    target,
    dryRun: false,
    compression: "gzip",
    maxSizeMb: 1000,
  };
}

export function getHelpText(): string {
  return [
    "Usage: backup [options]",
    "  --source <dir>      Source directory",
    "  --target <dir>      Target directory",
  ].join("\n");
}
