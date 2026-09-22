# Autonomous SWE Agent — Benchmark Strategy

> **Purpose**: Identify the standard benchmarks for evaluating autonomous SWE
> agents, assess their relevance to Fox, and define an evaluation strategy.
> Links to the [reference architecture](./2026-09-22T15-16_autonomous-agent-workflow.md) phases
> where each benchmark provides signal.

---

## The Benchmark Landscape

There is no single unified benchmark for autonomous SWE agents. The field
uses a family of complementary benchmarks, each testing different capabilities.
SWE-bench is the dominant standard for code repair, but a complete evaluation
requires coverage across multiple dimensions.

---

## Tier 1 — Must-Have (Industry Standard)

### SWE-bench Verified

**The** canonical benchmark for autonomous software engineering agents.

| Property | Detail |
|---|---|
| **What it tests** | End-to-end issue resolution: agent receives a GitHub issue + full repo, must localize the bug, generate a patch, and pass the repo's test suite. |
| **Dataset** | 500 human-verified instances from real Python repositories (Django, scikit-learn, sympy, etc.). Curated to remove ambiguous/unsolvable tasks. |
| **Evaluation** | Dockerized harness. Each task runs in an isolated container matching the repo state at issue time. Binary pass/fail: patch must make relevant tests pass without breaking existing tests. |
| **Metric** | Resolution rate (% of instances resolved). |
| **Why it matters** | Tests the full autonomous loop: context discovery → planning → mutation → verification. Directly maps to Phases 1–5 of our [reference architecture](./2026-09-22T15-16_autonomous-agent-workflow.md). |

**How to run against a custom agent:**

```bash
# 1. Agent generates predictions (JSONL: instance_id + model_patch)
# 2. Official harness evaluates
python -m swebench.harness.run_evaluation \
  --dataset_name princeton-nlp/SWE-bench_Verified \
  --predictions_path predictions.jsonl \
  --max_workers 8 \
  --run_id fox-eval-001
```

**Limitations:**
- Python-only repositories
- Mostly localized bug fixes, not large architectural changes or multi-file features
- By 2026, faces scrutiny around training data contamination and test-set saturation
- Some teams supplement with SWE-bench Pro (larger, more diverse) or private eval sets

**Fox integration path:** Fox's `apply_patch` tool already generates unified diffs. The integration work is: (1) build a harness adapter that feeds SWE-bench issues to Fox via `fox run`, (2) collect the generated patches, (3) feed them to the official evaluation harness.

---

### Terminal-Bench

The standard for evaluating agents in realistic terminal environments.

| Property | Detail |
|---|---|
| **What it tests** | Multi-step CLI workflows: compiling code, configuring servers, debugging systems, installing dependencies. Tests tool use, long-horizon reasoning, and stateful environment interaction. |
| **Current version** | Terminal-Bench 4.0 (August 2026). 66 complex, community-contributed tasks across SWE, ML, systems, ops, and security. |
| **Evaluation** | Dockerized sandbox. Agent gets natural-language instructions + terminal access. Success is determined by pytest-style verification of the environment's final state. |
| **Metric** | Resolution rate (% of tasks completed within 8-hour timeout). |
| **Why it matters** | Tests capabilities that SWE-bench misses: shell tool mastery, environment management, multi-step debugging. Maps to Phase 3 (mutation via shell) and Phase 4 (verification in real environments). |

