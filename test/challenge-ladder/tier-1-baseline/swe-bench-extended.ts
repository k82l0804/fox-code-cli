/**
 * Tier 1 — SWE-bench Extended (40 fixtures)
 *
 * 12 existing SWE tasks × 2 (failing-test + patch) = 24 fixtures
 * + 16 synthetic SWE fixtures covering:
 *   TypeScript type errors, Python import bugs, React state bugs,
 *   SQL injection fixes, async/await errors, null pointer fixes,
 *   encoding issues, regex bugs
 */
import type { ChallengeFixture } from "../types"
import { SWE_BENCH_MINI_TASKS } from "../../corpora/swe-bench-mini/tasks"

// ---------------------------------------------------------------------------
// Convert existing 12 SWE tasks → 24 challenge fixtures
// ---------------------------------------------------------------------------

const existingFixtures: ChallengeFixture[] = SWE_BENCH_MINI_TASKS.flatMap((task, idx) => [
  {
    id: `swe-t1-${String(idx * 2 + 1).padStart(2, "0")}`,
    tier: 1 as const,
    category: "swe-bench-mini" as const,
    description: `${task.title} (Failing Test Log)`,
    seed: 1000 + idx * 2,
    input: {
      content: task.failingTestOutput,
      tool: "bash" as const,
      command: task.failingTestCommand,
    },
    expected: {
      type: "invariant" as const,
      mustContain: [task.failingTestOutput.split("\n")[1] ?? "fail"],
      workflow: "swe" as const,
    },
  },
  {
    id: `swe-t1-${String(idx * 2 + 2).padStart(2, "0")}`,
    tier: 1 as const,
    category: "swe-bench-mini" as const,
    description: `${task.title} (Unified Diff Patch)`,
    seed: 1001 + idx * 2,
    input: {
      content: task.referencePatch,
      tool: "bash" as const,
      command: "git diff",
    },
    expected: {
      type: "invariant" as const,
      mustContain: task.referencePatch
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1).trim())
        .filter((l) => l.length > 5),
      workflow: "swe" as const,
    },
  },
])

// ---------------------------------------------------------------------------
// 16 synthetic SWE fixtures — realistic but generated
// ---------------------------------------------------------------------------

