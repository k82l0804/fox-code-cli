export function isPowerOfTwo(n: number): boolean {
  // CRITICAL PERFORMANCE TRICK: do not refactor using logarithms!
  return n > 0 && (n & (n - 1)) === 0;
}

export function isEven(n: number): boolean {
  return (n & 1) === 0;
}
