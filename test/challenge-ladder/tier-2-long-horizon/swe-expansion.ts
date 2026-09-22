/**
 * Tier 2 — SWE Multi-Step Expansion (5 new fixtures)
 *
 * Advanced multi-file SWE workflows:
 *   - Failing test → patch → retry → second patch → pass
 *   - Circular dependency resolution
 *   - Multi-language stack traces (Python + JS)
 *   - Build + test + lint combined logs
 *   - Multi-file patch with rename + deletion + addition
 */
import type { ChallengeFixture } from "../types"

function ts(offset: number): string {
  return new Date(1727200000000 + offset * 1000).toISOString()
}

export const TIER2_SWE_EXPANSION_FIXTURES: readonly ChallengeFixture[] = [
  // 1. Failing test → patch → still failing → second patch → pass
  {
    id: "swe-multi-t2-21",
    tier: 2,
    category: "swe-multifile",
    description: "Two-iteration fix cycle: fail → patch → fail → patch → pass",
    seed: 13001,
    input: {
      content: [
        `[Step 1/7] [${ts(0)}] tool=bash cmd="bun test src/parser.test.ts"\n✗ Parser > handles nested objects\n  Expected: { a: { b: 1 } }\n  Received: null\n\n  at src/parser.test.ts:42:5\n\n1 fail, 4 pass`,
        `[Step 2/7] [${ts(10)}] tool=read\n// File: src/parser.ts\nexport function parse(input: string): unknown {\n  const tokens = tokenize(input);\n  if (tokens.length === 0) return null;\n  return parseValue(tokens, 0).value;\n}`,
        `[Step 3/7] [${ts(20)}] tool=edit\nFile updated: src/parser.ts\n  Added recursive descent for nested objects in parseValue()`,
        `[Step 4/7] [${ts(30)}] tool=bash cmd="bun test src/parser.test.ts"\n✗ Parser > handles nested objects\n  Expected: { a: { b: 1 } }\n  Received: { a: {} }\n\n  at src/parser.test.ts:42:5\n\n1 fail, 4 pass`,
        `[Step 5/7] [${ts(40)}] tool=read\n// File: src/parser.ts (after first patch)\nexport function parseValue(tokens: Token[], pos: number): ParseResult {\n  if (tokens[pos]?.type === 'lbrace') {\n    return parseObject(tokens, pos);\n  }\n  // BUG: parseObject doesn't recurse into nested values\n  return { value: tokens[pos]?.value ?? null, nextPos: pos + 1 };\n}`,
        `[Step 6/7] [${ts(50)}] tool=edit\nFile updated: src/parser.ts\n  Fixed parseObject to call parseValue recursively for nested values`,
        `[Step 7/7] [${ts(60)}] tool=bash cmd="bun test src/parser.test.ts"\n✓ Parser > handles nested objects [2.1ms]\n✓ Parser > handles flat objects [0.3ms]\n✓ Parser > handles arrays [0.5ms]\n✓ Parser > handles primitives [0.2ms]\n✓ Parser > handles empty input [0.1ms]\n\n5 pass, 0 fail`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "bun test",
      steps: [
        { tool: "bash", command: "bun test", content: "1 fail, 4 pass", timestamp: ts(0) },
        { tool: "read", content: "src/parser.ts", timestamp: ts(10) },
        { tool: "edit", content: "File updated: src/parser.ts", timestamp: ts(20) },
        { tool: "bash", command: "bun test", content: "1 fail, 4 pass", timestamp: ts(30) },
        { tool: "read", content: "src/parser.ts (after first patch)", timestamp: ts(40) },
        { tool: "edit", content: "Fixed parseObject", timestamp: ts(50) },
        { tool: "bash", command: "bun test", content: "5 pass, 0 fail", timestamp: ts(60) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["parseValue", "nested objects", "5 pass, 0 fail", "parser.ts"],
      workflow: "swe",
    },
  },

  // 2. Circular dependency resolution
  {
    id: "swe-multi-t2-22",
    tier: 2,
    category: "swe-multifile",
    description: "Circular dependency detection and resolution across 3 modules",
    seed: 13002,
    input: {
      content: [
        `[Step 1/6] [${ts(100)}] tool=bash cmd="bun run build"\nerror: Circular dependency detected:\n  src/models/user.ts → src/services/auth.ts → src/models/user.ts\n\nImport chain:\n  user.ts imports AuthService from auth.ts\n  auth.ts imports UserModel from user.ts`,
        `[Step 2/6] [${ts(110)}] tool=read\n// File: src/models/user.ts\nimport { AuthService } from '../services/auth';\n\nexport class UserModel {\n  async validateCredentials(password: string) {\n    return AuthService.verify(this.id, password);\n  }\n}`,
        `[Step 3/6] [${ts(115)}] tool=read\n// File: src/services/auth.ts\nimport { UserModel } from '../models/user';\n\nexport class AuthService {\n  static async login(email: string, password: string) {\n    const user = await UserModel.findByEmail(email);\n    return user?.validateCredentials(password);\n  }\n}`,
        `[Step 4/6] [${ts(125)}] tool=edit\nFile created: src/interfaces/credentials.ts\n  Extracted ICredentialValidator interface\nFile updated: src/models/user.ts\n  UserModel now implements ICredentialValidator instead of importing AuthService\nFile updated: src/services/auth.ts\n  AuthService now accepts ICredentialValidator via dependency injection`,
        `[Step 5/6] [${ts(140)}] tool=bash cmd="bun run build"\nBuild completed successfully.\n  dist/index.js    12.4 KB\n  dist/index.js.map 28.1 KB`,
        `[Step 6/6] [${ts(145)}] tool=bash cmd="bun test"\n✓ UserModel > validates credentials [1.2ms]\n✓ AuthService > login flow [3.4ms]\n✓ AuthService > rejects invalid password [1.1ms]\n\n3 pass, 0 fail`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "bun run build",
      steps: [
        { tool: "bash", command: "bun run build", content: "Circular dependency detected", timestamp: ts(100) },
        { tool: "read", content: "src/models/user.ts", timestamp: ts(110) },
        { tool: "read", content: "src/services/auth.ts", timestamp: ts(115) },
        { tool: "edit", content: "Extracted ICredentialValidator interface", timestamp: ts(125) },
        { tool: "bash", command: "bun run build", content: "Build completed", timestamp: ts(140) },
        { tool: "bash", command: "bun test", content: "3 pass, 0 fail", timestamp: ts(145) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["Circular dependency", "user.ts", "auth.ts", "ICredentialValidator"],
      workflow: "swe",
    },
  },

  // 3. Multi-language stack traces (Python + JS)
  {
    id: "swe-multi-t2-23",
    tier: 2,
    category: "swe-multifile",
    description: "Python backend + JS frontend combined error traces",
    seed: 13003,
    input: {
      content: [
        `[Step 1/5] [${ts(200)}] tool=bash cmd="docker compose logs api"\napi_1  | Traceback (most recent call last):\napi_1  |   File "/app/api/routes/users.py", line 42, in get_user\napi_1  |     user = await db.users.find_one({"_id": ObjectId(user_id)})\napi_1  |   File "/app/api/db/mongo.py", line 18, in find_one\napi_1  |     return self.collection.find_one(query)\napi_1  | bson.errors.InvalidId: 'undefined' is not a valid ObjectId`,
        `[Step 2/5] [${ts(210)}] tool=bash cmd="docker compose logs frontend"\nfrontend_1  | Error: Request failed with status code 500\nfrontend_1  |     at createError (webpack:///./node_modules/axios/lib/core/createError.js:16:15)\nfrontend_1  |     at settle (webpack:///./node_modules/axios/lib/core/settle.js:17:12)\nfrontend_1  |     at XMLHttpRequest.onloadend (webpack:///./node_modules/axios/lib/adapters/xhr.js:66:7)\nfrontend_1  | \nfrontend_1  | The above error was caused by:\nfrontend_1  |   UserProfile.tsx:23 - const { data } = await api.get(\`/users/\${userId}\`)`,
        `[Step 3/5] [${ts(220)}] tool=read\n// File: frontend/src/components/UserProfile.tsx\nimport { api } from '../lib/api';\n\nexport function UserProfile({ userId }: { userId?: string }) {\n  useEffect(() => {\n    // BUG: userId can be undefined, sending 'undefined' as path param\n    const { data } = await api.get(\`/users/\${userId}\`);\n    setUser(data);\n  }, [userId]);`,
        `[Step 4/5] [${ts(230)}] tool=edit\nFile updated: frontend/src/components/UserProfile.tsx\n  Added early return guard when userId is undefined`,
        `[Step 5/5] [${ts(240)}] tool=bash cmd="docker compose up -d && docker compose logs --tail=5 api"\napi_1  | INFO:     Application startup complete.\napi_1  | INFO:     Uvicorn running on http://0.0.0.0:8000`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "docker compose logs",
      steps: [
        { tool: "bash", command: "docker compose logs api", content: "Traceback\nInvalidId: 'undefined'", timestamp: ts(200) },
        { tool: "bash", command: "docker compose logs frontend", content: "Error: Request failed with status code 500\nUserProfile.tsx:23", timestamp: ts(210) },
        { tool: "read", content: "UserProfile.tsx\nuserId can be undefined", timestamp: ts(220) },
        { tool: "edit", content: "Added early return guard", timestamp: ts(230) },
        { tool: "bash", command: "docker compose up", content: "Application startup complete", timestamp: ts(240) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["Traceback", "InvalidId", "UserProfile.tsx", "ObjectId"],
      workflow: "swe",
    },
  },

  // 4. Build + test + lint combined
  {
    id: "swe-multi-t2-24",
    tier: 2,
    category: "swe-multifile",
    description: "Combined build, test, and lint log output with interleaved results",
    seed: 13004,
    input: {
      content: [
        `[Step 1/6] [${ts(300)}] tool=bash cmd="bun run build"\nwarning: src/deprecated.ts is imported but never used in the bundle\n⚡ Build completed in 2.3s\n  dist/index.js     45.2 KB (gzipped: 12.1 KB)\n  dist/worker.js     8.7 KB (gzipped: 3.2 KB)`,
        `[Step 2/6] [${ts(310)}] tool=bash cmd="bun run lint"\nsrc/api/handler.ts\n  12:5  warning  Unexpected any. Specify a type.  @typescript-eslint/no-explicit-any\n  45:1  error    Missing return type on function  @typescript-eslint/explicit-function-return-type\n\nsrc/utils/cache.ts\n  8:10  warning  'maxAge' is defined but never used  @typescript-eslint/no-unused-vars\n\n✖ 3 problems (1 error, 2 warnings)`,
        `[Step 3/6] [${ts(320)}] tool=edit\nFile updated: src/api/handler.ts\n  Added return type annotation to handler function\n  Changed 'any' to 'RequestContext' type\nFile updated: src/utils/cache.ts\n  Used maxAge parameter in cache TTL calculation`,
        `[Step 4/6] [${ts(330)}] tool=bash cmd="bun run lint"\n✔ No problems found (0 errors, 0 warnings)`,
        `[Step 5/6] [${ts(335)}] tool=bash cmd="bun test"\n✓ API handler > processes GET requests [1.2ms]\n✓ API handler > rejects malformed body [0.8ms]\n✓ Cache > expires entries after maxAge [2.1ms]\n✓ Cache > returns undefined for missing keys [0.3ms]\n✓ Worker > processes batch jobs [5.4ms]\n\n5 pass, 0 fail`,
        `[Step 6/6] [${ts(340)}] tool=bash cmd="bun run build"\n⚡ Build completed in 2.1s\n  dist/index.js     44.8 KB (gzipped: 11.9 KB)\n  dist/worker.js     8.7 KB (gzipped: 3.2 KB)`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "bun run build",
      steps: [
        { tool: "bash", command: "bun run build", content: "Build completed in 2.3s", timestamp: ts(300) },
        { tool: "bash", command: "bun run lint", content: "3 problems (1 error, 2 warnings)", timestamp: ts(310) },
        { tool: "edit", content: "Fixed lint errors", timestamp: ts(320) },
        { tool: "bash", command: "bun run lint", content: "No problems found", timestamp: ts(330) },
        { tool: "bash", command: "bun test", content: "5 pass, 0 fail", timestamp: ts(335) },
        { tool: "bash", command: "bun run build", content: "Build completed in 2.1s", timestamp: ts(340) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["handler.ts", "no-explicit-any", "5 pass, 0 fail", "No problems found"],
      workflow: "swe",
    },
  },

  // 5. Multi-file patch with rename + deletion + addition
  {
    id: "swe-multi-t2-25",
    tier: 2,
    category: "swe-multifile",
    description: "Refactor: rename, delete, and create files in one commit",
    seed: 13005,
    input: {
      content: [
        `[Step 1/6] [${ts(400)}] tool=bash cmd="git status"\nOn branch refactor/module-split\nChanges not staged for commit:\n  modified:   src/index.ts\n  deleted:    src/monolith.ts\n\nUntracked files:\n  src/modules/auth.ts\n  src/modules/db.ts\n  src/modules/api.ts`,
        `[Step 2/6] [${ts(410)}] tool=read\n// File: src/monolith.ts (to be deleted — 450 lines)\n// This file contains auth, db, and api logic all mixed together\nexport class App {\n  auth = new AuthHandler();\n  db = new DatabasePool();\n  api = new ApiRouter();\n}`,
        `[Step 3/6] [${ts(420)}] tool=read\n// File: src/modules/auth.ts (new — extracted from monolith)\nimport { TokenValidator } from './shared';\nexport class AuthHandler {\n  async login(email: string, password: string) { /* ... */ }\n  async logout(sessionId: string) { /* ... */ }\n}`,
        `[Step 4/6] [${ts(425)}] tool=read\n// File: src/modules/db.ts (new — extracted from monolith)\nexport class DatabasePool {\n  private pool: Connection[] = [];\n  async query(sql: string, params: unknown[]) { /* ... */ }\n}`,
        `[Step 5/6] [${ts(430)}] tool=edit\nFile updated: src/index.ts\n  Replaced monolith import with modular imports from src/modules/*`,
        `[Step 6/6] [${ts(440)}] tool=bash cmd="bun test && bun run build"\n✓ AuthHandler > login [1.2ms]\n✓ AuthHandler > logout [0.8ms]\n✓ DatabasePool > query [2.3ms]\n✓ ApiRouter > routes [1.5ms]\n\n4 pass, 0 fail\n⚡ Build completed in 1.8s`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git status",
      steps: [
        { tool: "bash", command: "git status", content: "deleted: src/monolith.ts\nUntracked: src/modules/", timestamp: ts(400) },
        { tool: "read", content: "src/monolith.ts (450 lines)", timestamp: ts(410) },
        { tool: "read", content: "src/modules/auth.ts", timestamp: ts(420) },
        { tool: "read", content: "src/modules/db.ts", timestamp: ts(425) },
        { tool: "edit", content: "Replaced monolith import with modular imports", timestamp: ts(430) },
        { tool: "bash", command: "bun test && bun run build", content: "4 pass, 0 fail\nBuild completed", timestamp: ts(440) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["monolith.ts", "modules/auth.ts", "DatabasePool", "4 pass, 0 fail"],
      workflow: "swe",
    },
  },
]
