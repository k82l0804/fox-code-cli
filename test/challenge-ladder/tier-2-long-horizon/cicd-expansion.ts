/**
 * Tier 2 — CI/CD Pipeline Traces (5 new fixtures)
 *
 * Multi-step CI/CD workflows with realistic tool output:
 *   - Docker build → push → deploy
 *   - Kubernetes apply → rollout → logs
 *   - npm build → webpack → Jest failures
 *   - Python venv → pip → pytest
 *   - Rust cargo build → clippy → test
 */
import type { ChallengeFixture } from "../types"

function ts(offset: number): string {
  return new Date(1727300000000 + offset * 1000).toISOString()
}

export const TIER2_CICD_EXPANSION_FIXTURES: readonly ChallengeFixture[] = [
  // 1. Docker build → push → deploy
  {
    id: "cicd-t2-01",
    tier: 2,
    category: "shell-pipelines",
    description: "Docker build, push to registry, and deploy",
    seed: 14001,
    input: {
      content: [
        `[Step 1/5] [${ts(0)}] tool=bash cmd="docker build -t myapp:v2.1.0 ."\nSending build context to Docker daemon  45.3MB\nStep 1/8 : FROM node:20-alpine AS builder\n ---> a1b2c3d4e5f6\nStep 2/8 : WORKDIR /app\n ---> Using cache\n ---> 9f8e7d6c5b4a\nStep 3/8 : COPY package*.json ./\n ---> 1122334455aa\nStep 4/8 : RUN npm ci --production\n ---> Running in container abc123\nStep 5/8 : COPY . .\nStep 6/8 : RUN npm run build\nStep 7/8 : FROM node:20-alpine\nStep 8/8 : CMD ["node", "dist/index.js"]\nSuccessfully built f1e2d3c4b5a6\nSuccessfully tagged myapp:v2.1.0`,
        `[Step 2/5] [${ts(30)}] tool=bash cmd="docker push registry.example.com/myapp:v2.1.0"\nThe push refers to repository [registry.example.com/myapp]\n5a4b3c2d: Pushed\ne6f7a8b9: Layer already exists\nv2.1.0: digest: sha256:abc123def456 size: 1789`,
        `[Step 3/5] [${ts(45)}] tool=bash cmd="kubectl set image deployment/myapp myapp=registry.example.com/myapp:v2.1.0"\ndeployment.apps/myapp image updated`,
        `[Step 4/5] [${ts(50)}] tool=bash cmd="kubectl rollout status deployment/myapp --timeout=120s"\nWaiting for deployment "myapp" rollout to finish: 1 of 3 updated replicas are available...\nWaiting for deployment "myapp" rollout to finish: 2 of 3 updated replicas are available...\ndeployment "myapp" successfully rolled out`,
        `[Step 5/5] [${ts(70)}] tool=bash cmd="kubectl get pods -l app=myapp"\nNAME                     READY   STATUS    RESTARTS   AGE\nmyapp-7b9d5f8c4-abc12   1/1     Running   0          25s\nmyapp-7b9d5f8c4-def34   1/1     Running   0          22s\nmyapp-7b9d5f8c4-ghi56   1/1     Running   0          19s`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "docker build",
      steps: [
        { tool: "bash", command: "docker build", content: "Successfully tagged myapp:v2.1.0", timestamp: ts(0) },
        { tool: "bash", command: "docker push", content: "v2.1.0: digest: sha256:abc123", timestamp: ts(30) },
        { tool: "bash", command: "kubectl set image", content: "image updated", timestamp: ts(45) },
        { tool: "bash", command: "kubectl rollout status", content: "successfully rolled out", timestamp: ts(50) },
        { tool: "bash", command: "kubectl get pods", content: "3/3 Running", timestamp: ts(70) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["myapp:v2.1.0", "Successfully tagged", "successfully rolled out", "Running"],
      workflow: "swe",
    },
  },

  // 2. Kubernetes apply → rollout → logs
  {
    id: "cicd-t2-02",
    tier: 2,
    category: "shell-pipelines",
    description: "K8s manifest apply with rollout monitoring and log inspection",
    seed: 14002,
    input: {
      content: [
        `[Step 1/5] [${ts(100)}] tool=bash cmd="kubectl apply -f k8s/"\nnamespace/staging unchanged\ndeployment.apps/api-server created\nservice/api-server created\nconfigmap/api-config configured\nsecret/api-secrets unchanged\ningress.networking.k8s.io/api-ingress created`,
        `[Step 2/5] [${ts(110)}] tool=bash cmd="kubectl rollout status deployment/api-server -n staging --timeout=90s"\nWaiting for deployment "api-server" rollout to finish: 0 of 2 updated replicas are available...\nWaiting for deployment "api-server" rollout to finish: 1 of 2 updated replicas are available...\ndeployment "api-server" successfully rolled out`,
        `[Step 3/5] [${ts(130)}] tool=bash cmd="kubectl logs deployment/api-server -n staging --tail=10"\n2026-09-22T10:30:00Z INFO  Starting API server on port 8080\n2026-09-22T10:30:01Z INFO  Connected to database: postgres://db:5432/app\n2026-09-22T10:30:02Z INFO  Loaded 12 route handlers\n2026-09-22T10:30:02Z INFO  Health check endpoint: /healthz\n2026-09-22T10:30:03Z INFO  Server ready to accept connections`,
        `[Step 4/5] [${ts(135)}] tool=bash cmd="curl -s http://api-server.staging.svc:8080/healthz"\n{"status":"healthy","version":"2.1.0","uptime":"5s"}`,
        `[Step 5/5] [${ts(140)}] tool=bash cmd="kubectl get ingress -n staging"\nNAME          CLASS   HOSTS              ADDRESS        PORTS   AGE\napi-ingress   nginx   api.example.com    10.0.0.100     80      35s`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "kubectl apply",
      steps: [
        { tool: "bash", command: "kubectl apply -f k8s/", content: "deployment.apps/api-server created\nservice created", timestamp: ts(100) },
        { tool: "bash", command: "kubectl rollout status", content: "successfully rolled out", timestamp: ts(110) },
        { tool: "bash", command: "kubectl logs", content: "Server ready to accept connections", timestamp: ts(130) },
        { tool: "bash", command: "curl healthz", content: '{"status":"healthy"}', timestamp: ts(135) },
        { tool: "bash", command: "kubectl get ingress", content: "api.example.com", timestamp: ts(140) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["api-server", "successfully rolled out", "healthy", "api.example.com"],
      workflow: "swe",
    },
  },

  // 3. npm build → webpack warnings → Jest failures
  {
    id: "cicd-t2-03",
    tier: 2,
    category: "shell-pipelines",
    description: "Frontend CI: build warnings + test failures + fix cycle",
    seed: 14003,
    input: {
      content: [
        `[Step 1/5] [${ts(200)}] tool=bash cmd="npm run build"\n> myapp@1.0.0 build\n> webpack --mode production\n\nWARNING in ./src/components/Dashboard.tsx\nModule Warning (from ./node_modules/css-loader/dist/cjs.js):\n  (28:3) Unexpected empty block\n\nWARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).\n  dist/main.js (312 KiB)\n\nwebpack compiled with 2 warnings in 8.3s`,
        `[Step 2/5] [${ts(215)}] tool=bash cmd="npx jest --ci"\nFAIL src/components/__tests__/Dashboard.test.tsx\n  ● Dashboard > renders user stats\n    TypeError: Cannot read properties of undefined (reading 'stats')\n      at Dashboard (src/components/Dashboard.tsx:15:22)\n      at renderWithHooks (node_modules/react-dom/...)\n\n  ● Dashboard > handles loading state\n    Expected element to have text content: "Loading..."\n    Received: ""\n\nTests: 2 failed, 12 passed, 14 total`,
        `[Step 3/5] [${ts(230)}] tool=edit\nFile updated: src/components/Dashboard.tsx\n  Added optional chaining for user.stats access\n  Added loading state check before rendering`,
        `[Step 4/5] [${ts(240)}] tool=bash cmd="npx jest --ci"\nPASS src/components/__tests__/Dashboard.test.tsx\nTests: 14 passed, 14 total\nTime: 3.2s`,
        `[Step 5/5] [${ts(250)}] tool=bash cmd="npm run build"\nwebpack compiled successfully in 7.9s`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "npm run build",
      steps: [
        { tool: "bash", command: "npm run build", content: "webpack compiled with 2 warnings", timestamp: ts(200) },
        { tool: "bash", command: "npx jest --ci", content: "2 failed, 12 passed", timestamp: ts(215) },
        { tool: "edit", content: "Fixed Dashboard.tsx", timestamp: ts(230) },
        { tool: "bash", command: "npx jest --ci", content: "14 passed, 14 total", timestamp: ts(240) },
        { tool: "bash", command: "npm run build", content: "compiled successfully", timestamp: ts(250) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["Dashboard.tsx", "TypeError", "14 passed, 14 total", "compiled successfully"],
      workflow: "swe",
    },
  },

  // 4. Python venv → pip → pytest
  {
    id: "cicd-t2-04",
    tier: 2,
    category: "shell-pipelines",
    description: "Python CI: venv creation, dependency install, and pytest",
    seed: 14004,
    input: {
      content: [
        `[Step 1/5] [${ts(300)}] tool=bash cmd="python3 -m venv .venv && source .venv/bin/activate"\nCreated virtual environment at .venv`,
        `[Step 2/5] [${ts(310)}] tool=bash cmd="pip install -r requirements.txt"\nCollecting fastapi==0.104.0\n  Downloading fastapi-0.104.0-py3-none-any.whl (92 kB)\nCollecting uvicorn[standard]==0.24.0\nCollecting sqlalchemy==2.0.23\nCollecting pydantic==2.5.0\nInstalling collected packages: pydantic, sqlalchemy, uvicorn, fastapi\nSuccessfully installed fastapi-0.104.0 pydantic-2.5.0 sqlalchemy-2.0.23 uvicorn-0.24.0`,
        `[Step 3/5] [${ts(330)}] tool=bash cmd="pytest -v --tb=short"\n============================= test session starts ==============================\nplatform linux -- Python 3.12.0, pytest-7.4.3\ncollected 18 items\n\ntests/test_api.py::test_create_user PASSED                              [  5%]\ntests/test_api.py::test_get_user PASSED                                 [ 11%]\ntests/test_api.py::test_update_user FAILED                              [ 16%]\ntests/test_db.py::test_connection_pool PASSED                           [ 22%]\ntests/test_db.py::test_migration PASSED                                 [ 27%]\ntests/test_db.py::test_rollback PASSED                                  [ 33%]\n\nFAILURES\n------\ntest_update_user - AssertionError: assert 200 == 422\n  response = client.put("/users/1", json={"email": "invalid"})\n------\n\n========================= 1 failed, 17 passed in 4.2s =========================`,
        `[Step 4/5] [${ts(345)}] tool=edit\nFile updated: app/api/routes/users.py\n  Added email validation with pydantic EmailStr type`,
        `[Step 5/5] [${ts(350)}] tool=bash cmd="pytest -v --tb=short"\n============================= test session starts ==============================\ncollected 18 items\n\n18 passed in 3.8s\n=============================== 18 passed ====================================`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "python3 -m venv",
      steps: [
        { tool: "bash", command: "python3 -m venv", content: "Created virtual environment", timestamp: ts(300) },
        { tool: "bash", command: "pip install", content: "Successfully installed fastapi", timestamp: ts(310) },
        { tool: "bash", command: "pytest -v", content: "1 failed, 17 passed", timestamp: ts(330) },
        { tool: "edit", content: "Added email validation", timestamp: ts(345) },
        { tool: "bash", command: "pytest -v", content: "18 passed", timestamp: ts(350) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["fastapi", "test_update_user FAILED", "18 passed", "EmailStr"],
      workflow: "swe",
    },
  },

  // 5. Rust cargo build → clippy → test
  {
    id: "cicd-t2-05",
    tier: 2,
    category: "shell-pipelines",
    description: "Rust CI: cargo build, clippy lints, and test suite",
    seed: 14005,
    input: {
      content: [
        `[Step 1/5] [${ts(400)}] tool=bash cmd="cargo build --release"\n   Compiling proc-macro2 v1.0.69\n   Compiling unicode-ident v1.0.12\n   Compiling serde v1.0.190\n   Compiling tokio v1.34.0\n   Compiling myapp v0.1.0 (/project)\n    Finished \`release\` profile [optimized] target(s) in 45.2s`,
        `[Step 2/5] [${ts(450)}] tool=bash cmd="cargo clippy -- -W clippy::all"\nwarning: redundant clone\n  --> src/handler.rs:42:18\n   |\n42 |     let name = user.name.clone();\n   |                         ^^^^^^^^\n   = help: remove this\n\nwarning: this expression creates a reference which is immediately dereferenced\n  --> src/db.rs:15:9\n   |\n15 |     &*connection\n   |     ^^^^^^^^^^^^\n\nwarning: \`myapp\` (lib) generated 2 warnings`,
        `[Step 3/5] [${ts(460)}] tool=edit\nFile updated: src/handler.rs\n  Removed redundant clone() on line 42\nFile updated: src/db.rs\n  Simplified reference on line 15`,
        `[Step 4/5] [${ts(465)}] tool=bash cmd="cargo clippy -- -W clippy::all"\n    Checking myapp v0.1.0 (/project)\n    Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 2.1s`,
        `[Step 5/5] [${ts(470)}] tool=bash cmd="cargo test"\nrunning 12 tests\ntest db::tests::test_connection ... ok\ntest db::tests::test_query ... ok\ntest handler::tests::test_create ... ok\ntest handler::tests::test_update ... ok\ntest handler::tests::test_delete ... ok\ntest auth::tests::test_verify_token ... ok\ntest auth::tests::test_expired_token ... ok\ntest auth::tests::test_invalid_signature ... ok\ntest integration::test_full_flow ... ok\ntest integration::test_concurrent ... ok\ntest integration::test_error_handling ... ok\ntest integration::test_rate_limiting ... ok\n\ntest result: ok. 12 passed; 0 failed; 0 ignored`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "cargo build",
      steps: [
        { tool: "bash", command: "cargo build --release", content: "Finished release", timestamp: ts(400) },
        { tool: "bash", command: "cargo clippy", content: "2 warnings", timestamp: ts(450) },
        { tool: "edit", content: "Fixed clippy warnings", timestamp: ts(460) },
        { tool: "bash", command: "cargo clippy", content: "Finished dev", timestamp: ts(465) },
        { tool: "bash", command: "cargo test", content: "12 passed; 0 failed", timestamp: ts(470) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["cargo", "redundant clone", "handler.rs", "12 passed; 0 failed"],
      workflow: "swe",
    },
  },
]
