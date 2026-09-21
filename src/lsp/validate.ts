import fs from "fs/promises"
import { createHash } from "node:crypto"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "lsp.validate" })

export async function computeSha256(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath)
  return createHash("sha256").update(content).digest("hex")
}

export async function validateBinary(filePath: string, expectedSha256?: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile() || stat.size === 0) {
      log.error("Binary validation failed: not a regular non-empty file", { filePath })
      return false
    }
    const hash = await computeSha256(filePath)
    if (expectedSha256 && hash.toLowerCase() !== expectedSha256.toLowerCase()) {
      log.error("Binary SHA-256 checksum mismatch", { filePath, expected: expectedSha256, actual: hash })
      return false
    }
    log.info("Binary validated successfully", { filePath, sha256: hash.slice(0, 16) })
    return true
  } catch (error) {
    log.error("Failed to validate binary SHA-256", { filePath, error })
    return false
  }
}
