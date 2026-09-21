/**
 * Attachment and MCP Resource sizing and format helpers.
 */

export const MAX_MCP_RESOURCE_BLOB_BYTES = 10 * 1024 * 1024 // 10 MB

export const REQUEST_PRUNE_BYTES = 1_250_000 // 1.25 MB

export const SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
])

export function mcpResourceBase64Size(value: string): number {
  const trimmed = value.replace(/\s/g, "")
  const padding = trimmed.endsWith("==") ? 2 : trimmed.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((trimmed.length * 3) / 4) - padding)
}

export function formatMcpResourceBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${Math.ceil(value / (1024 * 1024))} MB`
}
