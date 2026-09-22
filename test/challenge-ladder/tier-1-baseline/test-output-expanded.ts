/**
 * Tier 1 — Test Output Expanded (10 fixtures)
 *
 * 6 existing test-output fixtures + 4 new:
 *   - pytest verbose with parametrize markers
 *   - Jest snapshot failure diff
 *   - Flaky test with retry output
 *   - Coverage summary table
 */
import type { ChallengeFixture } from "../types"
import { TEST_OUTPUT_FIXTURES } from "../../corpora/test-output/fixtures"

const existingFixtures: ChallengeFixture[] = TEST_OUTPUT_FIXTURES.map((f, idx) => ({
  id: `test-t1-${String(idx + 1).padStart(2, "0")}`,
  tier: 1 as const,
  category: "test-output" as const,
  description: f.name,
  seed: 4000 + idx,
  input: {
    content: f.content,
    tool: f.tool,
    command: f.command,
  },
  expected: {
    type: "invariant" as const,
    mustContain: f.mustContain ? [...f.mustContain] : undefined,
    workflow: "swe" as const,
  },
}))

const newFixtures: ChallengeFixture[] = [
  {
    id: "test-t1-07",
    tier: 1,
    category: "test-output",
    description: "pytest verbose with parametrize markers (20 test cases)",
    seed: 4100,
    input: {
      content: [
        "============================= test session starts ==============================",
        "platform linux -- Python 3.12.1, pytest-8.3.4, pluggy-1.5.0 -- /usr/bin/python3",
        "cachedir: .pytest_cache",
        "rootdir: /srv/app",
        "configfile: pyproject.toml",
        "plugins: xdist-3.5.0, cov-5.0.0",
        "collected 20 items",
        "",
        ...Array.from({ length: 20 }, (_, i) => {
          const status = i === 7 || i === 14 ? "FAILED" : "PASSED"
          return `tests/test_math.py::test_calculate[case${i}-input${i}] ${status}`
        }),
        "",
        "=================================== FAILURES ===================================",
        "_________________ test_calculate[case7-input7] __________________",
        "",
        "    def test_calculate(input_val, expected):",
        "        result = calculate(input_val)",
        ">       assert result == expected",
        "E       AssertionError: assert 42.0 == 43.0",
        "E        +  where 42.0 = calculate(7)",
        "",
        "tests/test_math.py:15: AssertionError",
        "_________________ test_calculate[case14-input14] __________________",
        "",
        "    def test_calculate(input_val, expected):",
        "        result = calculate(input_val)",
        ">       assert result == expected",
        "E       AssertionError: assert 98.0 == 99.0",
        "E        +  where 98.0 = calculate(14)",
        "",
        "tests/test_math.py:15: AssertionError",
        "========================= 2 failed, 18 passed in 1.23s =========================",
      ].join("\n"),
      tool: "bash",
      command: "python -m pytest tests/test_math.py -v",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "test_calculate[case7-input7]",
        "test_calculate[case14-input14]",
        "assert 42.0 == 43.0",
        "2 failed, 18 passed",
      ],
      workflow: "swe",
    },
  },
  {
    id: "test-t1-08",
    tier: 1,
    category: "test-output",
    description: "Jest snapshot failure with inline diff",
    seed: 4101,
    input: {
      content: `FAIL src/components/__tests__/Button.test.tsx
  ● Button Component › renders primary variant correctly

    expect(received).toMatchInlineSnapshot(\`
    - Snapshot  - 3
    + Received  + 3

      <button
    -   class="btn btn-primary"
    +   class="btn btn-default"
    -   data-testid="submit-btn"
    +   data-testid="action-btn"
      >
    -   Submit
    +   Click Me
      </button>
    \`)

      12 |   const { container } = render(<Button variant="primary" />);
      13 |   expect(container.firstChild).toMatchInlineSnapshot(\`
    > 14 |     <button class="btn btn-primary" data-testid="submit-btn">Submit</button>
         |                                     ^
      15 |   \`);

Test Suites: 1 failed, 1 total
Tests:       1 failed, 3 passed, 4 total
Snapshots:   1 failed, 2 passed, 3 total`,
      tool: "bash",
      command: "npx jest --verbose",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "btn-primary",
        "btn-default",
        "submit-btn",
        "action-btn",
        "1 failed, 3 passed",
      ],
      workflow: "swe",
    },
  },
  {
    id: "test-t1-09",
    tier: 1,
    category: "test-output",
    description: "Flaky test with retry output (3 attempts)",
    seed: 4102,
    input: {
      content: `bun test v1.4.2 (744846f84)

=== Attempt 1/3 ===
✗ connects to database within timeout
  Timeout: connection exceeded 2000ms
    at /packages/db/test/connection.test.ts:18:12
 2 pass
 1 fail

=== Attempt 2/3 ===
✗ connects to database within timeout
  Timeout: connection exceeded 2000ms
    at /packages/db/test/connection.test.ts:18:12
 2 pass
 1 fail

=== Attempt 3/3 ===
✓ connects to database within timeout [1843ms]
 3 pass
 0 fail

Summary: Test passed after 3 attempts (flaky)
Total time: 6.2s
 3 expect() calls`,
      tool: "bash",
      command: "bun test test/connection.test.ts --retry 3",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "Attempt 1/3",
        "Attempt 3/3",
        "passed after 3 attempts",
        "connection exceeded 2000ms",
      ],
      workflow: "swe",
    },
  },
  {
    id: "test-t1-10",
    tier: 1,
    category: "test-output",
    description: "Coverage summary table with uncovered lines",
    seed: 4103,
    input: {
      content: `----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------|---------|----------|---------|---------|-------------------
All files |   84.32 |    71.28 |   89.47 |   83.91 |                   
 auth/    |   92.31 |    85.71 |  100.00 |   91.67 |                   
  login.ts|   95.00 |    90.00 |  100.00 |   94.44 | 45,67             
  register|   88.89 |    80.00 |  100.00 |   87.50 | 23-28,55          
 db/      |   78.57 |    60.00 |   83.33 |   77.78 |                   
  pool.ts |   71.43 |    50.00 |   75.00 |   70.00 | 34-42,78-85,102   
  query.ts|   85.71 |    70.00 |  100.00 |   85.71 | 56,89             
 api/     |   82.35 |    68.75 |   85.71 |   81.25 |                   
  routes  |   76.47 |    62.50 |   80.00 |   75.00 | 112-120,145-152   
  middleware|  88.24|    75.00 |  100.00 |   87.50 | 33,67             
----------|---------|----------|---------|---------|-------------------`,
      tool: "bash",
      command: "npx jest --coverage",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "84.32",
        "pool.ts",
        "34-42,78-85,102",
        "All files",
      ],
      workflow: "swe",
    },
  },
]

export const TIER1_TEST_OUTPUT_FIXTURES: readonly ChallengeFixture[] = [
  ...existingFixtures,
  ...newFixtures,
]
