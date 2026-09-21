import { describe, expect, test } from "bun:test"
import { ensureDockerRm } from "@/mcp"

describe("ensureDockerRm", () => {
  test("leaves non-docker commands untouched", () => {
    expect(ensureDockerRm("node", ["run", "index.js"])).toEqual(["run", "index.js"])
    expect(ensureDockerRm("python3", ["run.py"])).toEqual(["run.py"])
    expect(ensureDockerRm("sh", ["-c", "docker run foo"])).toEqual(["-c", "docker run foo"])
  })

  test("injects --rm after run for docker commands missing --rm", () => {
    const result = ensureDockerRm("docker", ["run", "-i", "-t", "ubuntu:latest"])
    expect(result).toEqual(["run", "--rm", "-i", "-t", "ubuntu:latest"])
  })

  test("injects --rm after run for podman commands missing --rm", () => {
    const result = ensureDockerRm("podman", ["run", "alpine"])
    expect(result).toEqual(["run", "--rm", "alpine"])
  })

  test("does not duplicate --rm if already present", () => {
    const result = ensureDockerRm("docker", ["run", "--rm", "-d", "nginx"])
    expect(result).toEqual(["run", "--rm", "-d", "nginx"])
  })

  test("leaves non-run docker subcommands untouched", () => {
    expect(ensureDockerRm("docker", ["ps", "-a"])).toEqual(["ps", "-a"])
    expect(ensureDockerRm("docker", ["exec", "-it", "mycontainer", "bash"])).toEqual([
      "exec",
      "-it",
      "mycontainer",
      "bash",
    ])
    expect(ensureDockerRm("docker", ["build", "-t", "foo", "."])).toEqual(["build", "-t", "foo", "."])
  })
})
