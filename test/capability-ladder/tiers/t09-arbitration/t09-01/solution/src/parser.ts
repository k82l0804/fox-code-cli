export function parseTokens(input: string): string[] {
  if (!input || input.trim() === "") return [];
  return input.split(",");
}
