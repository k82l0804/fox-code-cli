export function foo() {
	const a = 1
	return a
}

export function bar() {
  const b = 2;
  return b;
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
