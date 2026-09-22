/**
 * Tier 2 — SWE Multi-file Tasks (20 fixtures)
 *
 * Multi-file bug diagnosis: read 3–5 files, run failing tests,
 * apply patches across files, run passing tests. Content is
 * concatenated tool outputs simulating an agent trace.
 */
import type { ChallengeFixture, WorkflowStep } from "../types"

function ts(offset: number): string {
  return new Date(1727000000000 + offset * 1000).toISOString()
}

interface SweMultifileConfig {
  title: string
  files: { path: string; content: string }[]
  failOutput: string
  patchSummary: string
  passOutput: string
}

function makeConfig(idx: number): SweMultifileConfig {
  const configs: SweMultifileConfig[] = [
    {
      title: "Fix circular dependency in service layer",
      files: [
        { path: "src/services/user.ts", content: 'import { OrderService } from "./order";\n\nexport class UserService {\n  constructor(private orders: OrderService) {}\n  getOrders(userId: string) { return this.orders.findByUser(userId); }\n}' },
        { path: "src/services/order.ts", content: 'import { UserService } from "./user";\n\nexport class OrderService {\n  constructor(private users: UserService) {}\n  findByUser(userId: string) { return []; }\n}' },
        { path: "src/services/index.ts", content: 'export { UserService } from "./user";\nexport { OrderService } from "./order";' },
      ],
      failOutput: "TypeError: Cannot read properties of undefined (reading 'findByUser')\n  at UserService.getOrders (src/services/user.ts:4:44)\n  Cause: circular dependency between user.ts and order.ts",
      patchSummary: "Introduce dependency injection container to break circular import",
      passOutput: "✓ UserService.getOrders returns orders\n✓ OrderService.findByUser returns filtered orders\n 2 pass, 0 fail",
    },
    {
      title: "Fix race condition in concurrent cache updates",
      files: [
        { path: "src/cache/store.ts", content: 'const cache = new Map<string, any>();\nexport function get(key: string) { return cache.get(key); }\nexport function set(key: string, val: any) { cache.set(key, val); }' },
        { path: "src/cache/refresh.ts", content: 'import { get, set } from "./store";\nexport async function refreshIfStale(key: string, fetcher: () => Promise<any>) {\n  const cached = get(key);\n  if (!cached) {\n    const val = await fetcher();\n    set(key, val);\n  }\n  return get(key);\n}' },
        { path: "test/cache.test.ts", content: 'test("concurrent refresh", async () => {\n  // Two concurrent calls should not duplicate work\n});' },
      ],
      failOutput: "✗ concurrent refresh\n  Expected 1 fetch call, received 3\n  Race condition: multiple callers trigger parallel fetches",
      patchSummary: "Add in-flight promise deduplication to prevent concurrent fetches for same key",
      passOutput: "✓ concurrent refresh [12ms]\n 1 pass, 0 fail",
    },
    {
      title: "Fix N+1 query in user list API",
      files: [
        { path: "src/api/users.ts", content: 'export async function listUsers(db: DB) {\n  const users = await db.query("SELECT * FROM users");\n  for (const user of users) {\n    user.roles = await db.query("SELECT * FROM roles WHERE user_id = ?", [user.id]);\n  }\n  return users;\n}' },
        { path: "src/db/query.ts", content: 'export class DB {\n  queryCount = 0;\n  async query(sql: string, params?: any[]) { this.queryCount++; return []; }\n}' },
        { path: "test/users.test.ts", content: 'test("list users with roles", async () => {\n  const db = new DB();\n  await listUsers(db);\n  expect(db.queryCount).toBeLessThanOrEqual(2);\n});' },
      ],
      failOutput: "✗ list users with roles\n  expect(received).toBeLessThanOrEqual(expected)\n  Expected: <= 2\n  Received: 101\n  (N+1 query: 1 user query + 100 role queries)",
      patchSummary: "Replace N+1 loop with JOIN query or batch IN clause",
      passOutput: "✓ list users with roles [3ms]\n 1 pass, 0 fail",
    },
    {
      title: "Fix missing error propagation in middleware chain",
      files: [
        { path: "src/middleware/auth.ts", content: 'export function authMiddleware(req: any, res: any, next: any) {\n  try {\n    const token = req.headers.authorization;\n    if (!token) throw new Error("Unauthorized");\n    next();\n  } catch (err) {\n    // Swallowed error — next() never called with error\n    res.status(500).send("Internal Server Error");\n  }\n}' },
        { path: "src/middleware/error.ts", content: 'export function errorHandler(err: any, req: any, res: any, next: any) {\n  console.error(err);\n  res.status(err.status || 500).json({ error: err.message });\n}' },
      ],
      failOutput: "✗ returns 401 for missing token\n  Expected status: 401\n  Received: 500\n  Error handler never receives the auth error",
      patchSummary: "Pass error to next(err) instead of handling locally",
      passOutput: "✓ returns 401 for missing token\n✓ returns 403 for expired token\n 2 pass, 0 fail",
    },
    {
      title: "Fix timezone-aware date comparison in scheduler",
      files: [
        { path: "src/scheduler/cron.ts", content: 'export function isDue(scheduledAt: string): boolean {\n  return new Date(scheduledAt) <= new Date();\n}' },
        { path: "src/scheduler/runner.ts", content: 'import { isDue } from "./cron";\nexport function runPendingJobs(jobs: { scheduledAt: string }[]) {\n  return jobs.filter(j => isDue(j.scheduledAt));\n}' },
        { path: "test/scheduler.test.ts", content: 'test("handles UTC+5 timezone correctly", () => {\n  // Job scheduled at 2026-09-20T10:00:00+05:00 should be due at UTC 05:00\n});' },
      ],
      failOutput: "✗ handles UTC+5 timezone correctly\n  Job marked as not due when it should be due\n  Input: '2026-09-20T10:00:00+05:00', now: '2026-09-20T06:00:00Z'\n  Date comparison ignores timezone offset",
      patchSummary: "Parse both dates to UTC milliseconds before comparison",
      passOutput: "✓ handles UTC+5 timezone correctly [1ms]\n 1 pass, 0 fail",
    },
  ]
  return configs[idx % configs.length]!
}

