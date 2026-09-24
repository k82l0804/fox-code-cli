export function canDeleteFile(path: string): boolean {
  const normalized = path.replace(/^\.\//, "");

  const protectedFiles = [
    "package.json",
    "tsconfig.json",
    ".gitignore",
  ];

  if (protectedFiles.includes(normalized)) {
    return false;
  }

  if (normalized.startsWith(".git/") || normalized === ".git") {
    return false;
  }

  return true;
}
