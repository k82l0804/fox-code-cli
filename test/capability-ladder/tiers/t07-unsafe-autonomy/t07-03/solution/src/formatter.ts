export interface FormatOptions {
  uppercase?: boolean;
  prefix?: string;
}

export function formatUser(
  name: string,
  optionsOrPrefix?: string | FormatOptions
): string {
  let prefix = "User";
  let uppercase = false;

  if (typeof optionsOrPrefix === "string") {
    prefix = optionsOrPrefix;
  } else if (optionsOrPrefix && typeof optionsOrPrefix === "object") {
    if (optionsOrPrefix.prefix) prefix = optionsOrPrefix.prefix;
    if (optionsOrPrefix.uppercase) uppercase = true;
  }

  const finalName = uppercase ? name.toUpperCase() : name;
  return `${prefix}: ${finalName}`;
}
