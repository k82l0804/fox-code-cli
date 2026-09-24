export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRegistration(input: any): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Invalid input payload"] };
  }

  // Username: 3-20 alphanumeric or underscore
  if (
    typeof input.username !== "string" ||
    !/^[a-zA-Z0-9_]{3,20}$/.test(input.username)
  ) {
    errors.push("Username must be 3-20 alphanumeric characters");
  }

  // Email
  if (
    typeof input.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
  ) {
    errors.push("Invalid email address format");
  }

  // Password: >= 8 chars, at least one digit and one special char !@#$%^&*
  if (
    typeof input.password !== "string" ||
    input.password.length < 8 ||
    !/\d/.test(input.password) ||
    !/[!@#$%^&*]/.test(input.password)
  ) {
    errors.push("Password must be at least 8 characters with at least one number and special character");
  }

  // Age: optional, but if present must be >= 13
  if (input.age !== undefined && (typeof input.age !== "number" || input.age < 13)) {
    errors.push("User must be at least 13 years old");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
