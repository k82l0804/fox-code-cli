# 🥊 Why Fox? Competitive Landscape & Performance Comparison

> **Specification Reference:** [docs/competitive-analysis.md](../../docs/competitive-analysis.md)  
> **Topic:** AI Coding Agent CLI Architectural & Performance Benchmark Comparison

For the full detailed document, see [`../../docs/competitive-analysis.md`](../../docs/competitive-analysis.md).

---

## 📊 Summary Feature Comparison

| Capability / Metric | **🦊 Fox Code CLI** | **Claude Code** (Anthropic) | **Aider** (Paul Gauthier) | **Kilo Code** (Upstream) | **Goose** (Block) | **OpenHands** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Core Runtime Engine** | **Bun + Effect TS** | Node.js | Python 3 | Bun + Effect TS | Rust | Python / Docker |
| **Strictly Local / Offline Inference** | **✅ 100% Local-First** | ❌ Anthropic API only | ⚠️ Via LiteLLM/Ollama | ⚠️ Cloud Catalog deps | ✅ Multi-provider | ⚠️ Heavy Docker |
| **Lossless Tool Token Compression** | **✅ Yes (-52% to -76%)** | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| **Standard Test Suite & Scoreboard** | **✅ Yes (52 Golden Fixtures)**| ❌ No | ❌ No | ❌ No | ❌ No | ⚠️ SWE-bench only |
| **KV-Cache Prefix Stability** | **✅ Deterministic sha256** | ⚠️ Cloud-managed | ⚠️ Heuristic | ❌ None | ❌ None | ❌ None |
| **Editor Integration Protocol** | **✅ ACP (JSON-RPC 2.0)** | ❌ Custom CLI only | ❌ Custom CLI only | ✅ ACP | ⚠️ MCP only | ❌ Web UI only |
| **Git Command Rewriting (`-sb`, `-U1`)** | **✅ Automatic** | ❌ Raw output | ❌ Raw output | ❌ Raw output | ❌ Raw output | ❌ Raw output |
| **Lockfile Diff Collapsing** | **✅ Built-in (95%+ saved)** | ❌ Raw diffs | ❌ Raw diffs | ❌ Raw diffs | ❌ Raw diffs | ❌ Raw diffs |
| **Type-Safe Workflow Profiles** | **✅ Yes (`swe`, `data`, etc.)**| ❌ No | ⚠️ Architect mode | ❌ No | ❌ No | ❌ No |
| **Cloud Telemetry & Tracking** | **✅ 100% Stripped & Clean** | ❌ Cloud telemetry | ✅ Clean | ⚠️ Remote checks | ✅ Clean | ⚠️ Docker tracking |
| **Startup & Overhead Latency** | **⚡ Sub-5ms** | ~200ms | ~500ms–1s | ~50ms | ⚡ Fast (Rust) | Heavy (Container) |

---

## 🚀 Key Takeaways

- **-52.3% Baseline Token Reduction**: Proven across 52 standard fixtures with 100% invariant preservation.
- **-76.4% Cumulative Token Savings**: On multi-turn autonomous coding benchmarks vs uncompressed baselines (Kilo).
- **100% Privacy & Local Inference**: Zero cloud gateways, zero remote telemetry beacons, sub-30s offline resilience.
- **Protocol-First (ACP)**: Connects to VS Code and any editor client via standard JSON-RPC 2.0 over `stdio`.
