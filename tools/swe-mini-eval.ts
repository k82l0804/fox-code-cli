#!/usr/bin/env bun
/**
 * swe-mini-eval.ts — Automated Autonomous SWE Challenge Runner
 * Evaluates Fox, Aider, and Goose on the 12 SWE-bench Mini Challenge Tasks.
 */
import { SWE_BENCH_MINI_TASKS } from "../test/corpora/swe-bench-mini/tasks"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync, spawn } from "node:child_process"

const WORKSPACE = join(import.meta.dir, "..")
const EXT_REPO = join(WORKSPACE, "..", "ext-repo")
const AIDER_BIN = join(EXT_REPO, "agent-cli", "aider", ".venv", "bin", "aider")
const GOOSE_BIN = join(process.env.HOME || "", ".local", "bin", "goose")
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "http://localhost:8000/v1"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "local-dev"
const EVAL_BASE = "/tmp/swe-eval"

const args = process.argv.slice(2)
const agentArg = args.find((a, i) => args[i - 1] === "--agent") || "fox"
const modelArg = args.find((a, i) => args[i - 1] === "--model") || "llama-3.1"
const taskId = args.find((a, i) => args[i - 1] === "--task") || ""
const runAll = args.includes("--all")
const timeoutSec = parseInt(args.find((a, i) => args[i - 1] === "--timeout") || "120", 10)

const tasksToRun = runAll
  ? SWE_BENCH_MINI_TASKS
  : taskId
    ? SWE_BENCH_MINI_TASKS.filter((t) => t.id === taskId)
    : [SWE_BENCH_MINI_TASKS[0]]

if (tasksToRun.length === 0) {
  console.error(`Task ${taskId} not found. Available tasks:`)
  SWE_BENCH_MINI_TASKS.forEach((t) => console.error(`  - ${t.id}: ${t.title}`))
  process.exit(1)
}

function ensureFoxServer(): string {
  const foxPort = 4096
  const foxUrl = `http://127.0.0.1:${foxPort}`
  const check = spawnSync("curl", ["-m", "2", "-sf", `${foxUrl}/session`], { encoding: "utf8" })
  if (check.status !== 0) {
    console.log(`▶ Starting background Fox server on port ${foxPort}...`)
    const proc = spawnSync(
      "sh",
      [
        "-c",
        `FOX_EXPERIMENTAL_COMPRESS=true nohup bun run ./src/index.ts serve --port ${foxPort} < /dev/null > /tmp/fox-server-${foxPort}.log 2>&1 &`,
      ],
      {
        cwd: WORKSPACE,
        env: {
          ...process.env,
          OPENAI_BASE_URL,
          OPENAI_API_KEY,
        },
      }
    )
    spawnSync("sleep", ["3"])
  }
  return foxUrl
}

interface TaskResult {
  id: string
  title: string
  passed: boolean
  durationMs: number
  diffStat: string
}

const results: TaskResult[] = []

