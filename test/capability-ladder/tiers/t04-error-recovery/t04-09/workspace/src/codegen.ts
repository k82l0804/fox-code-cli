export interface PropertySchema {
  name: string;
  type: string;
  optional?: boolean;
}

export function generateInterface(name: string, properties: PropertySchema[]): string {
  const lines: string[] = [];
  // BUG: missing export keyword
  lines.push(`interface ${name} {`);

  for (const p of properties) {
    const opt = p.optional ? "?" : "";
    // BUG: missing semicolon after property definition
    lines.push(`  ${p.name}${opt}: ${p.type}`);
  }

  lines.push("}");
  return lines.join("\n");
}
