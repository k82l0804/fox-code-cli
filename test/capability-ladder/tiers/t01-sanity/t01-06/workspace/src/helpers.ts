export function neededHelper(text: string): string {
  return text.trim().toLowerCase();
}

export function unusedHelper(): never {
  throw new Error("I am never used");
}
