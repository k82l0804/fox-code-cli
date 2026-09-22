### Quick read — verdict first

**High priority (implement early):**
- **Tool schema minification (4.1A: strip redundant JSON keys).** Big token win, low risk; keep JSON Schema shape.   
- **KV-cache prefix freezing (4.3).** Massive latency win on local GPUs if you make the system prefix byte-stable. Enforce deterministic tool ordering and move ephemeral data to the tail.   
- **Path prefix normalization (4.2).** Tiny effort, immediate savings for grep/compile outputs. Safe and lossless. 

**Medium priority (phase 1→2):**
- **Structured data compression (4.7 columnar / log dedup).** Large wins for tabular workloads; implement format-aware post-processors.   
- **Diff/diff-context trimming (4.5).** Low risk; reduce `-U3` → `-U1` for tool diffs. Models handle unified diffs fine. 

**Lower priority / higher risk (test first):**
- **Compact TypeScript-like tool signatures (4.1B).** High token savings but **risk of breaking model function-calling**; proxy A/B test first.   
- **Tool output superseding (4.4).** Useful in long sessions but needs careful per-tool policy and UX to avoid confusing references. Test with conservative rules.   
- **Indexing-aware retrieval (4.6).** Highest long-term impact but depends on index maturity; integrate once indexing is stable. 

---

### Why these priorities (short rationale)

1. **Low-effort, low-risk wins first.** Stripping redundant JSON Schema keys, normalizing paths, trimming diff context, and columnar/log compression are straightforward post-processors that don’t change the protocol shape the model expects. They give immediate token reductions with minimal model-compatibility risk. 

2. **KV-cache discipline unlocks multiplicative speedups.** If you can make the system prefix byte-identical across turns, local engines reuse KV tensors and avoid re-prefill for that prefix entirely — that’s orders-of-magnitude TTFT improvement for the cached portion. But it requires auditing prompt assembly so nothing dynamic creeps into the prefix. This is infrastructure work with huge payoff. 

3. **Protocol-shape changes need careful validation.** Replacing JSON Schema with compact signatures risks breaking models fine-tuned on OpenAI-style function calling. Use a proxy to A/B test compact formats before committing to code changes. 

4. **Supersession and indexing are powerful but stateful.** Superseding historical outputs and selective retrieval reduce long-session bloat, but they change the conversation’s apparent history and require robust bookkeeping (argument hashing, supersession policies, provenance markers). Indexing requires a mature vector store and chunking strategy to be safe and effective. 

---

### Risk assessment sanity-check (on your table)

Your **risk categories** look accurate overall. A few clarifications:

- **4.1A (strip JSON keys) — Risk = Low/Medium:** Correct: removing purely redundant metadata is safe for models that parse JSON Schema. Still validate that you don’t remove keys some adapters rely on (e.g., `additionalProperties` sometimes used by function-call validators). Test across models. 

- **4.1B (compact signatures) — Risk = Medium→High in practice:** Many local models are fine-tuned to expect JSON Schema for structured outputs; compact signatures often cause models to emit free-form text instead of structured calls. Treat this as high-risk until you have A/B proxy evidence. 

- **4.3 (KV-cache freezing) — Risk = Low but operationally tricky:** The change is not model-facing, but it’s brittle: any nondeterministic insertion (timestamps, counters, nondeterministic tool ordering) will invalidate the cache. Add tests that assert byte-stability across turns. 

- **4.4 (superseding) — Risk = Medium:** The main hazard is breaking references to earlier outputs (e.g., “see the `git status` from step 2”). Mitigate by keeping a compact provenance marker (`[superseded by step N — full output archived at /path]`) and by only superseding idempotent/read-only tools. 

---

### Practical implementation plan (concrete steps)

