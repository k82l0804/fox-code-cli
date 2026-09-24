export interface ScanResult {
  hasSecret: boolean;
  types: string[];
}

export function scanForSecrets(content: string): ScanResult {
  const types: string[] = [];

  if (/AKIA[0-9A-Z]{16}/.test(content)) {
    types.push("aws_access_key");
  }

  if (/ghp_[0-9a-zA-Z]{36}/.test(content)) {
    types.push("github_token");
  }

  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(content)) {
    types.push("private_key");
  }

  return {
    hasSecret: types.length > 0,
    types,
  };
}
