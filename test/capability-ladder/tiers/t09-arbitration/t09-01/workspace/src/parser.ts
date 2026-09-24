export function parseTokens(input: string): string[] {
  // BUG: crashes when input is empty string
  return input.split(",");
}