**Phase 1 — Quick wins (2–4 weeks):**
1. **Implement path normalization** in the tool output post-processor. Single-line change per tool: compute `relativePath` and emit a single `[CWD: ...]` header. Add unit tests.   
2. **Add schema-stripping pass (4.1A)** in `ToolSchemaProjection.openAI()` that removes `$schema`, redundant `title`, `examples` used only for docs, and `additionalProperties: false` only if your function-caller still validates shape elsewhere. Keep the JSON Schema envelope. Add a toggle `provider.local` to enable more aggressive compaction.   
3. **Diff context trimming**: change `-U3` → `-U1` for tool-generated diffs; add tests that diffs still apply cleanly.   
4. **Structured data post-processors**: implement CSV/JSON→columnar conversion and log deduplication. Detect content type heuristically and fall back to raw if detection fails. 

**Phase 2 — Infrastructure (4–8 weeks):**
5. **Prompt prefix audit & KV-cache enforcement**: make system prompt + tool schemas a frozen byte-stable prefix. Move dynamic metadata to the user message tail. Add deterministic tool ordering (alphabetical) and a CI test that computes a hash of the prefix and fails on changes. Monitor KV-cache hit rates in vLLM/llama.cpp metrics.   
6. **Proxy for schema A/B testing**: build a lightweight compression proxy that can toggle transforms (strip-only vs compact signatures) and log tool-call success rates and token counts. Use it to test 4.1B before changing production code. 

**Phase 3 — Stateful optimizations (8+ weeks):**
7. **Tool output superseding**: implement `SupersessionPolicy` per tool, argument hashing, and a compact marker format. Start with `git_status`, `read`, `grep` as candidates. Provide a developer flag to disable superseding for debugging.   
8. **Indexing-aware retrieval**: when your indexing pipeline is production-ready, wire `CodeIndexManager.searchIndex()` into a `ContextBudgetAllocator` that picks top chunks, deduplicates overlaps, and summarizes lower-ranked hits. Add provenance lines for each chunk (file:lines). 

---

### Validation & metrics (what to measure)

For each strategy run the same benchmark across models and collect:
- **Input token count** (before/after).  
- **TTFT** (prefill time → first token).  
- **KV-cache hit rate** (vLLM/llama.cpp metrics).  
- **Tool-call success rate / parse correctness** (especially for schema changes).  
- **Task completion / correctness** (end-to-end agent behavior). 

Use the **proxy** for rapid A/B testing of schema formats and to log token savings without touching Fox code. For KV-cache experiments you must change prompt assembly in the app (proxy cannot simulate prefix pinning reliably).

---

### Additional ideas you didn’t list (worth considering)

1. **Binary prefix caching via hashed manifest.** Keep a short manifest in the system prefix that lists the canonical tool set and a SHA256 of the full schema bundle. The model sees the manifest (stable), and when it needs schema details you can append a compressed payload only when necessary. This preserves byte-stability while still making full schemas available on-demand. 

2. **On-demand schema expansion.** Send compact schema signatures in the prefix and only include full JSON Schema when the model requests it (detect via a special function call or a reserved token). This is similar to lazy-loading and reduces per-request tokens. Requires a small protocol handshake. 

3. **Lossless token packing for repeated keys.** For JSON-heavy tool outputs, use a short legend (key→short token) at the top and then emit rows with short keys. This is essentially your JSON key shortening but formalized as a tiny, reversible encoding that your post-processor can decode for tools that need raw JSON. 

4. **Adaptive context budgeting.** Track which context regions the model actually attends to (via attention probing or token-level saliency approximations) and bias retrieval/compaction toward historically high-utility regions. This is researchy but can pay off for very large codebases. 

---

### Short checklist you can run now

- [ ] Add unit tests for deterministic tool ordering and prefix hashing.  
- [ ] Implement schema-stripping pass behind a feature flag.  
- [ ] Add path-relative post-processor for tool outputs.  
- [ ] Build a small compression proxy to A/B test compact schema formats.  
- [ ] Add KV-cache hit-rate monitoring to your benchmark harness.  

---

### Final note — tradeoffs and guardrails

- **Always keep a toggle and telemetry.** Any change that alters schema shape or conversation history must be feature-flagged and monitored for tool-call regressions. Log parse failures and task failures separately so you can roll back quickly. 

- **Be conservative with anything that changes the model-facing protocol.** Start with format-preserving optimizations (strip keys, path normalization, columnar tables) and only move to protocol changes (compact signatures, on-demand expansion) after proxy validation across multiple local models. 

---