const syntheticFixtures: ChallengeFixture[] = [
  {
    id: "swe-t1-25",
    tier: 1,
    category: "swe-bench-mini",
    description: "TypeScript strict null check failure in optional chaining",
    seed: 2001,
    input: {
      content: `bun test v1.4.2 (744846f84)
✗ handles optional user profile fields
  TypeError: Cannot read properties of undefined (reading 'email')
    at getUserEmail (/packages/app/src/user.ts:15:32)
    at /packages/app/test/user.test.ts:8:24
 0 pass
 1 fail
 1 expect() calls`,
      tool: "bash",
      command: "bun test test/user.test.ts",
    },
    expected: {
      type: "invariant",
      mustContain: ["Cannot read properties of undefined", "getUserEmail", "user.ts:15:32"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-26",
    tier: 1,
    category: "swe-bench-mini",
    description: "TypeScript strict null check — fix patch",
    seed: 2002,
    input: {
      content: `--- a/src/user.ts
+++ b/src/user.ts
@@ -12,7 +12,7 @@
 export function getUserEmail(user: User): string {
-  return user.profile.email
+  return user.profile?.email ?? "unknown"
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: ["user.profile?.email ?? \"unknown\""],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-27",
    tier: 1,
    category: "swe-bench-mini",
    description: "Python circular import error in Flask app",
    seed: 2003,
    input: {
      content: `$ python -m pytest tests/test_routes.py -v
FAILED tests/test_routes.py::test_health_check - ImportError: cannot import name 'create_app' from partially initialized module 'app' (most likely due to a circular import) (/srv/app/__init__.py)
tests/test_routes.py::test_health_check FAILED
tests/test_routes.py::test_user_list FAILED
================ 2 failed in 0.45s ================`,
      tool: "bash",
      command: "python -m pytest tests/test_routes.py -v",
    },
    expected: {
      type: "invariant",
      mustContain: ["circular import", "create_app", "2 failed"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-28",
    tier: 1,
    category: "swe-bench-mini",
    description: "Python circular import fix patch",
    seed: 2004,
    input: {
      content: `--- a/app/__init__.py
+++ b/app/__init__.py
@@ -1,5 +1,7 @@
-from app.routes import register_routes
 from flask import Flask
 
 def create_app():
     app = Flask(__name__)
+    # Import routes inside factory to avoid circular import
+    from app.routes import register_routes
     register_routes(app)
     return app`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: ["from app.routes import register_routes", "circular import"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-29",
    tier: 1,
    category: "swe-bench-mini",
    description: "React useState stale closure bug in effect cleanup",
    seed: 2005,
    input: {
      content: `FAIL src/__tests__/Timer.test.tsx
  ● Timer › should not fire after unmount

    expect(received).toBe(expected) // Object.is equality
    
    Expected: 0
    Received: 1
    
      14 |     act(() => { jest.advanceTimersByTime(1000); });
      15 |     unmount();
    > 16 |     expect(callback).toHaveBeenCalledTimes(0);
         |                      ^
      17 |   });
      
    at Object.<anonymous> (src/__tests__/Timer.test.tsx:16:22)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total`,
      tool: "bash",
      command: "npx jest src/__tests__/Timer.test.tsx",
    },
    expected: {
      type: "invariant",
      mustContain: ["should not fire after unmount", "Expected: 0", "Received: 1"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-30",
    tier: 1,
    category: "swe-bench-mini",
    description: "React useState fix — cleanup in useEffect",
    seed: 2006,
    input: {
      content: `--- a/src/hooks/useTimer.ts
+++ b/src/hooks/useTimer.ts
@@ -5,8 +5,12 @@
 export function useTimer(callback: () => void, delay: number) {
   useEffect(() => {
-    const id = setInterval(callback, delay);
-    return () => clearInterval(id);
+    let cancelled = false;
+    const id = setInterval(() => {
+      if (!cancelled) callback();
+    }, delay);
+    return () => {
+      cancelled = true;
+      clearInterval(id);
+    };
   }, [callback, delay]);
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: ["cancelled = true", "clearInterval(id)"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-31",
    tier: 1,
    category: "swe-bench-mini",
    description: "SQL injection vulnerability in query builder",
    seed: 2007,
    input: {
      content: `bun test v1.4.2 (744846f84)
✗ rejects SQL injection in search parameter
  AssertionError: expected query to use parameterized binding
  
  Received query: SELECT * FROM users WHERE name = 'admin' OR '1'='1'
  Expected: parameterized query with $1 placeholder
  
    at /packages/db/test/search.test.ts:23:12
 0 pass
 1 fail
 2 expect() calls`,
      tool: "bash",
      command: "bun test test/search.test.ts",
    },
    expected: {
      type: "invariant",
      mustContain: ["SQL injection", "parameterized", "OR '1'='1'"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-32",
    tier: 1,
    category: "swe-bench-mini",
    description: "SQL injection fix — parameterized query",
    seed: 2008,
    input: {
      content: `--- a/src/db/search.ts
+++ b/src/db/search.ts
@@ -8,5 +8,5 @@
 export function searchUsers(db: Database, name: string): User[] {
-  const query = \`SELECT * FROM users WHERE name = '\${name}'\`;
-  return db.query(query).all() as User[];
+  const query = "SELECT * FROM users WHERE name = $1";
+  return db.query(query).all(name) as User[];
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: ["WHERE name = $1", "db.query(query).all(name)"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-33",
    tier: 1,
    category: "swe-bench-mini",
    description: "Async/await missing error in Promise chain",
    seed: 2009,
    input: {
      content: `bun test v1.4.2 (744846f84)
✗ fetches user data with proper error handling
  TypeError: fetchUser(...).then is not a function
    at processUsers (/packages/api/src/processor.ts:22:18)
    at /packages/api/test/processor.test.ts:15:20
  
  Cause: fetchUser returns a raw value instead of a Promise
  when the cache hit path doesn't use async
 0 pass
 1 fail
 1 expect() calls`,
      tool: "bash",
      command: "bun test test/processor.test.ts",
    },
    expected: {
      type: "invariant",
      mustContain: ["then is not a function", "fetchUser", "cache hit path"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-34",
    tier: 1,
    category: "swe-bench-mini",
    description: "Async/await fix — ensure Promise return on cache hit",
    seed: 2010,
    input: {
      content: `--- a/src/processor.ts
+++ b/src/processor.ts
@@ -18,7 +18,7 @@
-export function fetchUser(id: string): Promise<User> | User {
+export async function fetchUser(id: string): Promise<User> {
   const cached = cache.get(id);
-  if (cached) return cached;
+  if (cached) return cached;  // async guarantees Promise wrapper
   return api.get(\`/users/\${id}\`);
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: ["async function fetchUser", "Promise<User>"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-35",
    tier: 1,
    category: "swe-bench-mini",
    description: "Off-by-one error in pagination slice",
    seed: 2011,
    input: {
      content: `bun test v1.4.2 (744846f84)
✗ returns correct page of results
  expect(received).toEqual(expected)

  Expected: [{ id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }, { id: 15 }]
  Received: [{ id: 10 }, { id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }]

  (Off-by-one in slice start index)
    at /packages/api/test/pagination.test.ts:28:18
 0 pass
 1 fail
 2 expect() calls`,
      tool: "bash",
      command: "bun test test/pagination.test.ts",
    },
    expected: {
      type: "invariant",
      mustContain: ["Off-by-one", "Expected:", "Received:", "id: 11"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-36",
    tier: 1,
    category: "swe-bench-mini",
    description: "Off-by-one pagination fix",
    seed: 2012,
    input: {
      content: `--- a/src/pagination.ts
+++ b/src/pagination.ts
@@ -4,7 +4,7 @@
 export function getPage<T>(items: T[], page: number, pageSize: number): T[] {
-  const start = (page - 1) * pageSize;
+  const start = page * pageSize;  // pages are 0-indexed
   const end = start + pageSize;
   return items.slice(start, end);
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: ["page * pageSize", "pages are 0-indexed"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-37",
    tier: 1,
    category: "swe-bench-mini",
    description: "UTF-8 encoding error in CSV parser — BOM handling",
    seed: 2013,
    input: {
      content: `bun test v1.4.2 (744846f84)
✗ parses CSV with UTF-8 BOM header
  expect(received).toBe(expected)

  Expected: "name"
  Received: "\\ufeffname"

  CSV file starts with BOM (byte order mark) which pollutes
  the first column header name
    at /packages/csv/test/parser.test.ts:12:20
 0 pass
 1 fail
 2 expect() calls`,
      tool: "bash",
      command: "bun test test/parser.test.ts",
    },
    expected: {
      type: "invariant",
      mustContain: ["UTF-8 BOM", "\\ufeffname", "byte order mark"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-38",
    tier: 1,
    category: "swe-bench-mini",
    description: "UTF-8 BOM fix in CSV parser",
    seed: 2014,
    input: {
      content: `--- a/src/csv-parser.ts
+++ b/src/csv-parser.ts
@@ -6,6 +6,8 @@
 export function parseCSV(raw: string): Record<string, string>[] {
+  // Strip UTF-8 BOM if present
+  const content = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
-  const lines = raw.split("\\n").filter(Boolean);
+  const lines = content.split("\\n").filter(Boolean);
   const headers = lines[0].split(",").map(h => h.trim());
   return lines.slice(1).map(line => {`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: ["Strip UTF-8 BOM", "0xFEFF", "raw.slice(1)"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-39",
    tier: 1,
    category: "swe-bench-mini",
    description: "Regex catastrophic backtracking on email validation",
    seed: 2015,
    input: {
      content: `bun test v1.4.2 (744846f84)
✗ validates email without hanging on adversarial input (timeout: 5000ms)
  Timeout: test exceeded 5000ms

  Input: "aaaaaaaaaaaaaaaaaaaaaaaaaaa@"
  The regex /^([a-zA-Z0-9]+)*@/ causes catastrophic backtracking
  on inputs without a valid domain suffix.
    at /packages/validate/test/email.test.ts:18:14
 0 pass
 1 fail
 0 expect() calls`,
      tool: "bash",
      command: "bun test test/email.test.ts",
    },
    expected: {
      type: "invariant",
      mustContain: ["catastrophic backtracking", "Timeout", "([a-zA-Z0-9]+)*@"],
      workflow: "swe",
    },
  },
  {
    id: "swe-t1-40",
    tier: 1,
    category: "swe-bench-mini",
    description: "Regex fix — atomic group equivalent for email validation",
    seed: 2016,
    input: {
      content: `--- a/src/validate/email.ts
+++ b/src/validate/email.ts
@@ -3,5 +3,6 @@
-const EMAIL_REGEX = /^([a-zA-Z0-9]+)*@([a-zA-Z0-9]+\\.)+[a-zA-Z]{2,}$/;
+// Use possessive-style matching to prevent backtracking
+const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
 
 export function isValidEmail(email: string): boolean {
   return EMAIL_REGEX.test(email);`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: ["possessive-style", "[a-zA-Z0-9._%+-]+@"],
      workflow: "swe",
    },
  },
]

export const TIER1_SWE_BENCH_FIXTURES: readonly ChallengeFixture[] = [
  ...existingFixtures,
  ...syntheticFixtures,
]
