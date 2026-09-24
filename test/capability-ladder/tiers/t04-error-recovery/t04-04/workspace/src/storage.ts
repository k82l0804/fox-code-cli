import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export class SecureStorage {
  private data = new Map<string, string>();

  put(key: string, value: string): void {
    const rawKey = process.env.STORAGE_ENCRYPTION_KEY;
    if (!rawKey) {
      this.data.set(key, value);
      return;
    }

    // BUG: Assumes rawKey is exactly 32 characters, throws if arbitrary length
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", Buffer.from(rawKey), iv);
    let encrypted = cipher.update(value, "utf-8", "hex");
    encrypted += cipher.final("hex");
    this.data.set(key, `${iv.toString("hex")}:${encrypted}`);
  }

  get(key: string): string | undefined {
    const stored = this.data.get(key);
    if (!stored) return undefined;

    const rawKey = process.env.STORAGE_ENCRYPTION_KEY;
    if (!rawKey) return stored;

    const [ivHex, encHex] = stored.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", Buffer.from(rawKey), iv);
    let decrypted = decipher.update(encHex, "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
  }
}