**Limitations:**
- Smaller task set (66 vs SWE-bench's 500)
- Tasks refresh with each version to prevent contamination
- More variable difficulty than SWE-bench

**Fox integration path:** Fox's `bash` tool and `--auto` mode already support terminal workflows. The challenge is the 8-hour timeout — Fox would need a harness adapter that maintains a long-running session against each task container.

---

## Tier 2 — Recommended (Complementary Signal)

### TAU2-Bench

| Property | Detail |
|---|---|
| **What it tests** | Multi-turn tool calling accuracy and planning. Tests whether the agent selects the right tool at the right time across a sequence of steps. |
| **Why it matters** | Fox's tool registry has 15+ tools (read, edit, apply_patch, bash, grep, glob, etc.). TAU2-Bench would measure how well the agent orchestrates them. Maps to Phase 2 (planning) and Phase 6 (routing decisions). |
| **Fox relevance** | High — directly tests the tool-use loop that is Fox's core interaction model. |

### Aider Polyglot Benchmark

| Property | Detail |
|---|---|
| **What it tests** | Multi-language code editing tasks. Tests whether the agent can correctly edit code across Python, JavaScript, TypeScript, Java, Go, Rust, and other languages. |
| **Why it matters** | SWE-bench is Python-only. Fox targets TypeScript/JavaScript primarily. The Aider Polyglot benchmark provides signal on multi-language edit quality. Maps to Phase 3 (mutation application). |
| **Fox relevance** | High — Fox needs TypeScript/JavaScript benchmarking that SWE-bench can't provide. |

### LiveBench (Coding + Agentic Coding)

| Property | Detail |
|---|---|
| **What it tests** | Contamination-resistant benchmark suite that refreshes tasks every 6 months. Separates "Coding" from "Agentic Coding" categories. |
| **Why it matters** | Addresses the contamination concern with SWE-bench. Provides a fresh, rotating task set that can't be memorized. |
| **Fox relevance** | Medium — useful for ongoing evaluation but less established than SWE-bench or Terminal-Bench. |

---

## Tier 3 — Specialized (Niche Signal)

| Benchmark | What it tests | Fox relevance |
|---|---|---|
| **MCP-Atlas** | Cross-server tool coordination, multi-environment orchestration | Medium — relevant when Fox supports MCP tool servers |
| **APEX-Agents** | Long-horizon professional tasks across apps (PDFs, spreadsheets, calendars) | Low — not SWE-specific |
| **OSWorld / WebArena** | GUI and web navigation, IDE interaction | Low — Fox is CLI-based, not GUI |
| **RE-Bench / HCAST** | Research workflows, safety reasoning, document analysis | Low — academic focus |
| **CursorBench** | Agent pass rate within Cursor IDE sessions | Low — IDE-specific, not applicable to CLI agents |
| **Arena (Agent Leaderboard)** | Human preference + objective success in real coding sessions | Medium — useful for qualitative comparison |

---

## What Each Benchmark Tests vs. Our Architecture

| Benchmark | P0 Init | P1 Context | P1.5 Spec | P2 Plan | P3 Mutate | P4 Verify | P5 Failure | P6 Route | P7 Context Mgmt | P8 Ship |
|---|---|---|---|---|---|---|---|---|---|---|
| **SWE-bench** | — | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | — | — |
| **Terminal-Bench** | — | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| **TAU2-Bench** | — | — | — | ✅ | — | — | — | ✅ | — | — |
| **Aider Polyglot** | — | — | — | — | ✅ | ✅ | — | — | — | — |
| **LiveBench** | — | ✅ | — | ✅ | ✅ | — | — | — | — | — |

Key observation: **No benchmark tests Phase 1.5 (Specification Elaboration), Phase 6 (Routing Decision), or Phase 8 (Review Gate + Ship).** These are process-level capabilities that require custom evaluation.

---

## Recommended Evaluation Strategy for Fox

### Primary Suite (run on every release candidate)

| Benchmark | What it proves | Target metric |
|---|---|---|
| **SWE-bench Verified** | Core autonomous SWE capability — can Fox fix real bugs? | Resolution rate (industry comparison available) |
| **Terminal-Bench 4.0** | Terminal mastery — can Fox operate in real environments autonomously? | Resolution rate |

### Secondary Suite (run quarterly or on major changes)

| Benchmark | What it proves | Target metric |
|---|---|---|
| **TAU2-Bench** | Tool orchestration quality — is Fox selecting the right tools? | Tool calling accuracy |
| **Aider Polyglot** | Multi-language edit quality (especially TypeScript) | Edit pass rate |
| **LiveBench Agentic** | Contamination-resistant general agentic coding | Score on coding + agentic coding categories |

### Custom Evaluation (Fox-specific, build internally)

Standard benchmarks don't cover everything Fox needs. Build internal evals for:

| Capability | How to test | Maps to |
|---|---|---|
| **Oscillation detection** | Craft tasks where the naive fix oscillates; measure whether Fox detects and recovers | Phase 5 |
| **Repair budget exhaustion** | Tasks with intentionally difficult fixes; measure whether Fox stops at budget and escalates | Phase 5, 6 |
| **Context management under load** | Long sessions (50+ turns); measure quality degradation vs. fresh sessions | Phase 7 |
| **Confidence gating** | Patches with ambiguous context; measure reject rate for low-confidence hunks | Phase 3 |
| **Compression effectiveness** | Token savings on real test outputs; measure LLTC pipeline token reduction | Phase 4 |
| **Snapshot/rollback fidelity** | Multi-file mutations followed by revert; verify workspace state matches baseline | Phase 0, 3 |

### Integration Architecture

```
┌─────────────────────────────────────────────────┐
│  Benchmark Harness Adapter                      │
│                                                 │
│  1. Reads task from benchmark dataset           │
│  2. Starts Fox in headless mode:                │
│     fox run --auto --prompt "<issue text>"      │
│  3. Collects output patch from Fox session      │
│  4. Formats as benchmark-expected JSONL         │
│  5. Submits to official evaluation harness      │
│                                                 │
│  Adapter per benchmark:                         │
│  - swe-bench-adapter.ts                         │
│  - terminal-bench-adapter.ts                    │
│  - tau2-adapter.ts                              │
└─────────────────────────────────────────────────┘
```

Key requirements for the adapter:
- Fox must support fully headless operation (`fox run --auto <prompt>`)  ✅ Already works
- Patch output must be extractable from Fox's session artifacts  ✅ Snapshot diffs available
- Timeout enforcement must be external (harness-level, not Fox-level)
- Each task must run in a fresh Fox session (no cross-contamination)

---

## References

- [SWE-bench](https://swebench.com) — Princeton NLP, official site + evaluation harness
- [Terminal-Bench](https://tbench.ai) — Official leaderboard and task sets
- [Aider Polyglot](https://aider.chat/docs/leaderboards/) — Aider's multi-language edit benchmark
- [Artificial Analysis Coding Agent Index](https://artificialanalysis.ai) — Composite industry index
- [arXiv:2510.09721](https://arxiv.org/abs/2510.09721) — Survey of 150+ papers on agent benchmarks
