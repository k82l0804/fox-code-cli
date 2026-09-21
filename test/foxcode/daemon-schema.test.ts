import { describe, expect, it } from "bun:test"
import { Daemon } from "../../src/foxcode/daemon/daemon"

describe("Daemon Schema", () => {
  describe("Network", () => {
    it("parses valid network options and sorts/deduplicates cors", () => {
      const parsed = Daemon.Network.parse({
        hostname: "127.0.0.1",
        port: 4097,
        mdns: true,
        mdnsDomain: "local",
        cors: ["http://b.com", "http://a.com", "http://b.com"],
      })
      expect(parsed.hostname).toBe("127.0.0.1")
      expect(parsed.port).toBe(4097)
      expect(parsed.mdns).toBe(true)
      expect(parsed.mdnsDomain).toBe("local")
      expect(parsed.cors).toEqual(["http://a.com", "http://b.com"])
    })

    it("rejects negative port", () => {
      expect(() =>
        Daemon.Network.parse({
          hostname: "127.0.0.1",
          port: -1,
          mdns: false,
          mdnsDomain: "",
          cors: [],
        }),
      ).toThrow()
    })
  })

  describe("State", () => {
    it("parses valid daemon state", () => {
      const state = {
        pid: 1234,
        hostname: "localhost",
        port: 4097,
        url: "http://localhost:4097",
        username: "fox",
        password: "secretpassword",
        token: "authtoken123",
        version: "0.1.0",
        startedAt: new Date().toISOString(),
        log: "/tmp/daemon.log",
        options: {
          hostname: "localhost",
          port: 4097,
          mdns: false,
          mdnsDomain: "",
          cors: [],
        },
      }
      const parsed = Daemon.State.parse(state)
      expect(parsed.pid).toBe(1234)
      expect(parsed.hostname).toBe("localhost")
      expect(parsed.url).toBe("http://localhost:4097")
    })

    it("rejects non-positive PID", () => {
      const invalid = {
        pid: 0,
        hostname: "localhost",
        port: 4097,
        url: "http://localhost:4097",
        username: "fox",
        password: "secretpassword",
        token: "authtoken123",
        version: "0.1.0",
        startedAt: new Date().toISOString(),
        log: "/tmp/daemon.log",
      }
      expect(() => Daemon.State.parse(invalid)).toThrow()
    })
  })

  describe("Status", () => {
    it("parses valid status object", () => {
      const status = {
        running: true,
        stale: false,
        file: "/tmp/daemon.json",
      }
      expect(() => Daemon.Status.parse(status)).not.toThrow()
    })
  })
})
