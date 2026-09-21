import { describe, expect, it } from "bun:test"
import {
  parseCommandArgs,
  interpolateCommandTemplate,
  CommandInput,
} from "../../src/session/prompt/command"

describe("Prompt Command Helpers", () => {
  describe("parseCommandArgs", () => {
    it("splits unquoted whitespace arguments", () => {
      expect(parseCommandArgs("foo bar baz")).toEqual(["foo", "bar", "baz"])
    })

    it("preserves double-quoted arguments", () => {
      expect(parseCommandArgs('foo "bar baz" qux')).toEqual(["foo", "bar baz", "qux"])
    })

    it("preserves single-quoted arguments", () => {
      expect(parseCommandArgs("foo 'bar baz' qux")).toEqual(["foo", "bar baz", "qux"])
    })

    it("preserves [Image N] token", () => {
      expect(parseCommandArgs("inspect [Image 1] carefully")).toEqual(["inspect", "[Image 1]", "carefully"])
    })

    it("returns empty array for empty string", () => {
      expect(parseCommandArgs("")).toEqual([])
    })
  })

  describe("interpolateCommandTemplate", () => {
    it("replaces positional placeholders $1, $2", () => {
      const template = "Review $1 and test $2"
      const result = interpolateCommandTemplate(template, ["src/index.ts", "unit"], "src/index.ts unit")
      expect(result).toBe("Review src/index.ts and test unit")
    })

    it("collects remaining arguments on the last placeholder", () => {
      const template = "Run $1 with extra $2"
      const result = interpolateCommandTemplate(template, ["build", "flag1", "flag2"], "build flag1 flag2")
      expect(result).toBe("Run build with extra flag1 flag2")
    })

    it("replaces $ARGUMENTS placeholder", () => {
      const template = "Execute with all: $ARGUMENTS"
      const result = interpolateCommandTemplate(template, ["a", "b", "c"], "a b c")
      expect(result).toBe("Execute with all: a b c")
    })

    it("appends arguments when template has no placeholders", () => {
      const template = "Please analyze the code"
      const result = interpolateCommandTemplate(template, ["src/app.ts"], "src/app.ts")
      expect(result).toBe("Please analyze the code\n\nsrc/app.ts")
    })
  })

  describe("CommandInput Schema", () => {
    it("validates valid command input", () => {
      const valid = {
        sessionID: "sess-123",
        command: "review",
        arguments: "src/",
      }
      expect(() => CommandInput.make(valid as any)).not.toThrow()
    })
  })
})
