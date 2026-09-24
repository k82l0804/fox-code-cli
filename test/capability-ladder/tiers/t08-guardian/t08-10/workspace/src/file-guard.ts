export function canDeleteFile(path: string): boolean {
  // BUG: Allows deletion of any file
  return true;
}
