import { describe, expect, it } from "bun:test"
import {
  STRUCTURED_OUTPUT_DESCRIPTION,
  STRUCTURED_OUTPUT_SYSTEM_PROMPT,
  createStructuredOutputTool,
} from "../../src/session/prompt/structured"

describe("Structured Output", () => {
  it("exports proper description and system prompt", () => {
    expect(STRUCTURED_OUTPUT_DESCRIPTION).toContain("return your final response in the requested structured format")
    expect(STRUCTURED_OUTPUT_SYSTEM_PROMPT).toContain("You MUST use the StructuredOutput tool")
  })

  it("creates an AI tool stripped of $schema", async () => {
    let captured: unknown = null
    const t = createStructuredOutputTool({
      schema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          answer: { type: "string" },
        },
        required: ["answer"],
      },
      onSuccess: (output) => {
        captured = output
      },
    })

    expect(t.description).toBe(STRUCTURED_OUTPUT_DESCRIPTION)
    // Execute tool
    const result = await (t as any).execute({ answer: "Hello world" })
    expect(result.output).toBe("Structured output captured successfully.")
    expect(result.metadata.valid).toBe(true)
    expect(captured).toEqual({ answer: "Hello world" })
  })
})
