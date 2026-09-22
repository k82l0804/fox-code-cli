/**
 * Tier 3 — Ambiguous Workflows (15 fixtures)
 *
 * Mixed content types that blur workflow classification boundaries.
 * Includes 3 "perfectly ambiguous" fixtures per review recommendation #3.
 * Check: correct dominant workflow classification, no catastrophic misrouting.
 */
import type { ChallengeFixture } from "../types"

export const TIER3_AMBIGUOUS_WORKFLOW_FIXTURES: readonly ChallengeFixture[] = [
  {
    id: "ambiguous-wf-t3-01",
    tier: 3, category: "ambiguous-workflows",
    description: "Diff embedded in prose (PR review comment)",
    seed: 23001,
    input: {
      content: `Great PR overall! A few comments:

1. The change in \`src/auth.ts\` looks good, but I think the diff below could be simplified:

\`\`\`diff
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -15,7 +15,7 @@
 export function validateToken(token: string): boolean {
-  return jwt.verify(token, SECRET);
+  return jwt.verify(token, process.env.JWT_SECRET || SECRET);
 }
\`\`\`

2. Consider using a constant for the fallback. Also, the test coverage for this function is only 60% — can we add a test for the env var path?

3. Unrelated: the CI pipeline is failing on the lint step. Here's the output:
\`\`\`
$ eslint src/ --ext .ts
  1:1  warning  Unexpected var, use let or const  no-var
  5:10 error    'unusedImport' is defined but never used  no-unused-vars
✖ 2 problems (1 error, 1 warning)
\`\`\``,
      tool: "read",
    },
    expected: {
      type: "robustness",
      mustContain: ["validateToken", "JWT_SECRET", "eslint", "no-unused-vars", "60%"],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-02",
    tier: 3, category: "ambiguous-workflows",
    description: "Shell output containing JSON blob inline",
    seed: 23002,
    input: {
      content: `$ curl -s http://localhost:3000/api/health | jq .
{
  "status": "healthy",
  "uptime": 86400,
  "services": {
    "database": { "status": "connected", "latency_ms": 2.3 },
    "cache": { "status": "connected", "latency_ms": 0.4 },
    "queue": { "status": "degraded", "latency_ms": 450.2, "error": "high latency" }
  },
  "version": "2.3.1",
  "node_env": "production"
}

$ curl -s http://localhost:3000/api/metrics | head -5
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/users",status="200"} 45892
http_requests_total{method="POST",path="/api/orders",status="201"} 12345
http_requests_total{method="GET",path="/api/health",status="200"} 99999`,
      tool: "bash",
      command: "bash check-services.sh",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "healthy",
        "degraded",
        "high latency",
        "http_requests_total",
        "45892",
      ],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-03",
    tier: 3, category: "ambiguous-workflows",
    description: "Test output that looks like git log (test verifying git output parsing)",
    seed: 23003,
    input: {
      content: `bun test v1.4.2 (744846f84)

✓ parses single-line git log format
  Input:
    a1b2c3d feat: add user auth
    e4f5g6h fix: resolve memory leak
    i7j8k9l refactor: extract pool
  Expected: 3 commits parsed

✓ handles merge commits in log
  Input:
    m0n1o2p Merge branch 'feat/auth' into main
  Expected: 1 merge commit detected

✗ parses decorated log with branches
  Input:
    a1b2c3d (HEAD -> main, origin/main) latest commit
    e4f5g6h (tag: v2.0.0) release
  Expected: decorations parsed as ['HEAD -> main', 'origin/main']
  Received: decorations parsed as ['HEAD -> main, origin/main']

2 pass, 1 fail
3 expect() calls`,
      tool: "bash",
      command: "bun test test/git-parser.test.ts",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "parses single-line git log",
        "a1b2c3d feat: add user auth",
        "parses decorated log",
        "HEAD -> main",
        "2 pass, 1 fail",
      ],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-04",
    tier: 3, category: "ambiguous-workflows",
    description: "Documentation containing code diffs (migration guide)",
    seed: 23004,
    input: {
      content: `# Migration Guide: v1 → v2

## Breaking Changes

### 1. Configuration Format

The configuration file format has changed from YAML to JSONC:

**Before (v1):**
\`\`\`yaml
database:
  host: localhost
  port: 5432
  name: app_db
\`\`\`

**After (v2):**
\`\`\`jsonc
{
  // Database configuration
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "app_db"
  }
}
\`\`\`

### 2. API Response Format

All API responses now use a wrapper object:

\`\`\`diff
- { "users": [...] }
+ { "data": { "users": [...] }, "meta": { "total": 100 } }
\`\`\`

### 3. Authentication

Replace \`X-API-Key\` header with \`Authorization: Bearer <token>\`:

\`\`\`bash
# v1
curl -H "X-API-Key: abc123" https://api.example.com/users

# v2
curl -H "Authorization: Bearer eyJhbGc..." https://api.example.com/users
\`\`\``,
      tool: "read",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Migration Guide",
        "Breaking Changes",
        "YAML to JSONC",
        "Authorization: Bearer",
        "wrapper object",
      ],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-05",
    tier: 3, category: "ambiguous-workflows",
    description: "JSON data output that resembles a configuration file",
    seed: 23005,
    input: {
      content: `{
  "results": [
    {
      "host": "db-primary.internal",
      "port": 5432,
      "status": "healthy",
      "connections": { "active": 45, "idle": 155, "max": 200 },
      "replication_lag_ms": 0
    },
    {
      "host": "db-replica-1.internal",
      "port": 5432,
      "status": "healthy",
      "connections": { "active": 12, "idle": 88, "max": 100 },
      "replication_lag_ms": 23
    },
    {
      "host": "db-replica-2.internal",
      "port": 5432,
      "status": "degraded",
      "connections": { "active": 98, "idle": 2, "max": 100 },
      "replication_lag_ms": 1450
    }
  ],
  "summary": {
    "total_nodes": 3,
    "healthy": 2,
    "degraded": 1,
    "down": 0
  }
}`,
      tool: "bash",
      command: "curl -s http://localhost:9090/cluster/status | jq .",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "db-primary.internal",
        "db-replica-2.internal",
        "degraded",
        "replication_lag_ms",
        "1450",
      ],
      workflow: "data",
    },
  },
  // -------------------------------------------------------------------------
  // "Perfectly ambiguous" fixtures per review recommendation #3
  // These intentionally blur the boundary between exactly two workflow types
  // -------------------------------------------------------------------------
  {
    id: "ambiguous-wf-t3-06",
    tier: 3, category: "ambiguous-workflows",
    description: "★ PERFECTLY AMBIGUOUS: 50% shell output + 50% diff (equal weight)",
    seed: 23006,
    input: {
      content: `$ git status
On branch main
Changes not staged for commit:
  modified: src/app.ts

$ git diff
diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,3 @@
-const port = 3000;
+const port = process.env.PORT || 3000;
 const app = express();

$ npm test
  ✓ app starts on configured port (12ms)
  ✓ app responds to health check (3ms)
  2 pass, 0 fail

$ git add . && git commit -m "feat: configurable port"
[main a1b2c3d] feat: configurable port
 1 file changed, 1 insertion(+), 1 deletion(-)`,
      tool: "bash",
      command: "bash workflow.sh",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "git status",
        "git diff",
        "process.env.PORT",
        "npm test",
        "2 pass, 0 fail",
        "configurable port",
      ],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-07",
    tier: 3, category: "ambiguous-workflows",
    description: "★ PERFECTLY AMBIGUOUS: Research doc with embedded test results and diff",
    seed: 23007,
    input: {
      content: `# Performance Investigation: Redis vs Memcached

## Benchmark Results

We ran the following command to compare caching strategies:

\`\`\`bash
$ ./bench.sh --iterations 10000 --concurrency 50
Redis:     avg=0.23ms, p99=1.2ms, throughput=43,478 ops/sec
Memcached: avg=0.18ms, p99=0.9ms, throughput=55,555 ops/sec
\`\`\`

## Code Change Required

If we switch to Memcached:

\`\`\`diff
--- a/src/cache.ts
+++ b/src/cache.ts
@@ -1,5 +1,5 @@
-import Redis from 'ioredis';
-const client = new Redis({ host: 'cache.internal' });
+import Memcached from 'memcached';
+const client = new Memcached('cache.internal:11211');
 
 export async function get(key: string) {
-  return client.get(key);
+  return new Promise((resolve) => client.get(key, (err, data) => resolve(data)));
 }
\`\`\`

## Test Impact

Running the existing test suite after the change:

\`\`\`
$ bun test test/cache.test.ts
  ✓ cache.get returns stored value (5ms)
  ✓ cache.set with TTL expires correctly (2003ms)
  ✗ cache.delete removes entry
    Expected: undefined
    Received: "stale_value"
  2 pass, 1 fail
\`\`\`

## Recommendation

Stay with Redis for now. The 28% throughput gain doesn't justify the API incompatibility.`,
      tool: "read",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Redis vs Memcached",
        "43,478 ops/sec",
        "55,555 ops/sec",
        "import Memcached",
        "2 pass, 1 fail",
        "Stay with Redis",
      ],
      workflow: "research",
    },
  },
  {
    id: "ambiguous-wf-t3-08",
    tier: 3, category: "ambiguous-workflows",
    description: "★ PERFECTLY AMBIGUOUS: Data analysis output mixed with shell commands",
    seed: 23008,
    input: {
      content: `$ psql -U analytics -d warehouse -c "
SELECT 
  date_trunc('month', created_at) as month,
  count(*) as signups,
  count(CASE WHEN plan = 'premium' THEN 1 END) as premium,
  round(avg(ltv)::numeric, 2) as avg_ltv
FROM users
WHERE created_at >= '2026-01-01'
GROUP BY 1
ORDER BY 1;
"
    month     | signups | premium | avg_ltv
--------------+---------+---------+---------
 2026-01-01   |   12345 |    1234 |  156.78
 2026-02-01   |   13456 |    1567 |  162.34
 2026-03-01   |   14567 |    1890 |  171.23
 2026-04-01   |   15678 |    2123 |  178.90
 2026-05-01   |   16789 |    2456 |  185.67
 2026-06-01   |   17890 |    2789 |  192.34
 2026-07-01   |   18901 |    3012 |  198.56
 2026-08-01   |   19012 |    3234 |  203.45
 2026-09-01   |   20123 |    3456 |  208.12
(9 rows)

$ python3 -c "
import json
data = {'total_signups': 148761, 'total_premium': 21761, 'conversion_rate': 0.1462}
print(json.dumps(data, indent=2))
"
{
  "total_signups": 148761,
  "total_premium": 21761,
  "conversion_rate": 0.1462
}

Key insight: Premium conversion rate increased from 10% to 17.2% over 9 months.
MoM growth is accelerating — worth investigating the Q2 product changes.`,
      tool: "bash",
      command: "bash monthly-report.sh",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "date_trunc",
        "12345",
        "208.12",
        "conversion_rate",
        "0.1462",
        "Premium conversion rate",
      ],
      workflow: "data",
    },
  },
  {
    id: "ambiguous-wf-t3-09",
    tier: 3, category: "ambiguous-workflows",
    description: "Markdown table inside shell output (mixed document + shell)",
    seed: 23009,
    input: {
      content: `$ cat docs/api-comparison.md

| Feature | REST API | GraphQL | gRPC |
|---------|----------|---------|------|
| Latency (p99) | 45ms | 32ms | 12ms |
| Throughput | 5K rps | 8K rps | 25K rps |
| Schema validation | OpenAPI | Type system | Protobuf |
| Streaming | No | Subscriptions | Bidirectional |
| Browser support | Native | Native | grpc-web |
| Code generation | Partial | Full | Full |

$ wc -l docs/api-comparison.md
12 docs/api-comparison.md

$ grep -c "|" docs/api-comparison.md
8`,
      tool: "bash",
      command: "bash review-docs.sh",
    },
    expected: {
      type: "robustness",
      mustContain: ["REST API", "GraphQL", "gRPC", "25K rps", "Protobuf", "wc -l"],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-10",
    tier: 3, category: "ambiguous-workflows",
    description: "Git log output that contains issue tracker references and prose",
    seed: 23010,
    input: {
      content: `commit a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
Author: Alice Developer <alice@example.com>
Date:   Fri Sep 20 14:30:00 2026 +0000

    feat(auth): implement PKCE flow for OAuth2 (#1234)
    
    This commit implements the Proof Key for Code Exchange (PKCE) flow
    as described in RFC 7636. The implementation includes:
    
    - Code verifier generation (43-128 chars, unreserved chars only)
    - Code challenge computation (SHA-256 + base64url encoding)
    - State parameter binding to prevent CSRF
    
    Closes #1234
    Related: #1200, #1201
    Breaking change: The old implicit flow is now deprecated.
    
    Testing: Added 12 new test cases covering edge cases.
    See test/auth/pkce.test.ts for details.

commit e4f5g6h7i8j9e4f5g6h7i8j9e4f5g6h7i8j9e4f5
Author: Bob Reviewer <bob@example.com>
Date:   Fri Sep 20 15:00:00 2026 +0000

    docs: update auth documentation for PKCE migration (#1235)`,
      tool: "bash",
      command: "git log -2 --format=full",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "PKCE flow",
        "RFC 7636",
        "Closes #1234",
        "Breaking change",
        "Bob Reviewer",
      ],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-11",
    tier: 3, category: "ambiguous-workflows",
    description: "Error log that contains a suggested code fix inline",
    seed: 23011,
    input: {
      content: `[ERROR] TypeScript compilation failed (3 errors)

src/handlers/upload.ts(23,15): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.

  Suggested fix:
    const fileName = req.query.name ?? "untitled";
    //                              ^^^^^^^^^^^^
    // Add nullish coalescing to provide default value

src/handlers/upload.ts(45,8): error TS2339: Property 'size' does not exist on type 'UploadedFile | UploadedFile[]'.
  Property 'size' does not exist on type 'UploadedFile[]'.

  Suggested fix:
    const file = Array.isArray(req.files) ? req.files[0] : req.files;
    const size = file?.size ?? 0;

src/handlers/upload.ts(67,12): error TS18047: 'result' is possibly 'null'.

  Suggested fix:
    if (result === null) throw new Error("Upload failed");`,
      tool: "bash",
      command: "bun run typecheck",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "TS2345",
        "TS2339",
        "TS18047",
        "Suggested fix",
        "nullish coalescing",
        "Upload failed",
      ],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-12",
    tier: 3, category: "ambiguous-workflows",
    description: "YAML configuration output from shell command",
    seed: 23012,
    input: {
      content: `$ kubectl get configmap app-config -o yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
  labels:
    app: web-server
    env: production
data:
  DATABASE_URL: "postgres://app:secret@db.internal:5432/production"
  REDIS_URL: "redis://cache.internal:6379/0"
  LOG_LEVEL: "warn"
  MAX_WORKERS: "8"
  FEATURE_FLAGS: |
    {
      "new_checkout": true,
      "dark_mode": false,
      "beta_search": true
    }`,
      tool: "bash",
      command: "kubectl get configmap app-config -o yaml",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "ConfigMap",
        "DATABASE_URL",
        "postgres://app:secret",
        "FEATURE_FLAGS",
        "new_checkout",
      ],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-13",
    tier: 3, category: "ambiguous-workflows",
    description: "Test output containing formatted data tables",
    seed: 23013,
    input: {
      content: `bun test v1.4.2 (744846f84)

✓ benchmark results match baseline within 10% tolerance
  
  Benchmark Results:
  ┌─────────────────────┬──────────┬──────────┬─────────┐
  │ Operation           │ Baseline │ Current  │ Delta   │
  ├─────────────────────┼──────────┼──────────┼─────────┤
  │ insert (1K rows)    │ 23.4ms   │ 22.1ms   │ -5.6%   │
  │ select (full scan)  │ 145.2ms  │ 148.7ms  │ +2.4%   │
  │ update (indexed)    │ 1.2ms    │ 1.1ms    │ -8.3%   │
  │ delete (cascade)    │ 45.6ms   │ 43.2ms   │ -5.3%   │
  │ aggregate (GROUP BY)│ 234.5ms  │ 312.1ms  │ +33.1%  │
  └─────────────────────┴──────────┴──────────┴─────────┘
  
  ⚠ aggregate query regression: +33.1% (threshold: 10%)

✗ aggregate query performance within threshold
  Expected: delta <= 10%
  Received: delta = 33.1%

1 pass, 1 fail
4 expect() calls`,
      tool: "bash",
      command: "bun test test/benchmark.test.ts",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Benchmark Results",
        "insert (1K rows)",
        "23.4ms",
        "+33.1%",
        "aggregate query regression",
        "1 pass, 1 fail",
      ],
      workflow: "swe",
    },
  },
  {
    id: "ambiguous-wf-t3-14",
    tier: 3, category: "ambiguous-workflows",
    description: "Notebook-style output mixing code, output, and prose",
    seed: 23014,
    input: {
      content: `In [1]: import pandas as pd
        df = pd.read_csv("sales_2026.csv")
        df.head()

Out[1]:
   date       | product | quantity | revenue
   2026-01-01 | Widget  | 150      | 4500.00
   2026-01-02 | Gadget  | 89       | 8900.00
   2026-01-03 | Widget  | 200      | 6000.00

In [2]: df.describe()

Out[2]:
         quantity    revenue
count   365.000   365.000
mean    142.300   5678.90
std      45.200   2345.67
min      12.000    360.00
max     450.000  45000.00

In [3]: # The revenue spike on Jan 15 corresponds to the product launch
        df[df['date'] == '2026-01-15']

Out[3]:
   date       | product | quantity | revenue
   2026-01-15 | NewProd | 1500     | 45000.00

Conclusion: NewProd launch drove 8x normal daily revenue.`,
      tool: "bash",
      command: "jupyter nbconvert --to script analysis.ipynb && python analysis.py",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "pandas",
        "Widget",
        "142.300",
        "revenue spike",
        "NewProd",
        "45000.00",
      ],
      workflow: "data",
    },
  },
  {
    id: "ambiguous-wf-t3-15",
    tier: 3, category: "ambiguous-workflows",
    description: "Terraform plan output (infrastructure-as-code + shell)",
    seed: 23015,
    input: {
      content: `$ terraform plan -out=tfplan

Terraform used the selected providers to generate the following execution plan.
Resource actions are indicated with the following symbols:
  + create
  ~ update in-place
  - destroy

Terraform will perform the following actions:

  # aws_instance.web will be updated in-place
  ~ resource "aws_instance" "web" {
      ~ instance_type = "t3.medium" -> "t3.large"
        id            = "i-0123456789abcdef0"
        tags          = {
            "Name" = "web-server"
        }
    }

  # aws_rds_instance.db will be created
  + resource "aws_rds_instance" "db" {
      + allocated_storage    = 100
      + engine              = "postgres"
      + engine_version      = "15.4"
      + instance_class      = "db.r6g.xlarge"
      + multi_az            = true
      + storage_encrypted   = true
    }

  # aws_elasticache_cluster.old will be destroyed
  - resource "aws_elasticache_cluster" "old" {
      - cluster_id        = "legacy-cache"
      - engine            = "memcached"
      - num_cache_nodes   = 2
    }

Plan: 1 to add, 1 to change, 1 to destroy.

Changes to Outputs:
  + db_endpoint = (known after apply)
  ~ web_ip      = "10.0.1.5" -> (known after apply)`,
      tool: "bash",
      command: "terraform plan -out=tfplan",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "terraform plan",
        "t3.medium",
        "t3.large",
        "aws_rds_instance",
        "postgres",
        "1 to add, 1 to change, 1 to destroy",
      ],
      workflow: "swe",
    },
  },
]
