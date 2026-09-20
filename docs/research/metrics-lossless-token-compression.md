Jaeger is exactly the right tool for evaluating whether each compression feature is *worth it*, because it gives you **ground‑truth timing**, **span‑level visibility**, and **per‑turn metrics** that let you see both token savings *and* performance impact in a way that’s objective and comparable across workloads.

Below is a clear, structured guide for how to use Jaeger with your new compression features — broken into **what to instrument**, **what to measure**, **how to interpret results**, and **how to decide if a feature stays or gets cut**.

This will give you a repeatable, scientific evaluation loop.

---

# ⭐ How to Use Jaeger to Evaluate Compression Features

## 1. Instrument the right spans  
You want Jaeger to show you **exactly where time is being spent** in the Fox CLI agent loop.

Here are the spans you should ensure are present (or add if missing):

### **A. Prompt Assembly**
- `prompt.build.system_prefix`
- `prompt.build.tool_schemas`
- `prompt.build.context_history`
- `prompt.build.user_message`
- `prompt.build.total`

This lets you see:
- How long schema minification takes  
- How long superseding takes  
- Whether indexing-aware retrieval adds overhead  
- Whether structured data compression is expensive  

### **B. Compression Passes**
Add spans for each compression feature:

- `compression.schema_minification`
- `compression.path_normalization`
- `compression.diff_trimming`
- `compression.superseding`
- `compression.structured_data`
- `compression.indexing_retrieval`
- `compression.kv_cache_alignment_check`

This gives you **per-feature cost**.

### **C. LLM Request**
Instrument:

- `llm.prefill` (TTFT)
- `llm.decode` (streaming)
- `llm.total_request_time`

This is the most important part for evaluating whether compression hurts or helps.

### **D. Tool Execution**
Instrument:

- `tool.run.<toolname>`
- `tool.output.postprocess`

This helps you see whether compression slows down tool output handling.

---

# ⭐ 2. Collect the right metrics from Jaeger

For each turn, extract:

### **A. Token Savings**
You already log token counts — pair them with Jaeger spans.

### **B. TTFT (Time to First Token)**
This is the prefill cost:
- If TTFT goes down → compression helps  
- If TTFT goes up → compression hurts  

### **C. Total Response Time**
This is the full latency:
- Includes compression overhead  
- Includes LLM decode time  

### **D. Compression Overhead**
From the compression spans:
- If a feature adds > 50–100 ms → noticeable  
- If a feature adds > 200 ms → borderline  
- If a feature adds > 300 ms → probably not worth it  

### **E. Tool-call correctness**
You can log:
- `tool_call.success = true/false`
- `tool_call.parse_time`

This is critical for schema changes.

---

# ⭐ 3. Evaluate each feature using Jaeger data

Here’s the decision framework you should apply:

## **A. Token Savings Threshold**
- **≥ 10% per turn** → worth considering  
- **≥ 20% per turn** → strong candidate  
- **≥ 30% per turn** → excellent  

## **B. Latency Threshold**
Compression overhead must be:
- **≤ 5% of total request time** → ideal  
- **≤ 10%** → acceptable  
- **≤ 15%** → acceptable only if token savings are huge  
- **> 20%** → reject unless extraordinary  
- **> 25%** → reject outright  

## **C. TTFT Threshold**
TTFT must not increase by:
- **> 10%** for SW dev  
- **> 15%** for data analysis  
- **> 20%** for research workloads  

Because TTFT is the “feel” of responsiveness.

## **D. Tool-call correctness**
- **≥ 99%** → safe  
- **95–98%** → risky  
- **< 95%** → reject  

Schema minification and compact signatures live or die here.

---

# ⭐ 4. How Jaeger helps you compare features

Jaeger gives you **per-turn spans**, which lets you see:

### **A. Does schema minification reduce TTFT?**
You’ll see:
- `prompt.build.tool_schemas` shrink  
- `llm.prefill` shrink  
- `llm.total_request_time` shrink  

### **B. Does structured data compression slow down Fox CLI?**
You’ll see:
- `compression.structured_data` cost  
- Compare against token savings  
- Compare against TTFT changes  

### **C. Does indexing-aware retrieval add overhead?**
You’ll see:
- `compression.indexing_retrieval` cost  
- Whether it reduces `prompt.build.context_history`  
- Whether TTFT improves  

### **D. Does superseding reduce context size?**
You’ll see:
- `prompt.build.context_history` shrink  
- `llm.prefill` shrink  
- `compression.superseding` cost  

### **E. Does KV-cache prefix freezing work?**
You’ll see:
- `llm.prefill` drop dramatically  
- TTFT drop by **10×–50×**  
- `compression.kv_cache_alignment_check` cost  

---

# ⭐ 5. How to decide if a feature stays or gets cut

Use this simple rule:

```
If token savings ≥ 10% AND TTFT increase ≤ 15% AND compression overhead ≤ 200ms AND tool-call correctness ≥ 99%:
    → Keep the feature
Else:
    → Reject or revise
```

This rule protects both:
- **Corp LLM server load**
- **User experience**

---

# ⭐ 6. How to use Jaeger with simulated workloads

You already plan to benchmark:

- SW dev  
- Data analysis  
- Research  

For each workload, Jaeger gives you:

- Per-turn TTFT  
- Per-turn compression overhead  
- Per-turn token savings  
- Per-turn tool-call correctness  
- Total session time  

This lets you produce a **workload × feature matrix**.

---

# ⭐ 7. The final benefit: Jaeger makes regressions obvious

If a feature is bad, Jaeger will show:

- TTFT spikes  
- Compression spans ballooning  
- Prompt assembly slowing down  
- Tool-call failures  
- Increased total request time  

If a feature is good, Jaeger will show:

- Smaller prompt assembly spans  
- Smaller prefill spans  
- Smaller total request time  
- Stable tool-call correctness  

Jaeger makes the decision objective.

---
