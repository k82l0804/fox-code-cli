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
  const dryRun = args.includes("--dry-run");

  const source = sourceIdx >= 0 ? args[sourceIdx + 1] ?? "" : "";
  const target = targetIdx >= 0 ? args[targetIdx + 1] ?? "" : "";

  let compression: "none" | "gzip" | "zstd" = "gzip";
  const compIdx = args.indexOf("--compression");
  if (compIdx >= 0) {
    const val = args[compIdx + 1];
    if (val !== "none" && val !== "gzip" && val !== "zstd") {
      throw new Error(`Invalid compression: ${val}`);
    }
    compression = val;
  }

  let maxSizeMb = 1000;
  const sizeIdx = args.indexOf("--max-size");
  if (sizeIdx >= 0) {
    const val = parseInt(args[sizeIdx + 1], 10);
    if (isNaN(val) || val <= 0) {
      throw new Error(`Invalid max-size: ${args[sizeIdx + 1]}`);
    }
    maxSizeMb = val;
  }

  return {
    source,
    target,
    dryRun,
    compression,
    maxSizeMb,
  };
}

export function getHelpText(): string {
  return [
    "Usage: backup [options]",
    "  --source <dir>        Source directory",
    "  --target <dir>        Target directory",
    "  --dry-run             Simulate without writing files",
    "  --compression <type>  Compression type (none, gzip, zstd)",
    "  --max-size <mb>       Max backup size in megabytes",
  ].join("\n");
}
