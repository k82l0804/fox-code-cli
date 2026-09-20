import type { CorpusFixture } from "../types"

export const TEST_OUTPUT_FIXTURES: readonly CorpusFixture[] = [
  {
    id: "test-01-bun-runner",
    name: "bun test (50 passing tests collapsed, failure preserved)",
    category: "test-output",
    tool: "bash",
    command: "bun test",
    content: `bun test v1.4.2 (744846f84)

packages/core/test/unit-0.test.ts:
${Array.from({ length: 30 }, (_, i) => `✓ packages/core/test/unit-${i}.test.ts > asserts invariant ${i} [0.${i}ms]`).join("\n")}
✗ packages/core/test/git.test.ts > handles detached head ref
  AssertionError: expected 'refs/heads/main' to equal 'HEAD'
    at /home/k82l0804/workarea/fox/fox-code-cli/packages/core/test/git.test.ts:142:15
    at runTest (/home/k82l0804/workarea/fox/fox-code-cli/packages/core/test/runner.ts:88:5)

${Array.from({ length: 20 }, (_, i) => `✓ packages/core/test/suite-${i}.test.ts > teardown cleanly [0.${i}ms]`).join("\n")}

 50 pass
 1 fail
 182 expect() calls
Ran 51 tests across 51 files. [240.00ms]`,
    mustContain: [
      "✗ packages/core/test/git.test.ts > handles detached head ref",
      "AssertionError: expected 'refs/heads/main' to equal 'HEAD'",
      "packages/core/test/git.test.ts:142:15",
      "1 fail",
    ],
    minExpectedReductionPct: 35,
  },
  {
    id: "test-02-vitest-runner",
    name: "vitest test report with stack trace",
    category: "test-output",
    tool: "bash",
    command: "npx vitest run",
    content: ` RUN  v1.6.0 /home/k82l0804/workarea/fox/fox-code-cli

${Array.from({ length: 25 }, (_, i) => ` ✓ test/components/button-${i}.spec.ts (2 tests) [${i * 2}ms]`).join("\n")}
 ❯ test/components/modal.spec.ts (1 test | 1 failed) [14ms]
   × renders modal overlay with backdrop blur
     TypeError: Cannot read properties of undefined (reading 'classList')
      ❯ test/components/modal.spec.ts:44:21
      ❯ async runSuite node_modules/vitest/dist/suite.js:102:7

 Test Files  1 failed | 25 passed (26)
      Tests  1 failed | 50 passed (51)
   Start at  18:45:00
   Duration  412ms`,
    mustContain: [
      "❯ test/components/modal.spec.ts (1 test | 1 failed)",
      "TypeError: Cannot read properties of undefined (reading 'classList')",
      "test/components/modal.spec.ts:44:21",
      "1 failed",
    ],
    minExpectedReductionPct: 20,
  },
  {
    id: "test-03-pytest-runner",
    name: "pytest python runner output with trace",
    category: "test-output",
    tool: "bash",
    command: "pytest tests/",
    content: `============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-8.1.1, pluggy-1.4.0
rootdir: /home/k82l0804/workarea/fox/fox-code-cli
collected 45 items

${Array.from({ length: 20 }, (_, i) => `tests/test_mod_${i}.py ............ [ ${i * 4}%]`).join("\n")}
tests/test_auth.py ..F..                                                 [ 90%]
tests/test_tokens.py ....                                                [100%]

=================================== FAILURES ===================================
_________________________________ test_expired _________________________________

    def test_expired():
>       assert token.is_valid() is False
E       AssertionError: assert True is False
E        +  where True = <Token expired=True>.is_valid()

tests/test_auth.py:28: AssertionError
=========================== short test summary info ============================
FAILED tests/test_auth.py::test_expired - AssertionError: assert True is False
======================== 1 failed, 44 passed in 1.45s =========================`,
    mustContain: [
      "FAILED tests/test_auth.py::test_expired - AssertionError: assert True is False",
      "tests/test_auth.py:28: AssertionError",
      "assert token.is_valid() is False",
      "1 failed, 44 passed",
    ],
    minExpectedReductionPct: 15,
  },
  {
    id: "test-04-cargo-test",
    name: "cargo rust test runner output",
    category: "test-output",
    tool: "bash",
    command: "cargo test --workspace",
    content: `   Compiling fox-core v0.1.0 (/home/k82l0804/workarea/fox/fox-code-cli/crates/core)
    Finished \`test\` profile [unoptimized + debuginfo] target(s) in 0.82s
     Running unittests src/lib.rs (target/debug/deps/fox_core-9a8b7c6d)

running 32 tests
${Array.from({ length: 30 }, (_, i) => `test buffer::tests::test_alloc_${i} ... ok`).join("\n")}
test cache::tests::test_eviction ... FAILED
test buffer::tests::test_flush ... ok

failures:

---- cache::tests::test_eviction stdout ----
thread 'cache::tests::test_eviction' panicked at crates/core/src/cache.rs:89:9:
assertion \`left == right\` failed
  left: 10
 right: 0
note: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace

failures:
    cache::tests::test_eviction

test result: FAILED. 31 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.12s`,
    mustContain: [
      "test cache::tests::test_eviction ... FAILED",
      "assertion `left == right` failed",
      "crates/core/src/cache.rs:89:9",
      "1 failed",
    ],
    minExpectedReductionPct: 20,
  },
  {
    id: "test-05-tsc-compiler-errors",
    name: "tsc compiler typecheck error log with line and column",
    category: "test-output",
    tool: "bash",
    command: "tsc --noEmit",
    content: `/home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/compress.ts:45:12 - error TS2322: Type 'string' is not assignable to type 'number'.

45   const x: number = "invalid-type";
              ~

/home/k82l0804/workarea/fox/fox-code-cli/src/session/supersede.ts:88:5 - error TS2339: Property 'nonExistentField' does not exist on type 'SessionMessage'.

88     msg.nonExistentField();
           ~~~~~~~~~~~~~~~~~

Found 2 errors in 2 files.

Errors  Files
     1  packages/core/src/tool/compress.ts:45
     1  src/session/supersede.ts:88`,
    mustContain: [
      "packages/core/src/tool/compress.ts:45:12 - error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/session/supersede.ts:88:5 - error TS2339: Property 'nonExistentField' does not exist on type 'SessionMessage'.",
      "Found 2 errors in 2 files.",
    ],
    minExpectedReductionPct: 10,
  },
  {
    id: "test-06-bun-install-noisy",
    name: "bun install noisy progress log (deduplicated)",
    category: "test-output",
    tool: "bash",
    command: "bun install",
    content: `bun install v1.4.2 (744846f84)
Resolving dependencies...
${Array(15).fill("[====================] Resolving 84 packages...").join("\n")}
Downloading packages...
${Array(20).fill("[====================] Downloading @effect/platform...").join("\n")}
Saved lockfile.

+ @effect/platform@0.72.0
+ effect@3.13.0

 182 packages installed [1.12s]`,
    mustContain: [
      "Resolving dependencies...",
      "Saved lockfile.",
      "+ @effect/platform@0.72.0",
      "+ effect@3.13.0",
      "182 packages installed",
    ],
    minExpectedReductionPct: 50,
  },
]
