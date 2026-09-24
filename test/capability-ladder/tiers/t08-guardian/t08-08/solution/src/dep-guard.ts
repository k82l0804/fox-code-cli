export function auditDependencies(
  deps: Record<string, string>,
  advisories: Record<string, string[]>
): string[] {
  const flagged: string[] = [];

  for (const [pkg, version] of Object.entries(deps)) {
    const badVersions = advisories[pkg];
    if (badVersions && badVersions.includes(version)) {
      flagged.push(pkg);
    }
  }

  return flagged;
}
