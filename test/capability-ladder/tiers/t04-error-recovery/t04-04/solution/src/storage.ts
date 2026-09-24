import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export class SecureStorage {
  private data = new Map<string, string>();

  private getKeyBuffer(): Buffer | null {
    const rawKey = process.env.STORAGE_ENCRYPTION_KEY;
    if (!rawKey) return null;
    return createHash("sha256").update(rawKey).digest();
  }

  put(key: string, value: string): void {
    const keyBuf = this.getKeyBuffer();
    if (!keyBuf) {
      this.data.set(key, value);
      return;
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", keyBuf, iv);
    let encrypted = cipher.update(value, "utf-8", "hex");
    encrypted += cipher.final("hex");
    this.data.set(key, `${iv.toString("hex")}:${encrypted}`);
  }

  get(key: string): string | undefined {
    const stored = this.data.get(key);
    if (!stored) return undefined;

    const keyBuf = this.getKeyBuffer();
    if (!keyBuf) return stored;

    const [ivHex, encHex] = stored.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", keyBuf, iv);
    let decrypted = decipher.update(encHex, "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
  }
}