export const TIER2_SWE_MULTIFILE_FIXTURES: readonly ChallengeFixture[] = Array.from(
  { length: 20 },
  (_, idx) => {
    const cfg = makeConfig(idx)
    const steps: WorkflowStep[] = [
      // Read all files
      ...cfg.files.map((f, i) => ({
        tool: "read" as const,
        content: `File: ${f.path}\n\n${f.content}`,
        timestamp: ts(idx * 200 + i * 5),
      })),
      // Run failing tests
      {
        tool: "bash" as const,
        command: "bun test test/",
        content: cfg.failOutput,
        timestamp: ts(idx * 200 + 20),
      },
      // Apply patch
      {
        tool: "edit" as const,
        content: `Patch applied: ${cfg.patchSummary}\n  Modified ${cfg.files.length} files`,
        timestamp: ts(idx * 200 + 30),
      },
      // Run passing tests
      {
        tool: "bash" as const,
        command: "bun test test/",
        content: cfg.passOutput,
        timestamp: ts(idx * 200 + 40),
      },
    ]

    const content = steps.map((s, i) =>
      `[Step ${i + 1}/${steps.length}] [${s.timestamp ?? ""}] tool=${s.tool}${s.command ? ` cmd="${s.command}"` : ""}\n${s.content}`
    ).join("\n\n---\n\n")

    return {
      id: `swe-mf-t2-${String(idx + 1).padStart(2, "0")}`,
      tier: 2 as const,
      category: "swe-multifile" as const,
      description: `SWE multi-file: ${cfg.title} (variant ${Math.floor(idx / 5) + 1})`,
      seed: 11000 + idx,
      input: {
        content,
        tool: "bash" as const,
        command: "bun test",
        files: Object.fromEntries(cfg.files.map(f => [f.path, f.content])),
        steps,
      },
      expected: {
        type: "completion" as const,
        mustContain: [
          cfg.files[0]!.path,
          cfg.patchSummary.slice(0, 30),
        ],
        workflow: "swe" as const,
      },
    }
  },
)
