export function validateEmail(email: string): boolean {
  // BUG: Only allows single 2-4 char TLD (fails on .co.uk)
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  return regex.test(email);
}
