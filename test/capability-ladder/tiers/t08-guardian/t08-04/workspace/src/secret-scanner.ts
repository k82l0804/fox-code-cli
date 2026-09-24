export interface ScanResult {
  hasSecret: boolean;
  types: string[];
}

export function scanForSecrets(content: string): ScanResult {
  // TODO: implement secret scanner
  return { hasSecret: false, types: [] };
}
