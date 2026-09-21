import { describe, expect, it } from "bun:test"
import {
  MAX_MCP_RESOURCE_BLOB_BYTES,
  REQUEST_PRUNE_BYTES,
  SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES,
  formatMcpResourceBytes,
  mcpResourceBase64Size,
} from "../../src/session/prompt/attachment"

describe("Prompt Attachment Helpers", () => {
  describe("mcpResourceBase64Size", () => {
    it("calculates exact decoded byte size without padding", () => {
      // 4 base64 chars -> 3 bytes (e.g. "AAAA")
      expect(mcpResourceBase64Size("AAAA")).toBe(3)
    })

    it("handles 1 padding byte '='", () => {
      // "AAA=" -> 2 bytes
      expect(mcpResourceBase64Size("AAA=")).toBe(2)
    })

    it("handles 2 padding bytes '=='", () => {
      // "AA==" -> 1 byte
      expect(mcpResourceBase64Size("AA==")).toBe(1)
    })

    it("ignores whitespace", () => {
      expect(mcpResourceBase64Size(" AA == \n")).toBe(1)
    })

    it("handles empty string", () => {
      expect(mcpResourceBase64Size("")).toBe(0)
    })
  })

  describe("formatMcpResourceBytes", () => {
    it("formats bytes under 1KB", () => {
      expect(formatMcpResourceBytes(500)).toBe("500 B")
      expect(formatMcpResourceBytes(0)).toBe("0 B")
    })

    it("formats KB under 1MB", () => {
      expect(formatMcpResourceBytes(1024)).toBe("1 KB")
      expect(formatMcpResourceBytes(1500)).toBe("2 KB")
      expect(formatMcpResourceBytes(500 * 1024)).toBe("500 KB")
    })

    it("formats MB", () => {
      expect(formatMcpResourceBytes(1024 * 1024)).toBe("1 MB")
      expect(formatMcpResourceBytes(10 * 1024 * 1024)).toBe("10 MB")
      expect(formatMcpResourceBytes(15 * 1024 * 1024)).toBe("15 MB")
    })
  })

  describe("MIME types and constants", () => {
    it("has 10MB blob ceiling and 1.25MB prune threshold", () => {
      expect(MAX_MCP_RESOURCE_BLOB_BYTES).toBe(10485760)
      expect(REQUEST_PRUNE_BYTES).toBe(1250000)
    })

    it("supports expected image and pdf MIME types", () => {
      expect(SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES.has("application/pdf")).toBe(true)
      expect(SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES.has("image/png")).toBe(true)
      expect(SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES.has("image/jpeg")).toBe(true)
      expect(SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES.has("image/gif")).toBe(true)
      expect(SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES.has("image/webp")).toBe(true)
      expect(SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES.has("text/plain")).toBe(false)
    })
  })
})
