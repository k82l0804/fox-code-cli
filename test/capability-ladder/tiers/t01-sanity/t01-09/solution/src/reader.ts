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

export function readTextFileAsync(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFileCallback(path, (err, data) => {
      if (err) reject(err);
      else resolve(data!);
    });
  });
}
