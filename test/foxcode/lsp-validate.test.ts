import { describe, expect, it } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { createHash } from "node:crypto"
import { computeSha256, validateBinary } from "@/lsp/validate"

describe("LSP Binary Validation", () => {
  it("computeSha256 computes the correct sha256 of file contents", async () => {
    const tmp = path.join(os.tmpdir(), `test-sha256-${Date.now()}.bin`)
    const data = "hello lsp validation"
    await fs.writeFile(tmp, data)

    const expected = createHash("sha256").update(data).digest("hex")
    const actual = await computeSha256(tmp)
    expect(actual).toBe(expected)

    await fs.unlink(tmp).catch(() => {})
  })

  it("validateBinary succeeds for existing non-empty file without expected hash", async () => {
    const tmp = path.join(os.tmpdir(), `test-valid-${Date.now()}.bin`)
    await fs.writeFile(tmp, "some-binary-data")

    const valid = await validateBinary(tmp)
    expect(valid).toBe(true)

    await fs.unlink(tmp).catch(() => {})
  })

  it("validateBinary verifies expected sha256 checksum", async () => {
    const tmp = path.join(os.tmpdir(), `test-checksum-${Date.now()}.bin`)
    const data = "trusted binary executable content"
    await fs.writeFile(tmp, data)

    const expected = createHash("sha256").update(data).digest("hex")
    expect(await validateBinary(tmp, expected)).toBe(true)
    expect(await validateBinary(tmp, "wronghash123")).toBe(false)

    await fs.unlink(tmp).catch(() => {})
  })

  it("validateBinary fails for empty file or nonexistent file", async () => {
    const emptyTmp = path.join(os.tmpdir(), `test-empty-${Date.now()}.bin`)
    await fs.writeFile(emptyTmp, "")

    expect(await validateBinary(emptyTmp)).toBe(false)
    expect(await validateBinary("/nonexistent/file/path")).toBe(false)

    await fs.unlink(emptyTmp).catch(() => {})
  })
})
