export function deduplicateNumbers(nums: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    const item = nums[i];
    if (result.indexOf(item) === -1) {
      result.push(item);
    }
  }
  return result;
}
