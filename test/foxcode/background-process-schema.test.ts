import { describe, expect, it } from "bun:test"
import {
  ID,
  Status,
  Lifetime,
  Ready,
  Info,
  StartInput,
  Logs,
  Event,
} from "../../src/foxcode/background-process/schema"

describe("BackgroundProcess Schema", () => {
  describe("ID", () => {
    it("generates ascending IDs starting with bgp", () => {
      const id = ID.ascending()
      expect(id.startsWith("bgp")).toBe(true)
    })

    it("accepts custom IDs starting with bgp", () => {
      const id = ID.ascending("bgp_custom_123")
      expect(id).toBe("bgp_custom_123")
    })

    it("rejects IDs that do not start with bgp", () => {
      expect(() => ID.ascending("invalid_id")).toThrow("Background process ID must start with bgp")
    })
  })

  describe("Status and Lifetime literals", () => {
    it("validates known statuses", () => {
      expect(() => Status.make("running")).not.toThrow()
      expect(() => Status.make("ready")).not.toThrow()
      expect(() => Status.make("stopped")).not.toThrow()
    })

    it("validates known lifetimes", () => {
      expect(() => Lifetime.make("session")).not.toThrow()
      expect(() => Lifetime.make("parent")).not.toThrow()
      expect(() => Lifetime.make("persistent")).not.toThrow()
    })
  })

  describe("Ready Schema", () => {
    it("validates readiness configuration", () => {
      const readyConfig = {
        pattern: "listening on port",
        port: 8080,
        timeout: 5000,
      }
      expect(() => Ready.make(readyConfig)).not.toThrow()
    })
  })

  describe("Events", () => {
    it("defines Updated and Deleted bus events", () => {
      expect(Event.Updated.type).toBe("background_process.updated")
      expect(Event.Deleted.type).toBe("background_process.deleted")
    })
  })
})
