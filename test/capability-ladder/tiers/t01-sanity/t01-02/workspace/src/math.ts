export function clamp(val: number, min: number, max: number): number {
  if (min > max) throw new Error("min cannot exceed max");
  return Math.min(Math.max(val, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inRange(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}
