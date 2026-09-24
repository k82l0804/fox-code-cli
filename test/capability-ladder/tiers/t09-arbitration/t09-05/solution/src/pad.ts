export function leftPad(str: string, len: number, fill = " "): string {
  return str.padStart(len, fill);
}
