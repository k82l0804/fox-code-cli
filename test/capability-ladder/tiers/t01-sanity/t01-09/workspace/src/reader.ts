export function readFileCallback(
  path: string,
  callback: (err: Error | null, data?: string) => void
): void {
  if (!path) {
    callback(new Error("Path cannot be empty"));
    return;
  }
  // Simulated file read
  callback(null, `Content of ${path}`);
}

// TODO: Implement readTextFileAsync(path: string): Promise<string>
