Kim, this hardening plan is already strong — it shows you’ve internalized the real risks surfaced in the Fox vs Kilo showdown and you’re building the right guardrails. But there *are* a few gaps and structural improvements that will make this plan safer, more future‑proof, and more robust as Fox’s compression layer grows.

Below is a clean breakdown of:

- **What the plan already does well**
- **Where the gaps are**
- **Concrete improvements you should add**
- **Why each improvement matters in real-world agent loops**

I’ll anchor each suggestion to the concerns raised in your report and the attached document.

---

# 🦊 What the Hardening Plan Already Does Well

Your plan directly addresses three of the biggest risks:

### **1. Git rewrite override (Concern #5)**  
You added:
- `raw git <cmd>`  
- `\git <cmd>`  
- `git --raw <cmd>`  
- `FOX_GIT_NO_REWRITE=true`  

This is exactly the right escape hatch.

### **2. Shell truncation override (Concern #6)**  
You added:
- `# no-truncate`  
- `FOX_SHELL_NO_TRUNCATE=true`  
- configurable line/byte limits  

This prevents accidental loss of important output.

### **3. Prefix stability (Concern #2)**  
You added:
- deterministic schema sorting  
- deterministic prompt assembly  
- SHA-256 prefix hashing  

This protects KV-cache reuse.

### **4. Compression invariants (Concern #1)**  
You added:
- fuzz tests for diffs  
- fuzz tests for test output  
- non-expansion invariant  

This protects correctness.

### **5. Telemetry (Concerns #3, #4, #7)**  
You added:
- rewrite count  
- truncation count  
- supersession count  

This is the right foundation.

---

# ⚠️ Gaps & Improvements You Should Add

Here are the missing pieces — the ones that matter most for long-term stability.

---

## **1. Add a “Compression Drift Detector” (Critical)**  
**Concern addressed:** #7 (Model drift), #1 (Semantic correctness)

Compression transforms can drift over time as code changes.  
You need a detector that runs *every CI*:

### **Add: `test/compression-drift.test.ts`**
This test should:

- Load a fixed set of canonical Git outputs  
- Load canonical diffs  
- Load canonical test logs  
- Load canonical build logs  
- Load canonical grep results  

Then assert:

- **byte-for-byte identical compression output**  
- **no new mutations**  
- **no new reorderings**  
- **no new deletions**  
- **no new expansions**  

This protects you from accidental regressions caused by:

- refactors  
- new flags  
- new regexes  
- new compression heuristics  
- new tool integrations  

This is the single most important missing guardrail.

---

## **2. Add “Supersession Safety Tests” (High Priority)**  
**Concern addressed:** #1 (Correctness), #7 (Drift)

Supersession is powerful but dangerous.

You need tests that assert:

### **Invariant: Supersession never hides information needed for the next turn.**

Add tests for:

- `git status` superseded → next turn still has correct file list  
- `git diff` superseded → next turn still has correct diff context  
- `git branch` superseded → next turn still has correct branch name  
- supersession pointer formatting is stable  
- supersession never triggers on unrelated commands  

This prevents subtle bugs where the agent loses state.

---

## **3. Add “Tool-Call Correctness Regression Tests” (Critical)**  
**Concern addressed:** #7 (Drift), #3 (Latency), #4 (Cache saturation)

Compression changes prompt shape.  
Prompt shape changes tool-call reliability.

You need a test suite that:

- runs 20–30 canonical prompts  
- asserts tool-call JSON is valid  
- asserts no hallucinated keys  
- asserts no missing keys  
- asserts no free-form text  
- asserts no schema violations  

This protects you from regressions caused by:

- schema minification  
- prompt compaction  
- supersession  
- truncation  
- Git rewrite  

This is essential.

---

## **4. Add “KV-Cache Latency Regression Tests” (High Priority)**  
**Concern addressed:** #3 (Latency), #4 (Cache saturation)

Prefix stability protects correctness —  
but you also need to protect *performance*.

Add a test that:

- runs a 10-turn simulated session  
- measures TTFT  
- measures total latency  
- measures cache-read latency  
- asserts no regression > 10%  

This prevents:

- accidental prefix growth  
- accidental schema growth  
- accidental prompt growth  
- accidental cache fragmentation  

This is especially important for your throttled corp models.

---

## **5. Add “Compression ROI Scoring” (Medium Priority)**  
**Concern addressed:** #3 (Latency), #4 (Cache saturation)

Every compression transform should have an ROI:

\[
ROI = \frac{\text{tokens saved}}{\text{compression overhead ms}}
\]

Add a test that:

- runs each transform individually  
- measures overhead  
- measures token savings  
- asserts ROI ≥ 5  

This prevents you from keeping transforms that:

- save 50 tokens  
- cost 200ms  

This is how you keep Fox fast.

---

## **6. Add “Workload Detection Tests” (Medium Priority)**  
**Concern addressed:** #6 (Truncation), #5 (Git rewrite)

Your compression should be workload-aware:

- SWE → full compression  
- Data → structured compression  
- Research → sectioning + indexing  
- Shell → Git + logs + tests  

Add tests that assert:

- correct workload detection  
- correct compression bundle activation  
- correct escape hatch behavior  

This prevents accidental compression in the wrong context.

---

## **7. Add “Full-Output Escape Hatch Tests” (High Priority)**  
**Concern addressed:** #6 (Truncation)

You added:

- `# no-truncate`  
- `--full-output`  
- `FOX_SHELL_NO_TRUNCATE=true`  

Now add tests that assert:

- full output is preserved  
- no compression is applied  
- no supersession is applied  
- no rewrite is applied  
- no truncation is applied  

This protects users who need full logs.

---

# 🧩 Additional Improvements to the Plan

Here are structural improvements to the plan itself.

---

## **A. Add a Phase 6: “Compression Drift Monitoring”**
This phase should include:

- drift detector  
- supersession safety tests  
- tool-call correctness tests  
- KV-cache latency tests  
- ROI scoring  

This is the missing “ongoing maintenance” phase.

---

## **B. Add a Phase 7: “Compression Telemetry Dashboard”**
You already added metrics — now visualize them:

- tokens saved per turn  
- compression overhead  
- supersession count  
- truncation count  
- rewrite count  
- cache-read latency  
- TTFT  

This helps you catch regressions early.

---

## **C. Add a Phase 8: “Compression Canary Mode”**
Add a flag:

```
FOX_COMPRESSION_CANARY=true
```

This mode:

- logs compression decisions  
- logs supersession decisions  
- logs rewrite decisions  
- logs truncation decisions  
- logs prefix hash  
- logs ROI  

This is invaluable for debugging.

---

# 🦊 Final Summary — What You Should Add

### **Critical additions**
- Compression drift detector  
- Supersession safety tests  
- Tool-call correctness regression tests  
- KV-cache latency regression tests  

### **High-priority additions**
- Full-output escape hatch tests  
- Workload detection tests  
- ROI scoring  

### **Structural additions**
- Phase 6: Drift monitoring  
- Phase 7: Telemetry dashboard  
- Phase 8: Canary mode  

These additions will make your compression layer:

- safer  
- more stable  
- more predictable  
- more maintainable  
- more robust  
- more future-proof  

And they directly address the concerns raised in your real-world A/B showdown.

If you want, I can help you write:

- the drift detector  
- the supersession safety tests  
- the prefix stability hash test  
- the ROI scoring harness  
- the telemetry dashboard schema  

Just tell me which one you want to tackle next.