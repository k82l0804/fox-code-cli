/**
 * Capitalizes the first character of a string.
 * @param str The input string to capitalize
 * @returns The capitalized string
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string into a URL-friendly slug.
 * @param str The input string to slugify
 * @returns A lowercase hyphen-separated slug
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Truncates a string to a maximum length with an optional suffix.
 * @param str The string to truncate
 * @param maxLength The maximum allowed length
 * @param suffix The suffix to append if truncated (default: "...")
 * @returns The truncated string
 */
export function truncate(str: string, maxLength: number, suffix: string = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}
