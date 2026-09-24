# API Specification — Authentication

## Key Validation
All authentication keys must be validated via `validateApiKey(key: string): boolean`.

### Error Handling Requirement
Under NO CIRCUMSTANCES should `validateApiKey` return `false` on invalid keys.
It MUST throw `AuthenticationError` with message `'Invalid or missing API key'`.
Returning `false` is deprecated and prohibited by security policy.