for (const task of tasksToRun) {
  console.log("═════════════════════════════════════════════════════════════════")
  console.log(` SWE Challenge: ${task.id} (${task.title})`)
  console.log(` Agent: ${agentArg.toUpperCase()} | Model: ${modelArg} | Timeout: ${timeoutSec}s`)
  console.log("═════════════════════════════════════════════════════════════════")

  const sandbox = join(EVAL_BASE, agentArg, task.id)
  rmSync(sandbox, { recursive: true, force: true })
  mkdirSync(sandbox, { recursive: true })

  // Write package.json for bun test
  writeFileSync(
    join(sandbox, "package.json"),
    JSON.stringify({ name: "swe-task", module: "src/index.ts", type: "module" }, null, 2)
  )

  // Write initial files
  for (const [relPath, content] of Object.entries(task.initialFiles)) {
    const fullPath = join(sandbox, relPath)
    mkdirSync(join(fullPath, ".."), { recursive: true })
    writeFileSync(fullPath, content)
  }

  // Git init
  spawnSync("git", ["init", "-q"], { cwd: sandbox, env: { GIT_TERMINAL_PROMPT: "0", ...process.env } })
  spawnSync("git", ["config", "user.email", "eval@fox.local"], { cwd: sandbox })
  spawnSync("git", ["config", "user.name", "SWE Evaluator"], { cwd: sandbox })
  spawnSync("git", ["add", "."], { cwd: sandbox })
  spawnSync("git", ["commit", "-q", "-m", "Initial commit"], { cwd: sandbox })

  // Verify initial failure
  console.log(`▶ Verifying baseline failure with: ${task.failingTestCommand}`)
  const baseCheck = spawnSync("sh", ["-c", task.failingTestCommand], { cwd: sandbox, encoding: "utf8" })
  if (baseCheck.status === 0) {
    console.warn("⚠ Warning: Baseline test passed unexpectedly!")
  } else {
    console.log("✔ Baseline confirmed failing as expected.")
  }

  // Craft Prompt
  const targetFiles = Object.keys(task.initialFiles).filter((f) => !f.includes("test"))
  const prompt = `Task: ${task.title}
Category: ${task.category}
Description: ${task.description}

Instructions:
1. Fix the bug in ${targetFiles.join(", ")} so that '${task.failingTestCommand}' passes.
2. Do not modify the test files.
3. Verify that '${task.failingTestCommand}' runs with 0 failures.`

  console.log(`▶ Dispatching prompt to ${agentArg.toUpperCase()}...`)
  const evalLog = join(EVAL_BASE, agentArg, `${task.id}.log`)
  mkdirSync(join(evalLog, ".."), { recursive: true })
  const tStart = performance.now()
  let agentStatus = 0

  if (agentArg === "aider") {
    const aModel = `openai/${modelArg.replace(/^openai\//, "")}`
    const res = spawnSync(
      AIDER_BIN,
      [
        "--model", aModel,
        "--message", prompt,
        "--yes-always",
        "--no-git-commit-verify",
        "--no-analytics",
        "--no-check-update",
        "--no-show-release-notes",
        "--no-browser",
        "--no-pretty",
        "--exit",
      ],
      {
        cwd: sandbox,
        timeout: timeoutSec * 1000,
        env: {
          ...process.env,
          OPENAI_API_BASE: OPENAI_BASE_URL,
          OPENAI_API_KEY: OPENAI_API_KEY,
        },
        encoding: "utf8",
      }
    )
    writeFileSync(evalLog, (res.stdout || "") + "\n" + (res.stderr || ""))
    agentStatus = res.status ?? 1
  } else if (agentArg === "goose") {
    const gModel = modelArg.replace(/^openai\//, "")
    const res = spawnSync(
      GOOSE_BIN,
      [
        "run",
        "--no-session",
        "--provider", "openai",
        "--model", gModel,
        "--text", prompt,
      ],
      {
        cwd: sandbox,
        timeout: timeoutSec * 1000,
        env: {
          ...process.env,
          GOOSE_PROVIDER: "openai",
          OPENAI_BASE_URL: OPENAI_BASE_URL,
          OPENAI_API_KEY: OPENAI_API_KEY,
        },
        encoding: "utf8",
      }
    )
    writeFileSync(evalLog, (res.stdout || "") + "\n" + (res.stderr || ""))
    agentStatus = res.status ?? 1
  } else if (agentArg === "fox") {
    const foxUrl = ensureFoxServer()
    const curlOpts = ["-sf", "-H", `x-kilo-directory: ${sandbox}`]

    // Create session
    const sResp = spawnSync("curl", [...curlOpts, "-X", "POST", `${foxUrl}/session`, "-H", "Content-Type: application/json", "-d", "{}"], { encoding: "utf8" })
    let sid = ""
    try {
      sid = JSON.parse(sResp.stdout || "{}").id || ""
    } catch {}

    if (!sid) {
      console.error("ERROR: Failed to create session on Fox server")
      agentStatus = 1
    } else {
      // Permissions
      spawnSync("curl", [...curlOpts, "-X", "POST", `${foxUrl}/permission/allow-everything`, "-H", "Content-Type: application/json", "-d", JSON.stringify({ enable: true, sessionID: sid })])
      for (const perm of ["suggest", "question", "plan_enter", "plan_exit"]) {
        spawnSync("curl", [...curlOpts, "-X", "POST", `${foxUrl}/permission`, "-H", "Content-Type: application/json", "-d", JSON.stringify({ sessionID: sid, permission: perm, pattern: "*", action: "deny" })])
      }

      // Start auto-approver in background
      const approverScript = `
        while true; do
          pending=$(curl -m 2 -sf -H "x-kilo-directory: ${sandbox}" "${foxUrl}/permission" 2>/dev/null || echo "[]")
          req_ids=$(echo "$pending" | jq -r 'if type == "array" then .[].id // empty else empty end' 2>/dev/null || true)
          for rid in $req_ids; do
            if [ -n "$rid" ]; then
              curl -m 2 -sf -H "x-kilo-directory: ${sandbox}" -X POST "${foxUrl}/permission/\${rid}/reply" -H "Content-Type: application/json" -d '{"reply":"always"}' >/dev/null 2>&1 || true
            fi
          done
          sleep 0.5
        done
      `
      const approver = spawn("sh", ["-c", approverScript], { stdio: "ignore" })

      const cleanModel = modelArg.replace(/^(openai|local)\//, "")
      const msgBody = JSON.stringify({
        model: { providerID: "local", modelID: cleanModel },
        parts: [{ type: "text", text: prompt }],
      })

      // Send message synchronously with timeout
      const msgResp = spawnSync(
        "curl",
        [
          "-m", `${timeoutSec}`,
          "-s",
          "-H", `x-kilo-directory: ${sandbox}`,
          "-X", "POST",
          `${foxUrl}/session/${sid}/message`,
          "-H", "Content-Type: application/json",
          "-d", msgBody,
        ],
        { timeout: (timeoutSec + 5) * 1000, encoding: "utf8" }
      )
      writeFileSync(evalLog, msgResp.stdout || msgResp.stderr || "")

      try {
        approver.kill()
      } catch {}

      if (msgResp.status !== 0) {
        console.warn(`⚠ Fox session finished with exit code ${msgResp.status}`)
        agentStatus = msgResp.status ?? 1
      }
    }
  }

  const durationMs = Math.round(performance.now() - tStart)
  console.log(`▶ Agent execution finished in ${Math.round(durationMs / 1000)}s (Exit code: ${agentStatus})`)

  // Verify test
  console.log(`▶ Running verification command: ${task.failingTestCommand}`)
  const testRun = spawnSync("sh", ["-c", task.failingTestCommand], { cwd: sandbox, encoding: "utf8" })
  const passed = testRun.status === 0

  if (passed) {
    console.log(`▶ Verification: 🟢 PASS (All test assertions satisfied)`)
  } else {
    console.log(`▶ Verification: 🔴 FAIL`)
    console.log(testRun.stdout || testRun.stderr)
  }

  const diffRun = spawnSync("git", ["diff", "HEAD~1", "HEAD"], { cwd: sandbox, encoding: "utf8" })
  const diffOutput = (diffRun.stdout || spawnSync("git", ["diff"], { cwd: sandbox, encoding: "utf8" }).stdout || "").trim()
  const diffStat = diffOutput.length > 0 ? diffOutput.slice(0, 300) : "no changes"
  console.log("▶ Patch Diff:\n" + (diffOutput || "(no changes)"))

  results.push({
    id: task.id,
    title: task.title,
    passed,
    durationMs,
    diffStat,
  })
}

// Summary Scoreboard
if (results.length > 1 || runAll) {
  console.log("\n═════════════════════════════════════════════════════════════════")
  console.log(` SWE-BENCH MINI SCOREBOARD — ${agentArg.toUpperCase()} (${modelArg})`)
  console.log("═════════════════════════════════════════════════════════════════")
  const passCount = results.filter((r) => r.passed).length
  console.log(`Result: ${passCount}/${results.length} passed (${Math.round((passCount / results.length) * 100)}%)\n`)
  for (const r of results) {
    const mark = r.passed ? "🟢 PASS" : "🔴 FAIL"
    console.log(`  ${mark} [${Math.round(r.durationMs / 1000)}s] ${r.id}: ${r.title}`)
  }
  console.log("═════════════════════════════════════════════════════════════════")
}

