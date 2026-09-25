import { describe, expect, test } from "bun:test"
import { Readable } from "stream"
import { Schema } from "effect"
import {
  Parameters,
  DEFAULT_READ_LIMIT,
  MAX_BYTES,
  collect,
} from "@/tool/read"

function streamFromLines(lines: string[]): Readable {
  return Readable.from([lines.join("\n")])
}

describe("Read Tool Capping & Pagination (Phase 2F Task 2F-2)", () => {
  test("DEFAULT_READ_LIMIT is 200 lines", () => {
    expect(DEFAULT_READ_LIMIT).toBe(200)
  })

  test("MAX_BYTES hard byte cap is 50KB", () => {
    expect(MAX_BYTES).toBe(50 * 1024)
  })

  test("Parameters schema validates filePath and optional offset/limit", () => {
    const valid = { filePath: "/path/to/file.ts" }
    const decoded = Schema.decodeUnknownSync(Parameters)(valid)
    expect(decoded.filePath).toBe("/path/to/file.ts")
    expect(decoded.offset).toBeUndefined()
    expect(decoded.limit).toBeUndefined()

    const withPagination = { filePath: "/path/to/file.ts", offset: 201, limit: 100 }
    const decodedPaging = Schema.decodeUnknownSync(Parameters)(withPagination)
    expect(decodedPaging.offset).toBe(201)
    expect(decodedPaging.limit).toBe(100)
  })

  test("truncates file with >200 lines to 200 by default and calculates remaining lines and bytes", async () => {
    const totalLines = 350
    const lines = Array.from({ length: totalLines }, (_, i) => `Line ${i + 1}: const value = ${i};`)
    const result = await collect(streamFromLines(lines), { limit: DEFAULT_READ_LIMIT, offset: 1 })

    expect(result.raw.length).toBe(200)
    expect(result.more).toBe(true)
    expect(result.count).toBe(350)
    expect(result.offset).toBe(1)
    expect(result.remainingBytes).toBeGreaterThan(0)

    const remainingLines = result.count - (result.offset + result.raw.length - 1)
    expect(remainingLines).toBe(150)
    const nextOffset = result.offset + result.raw.length
    expect(nextOffset).toBe(201)
  })

  test("sequential reading with offset continues from where previous read ended", async () => {
    const totalLines = 350
    const lines = Array.from({ length: totalLines }, (_, i) => `Line ${i + 1}: const value = ${i};`)
    
    // Page 1: lines 1-200
    const page1 = await collect(streamFromLines(lines), { limit: 200, offset: 1 })
    expect(page1.raw[0]).toBe("Line 1: const value = 0;")
    expect(page1.raw[199]).toBe("Line 200: const value = 199;")
    expect(page1.more).toBe(true)

    // Page 2: lines 201-350
    const nextOffset = page1.offset + page1.raw.length
    const page2 = await collect(streamFromLines(lines), { limit: 200, offset: nextOffset })
    expect(page2.raw[0]).toBe("Line 201: const value = 200;")
    expect(page2.raw[page2.raw.length - 1]).toBe("Line 350: const value = 349;")
    expect(page2.raw.length).toBe(150)
    expect(page2.more).toBe(false)
  })

  test("enforces 50KB hard byte cap even when under 200 lines", async () => {
    // 50 lines of 1.5KB each = ~75KB total (exceeds 50KB MAX_BYTES)
    const bigLine = "A".repeat(1500)
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: ${bigLine}`)
    const result = await collect(streamFromLines(lines), { limit: 200, offset: 1 })

    expect(result.cut).toBe(true)
    expect(result.raw.length).toBeLessThan(50)
    expect(result.more).toBe(true)
    expect(result.remainingBytes).toBeGreaterThan(0)
  })
})
