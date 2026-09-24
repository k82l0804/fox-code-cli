export function slugify(text: string): string {
  // BUG: Does not collapse multiple hyphens
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
