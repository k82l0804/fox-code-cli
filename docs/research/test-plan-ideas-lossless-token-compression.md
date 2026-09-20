We’re going to benchmark Fox CLI with **single‑feature**, **multi‑feature**, and **all‑features** compression modes, then you *should* add **simulated workloads**. It’s the only way to get stable, comparable numbers across SW dev, data analysis, and research tasks.

Below is a **workload‑specific implementation roadmap**, followed by a **benchmarking plan** that includes simulated workloads. This is tailored to your actual usage patterns and the fact that you’re running **local models** and **throttled corporate models** (nemotron‑3‑ultra‑550b, gemma‑4‑30b, gpt‑oss‑120b).

---

# **Workload‑Specific Implementation Roadmap**

## 🧑‍💻 Software Development (gen, debug, refactor)
This workload is dominated by tool schemas, diffs, file reads, grep, and compiler output.

Your document states:  
> “Tool schemas… produce **3,000–5,000 tokens per request**.”  
> “Diff trimming… saves **40–50% of diff token count**.”

### **Priority order (SW dev)**  
1. **4.1A — Schema minification**  
   Biggest win per turn, lowest risk.  
2. **4.2 — Path prefix normalization**  
   Grep + compiler output benefit immediately.  
3. **4.5 — Diff context trimming**  
   Every refactor/edit turn benefits.  
4. **4.4 — Tool output superseding**  
   Helps long debugging sessions.  
5. **4.3 — KV‑cache prefix freezing**  
   Massive latency win once prefix is stable.  
6. **4.7 — Structured data compression**  
   Useful for logs, test output.  
7. **4.6 — Indexing-aware retrieval**  
   High payoff once indexing is mature.

### **Why this order works**
SW dev workloads hit schemas, diffs, and paths *every turn*, so you want those wins first. KV‑cache freezing is a multiplier on top.

---

## 📊 Data Analysis (CSV, JSON, logs, SQL)
This workload is dominated by structured data.

Your document states:  
> “Columnar encoding… **~60% token reduction**.”  
> “Structured data… **40–80% token reduction**.”

### **Priority order (Data analysis)**  
1. **4.7 — Structured data compression**  
   Columnar + key-shortening = huge wins.  
2. **4.1A — Schema minification**  
   Always helps.  
3. **4.4 — Superseding**  
   Repeated queries benefit.  
4. **4.2 — Path normalization**  
   Helps logs referencing paths.  
5. **4.3 — KV‑cache prefix freezing**  
   Latency multiplier.  
6. **4.6 — Indexing-aware retrieval**  
   Once indexing is ready, this becomes #1.

### **Why this order works**
Data workloads are dominated by repeated keys and large tables — compress those first.

---

## 📚 Research Papers & Summaries
This workload is dominated by long-form text and sectioning.

Your document states:  
> “A 20-page paper may be **8,000+ tokens**… only 500 tokens are relevant.”  
> “Indexing-aware retrieval… **2,000–10,000+ tokens per turn**.”

### **Priority order (Research)**  
1. **4.7 — Document sectioning + selective inclusion**  
   Immediate 50–80% reduction.  
2. **4.1A — Schema minification**  
   Always helps.  
3. **4.6 — Indexing-aware retrieval**  
   Once indexing is mature, this becomes #1.  
4. **4.3 — KV‑cache prefix freezing**  
   Latency multiplier.  
5. **4.4 — Superseding**  
   Helps when reading multiple versions of the same paper.  
6. **4.2 — Path normalization**  
   Minimal benefit.  
7. **4.5 — Diff trimming**  
   Not relevant.

### **Why this order works**
Research workloads benefit most from sectioning and indexing — not diffs or paths.

---

# **Benchmarking Plan (with simulated workloads)**

You’re planning:

- Baseline (current implementation)  
- One feature at a time  
- Multiple features  
- All features  

You *should* add simulated workloads — otherwise results will vary too much between runs.

Here’s the structure that will give you clean, comparable data.

---

## **1. Build three simulated workloads**

### **A. SW Dev Simulation**
- 10-turn session  
- Includes:  
  - 3 file reads  
  - 2 diffs  
  - 2 grep results  
  - 1 compiler error  
  - 1 git status  
- Total raw tokens: **8k–12k**

### **B. Data Analysis Simulation**
- 10-turn session  
- Includes:  
  - 2 CSVs (100–300 rows)  
  - 2 JSON arrays (50–100 objects)  
  - 1 SQL result set  
  - 2 logs (200–500 lines)  
- Total raw tokens: **10k–20k**

### **C. Research Simulation**
- 10-turn session  
- Includes:  
  - 1 long paper (8k tokens)  
  - 1 medium paper (3k tokens)  
  - 2 tables  
  - 1 summary request  
- Total raw tokens: **12k–18k**

---

## **2. Benchmark each workload under each compression mode**

### Modes:
1. **Baseline**  
2. **Single feature enabled**  
3. **Feature pairs**  
4. **All features except indexing**  
5. **All features including indexing**  

### Metrics to collect:
- **Input token count**  
- **TTFT**  
- **KV‑cache hit rate**  
- **Tool-call success rate**  
- **Task correctness**  
- **Context utilization**  

Your document states:  
> “Collect: input token count, TTFT, KV-cache hit rate, tool-call success rate, task completion.”

---

## **3. Run each workload against all your models**
- nemotron‑3‑ultra‑550b  
- gemma‑4‑30b  
- gpt‑oss‑120b  
- Local Llama / Codestral / Nemotron variants

This gives you a **model × workload × compression mode** matrix.

---

# **4. Why simulated workloads matter**
Without simulation:

- SW dev runs vary depending on the codebase  
- Data analysis varies depending on dataset size  
- Research varies depending on paper length  

Simulated workloads give you **repeatability**, which is essential when measuring:

- Token savings  
- Latency improvements  
- KV‑cache behavior  
- Throttling effects  

---

# **We should generate the full benchmark matrix?**

- A **benchmark plan document**  
- A **matrix of all test combinations**  
- A **workload generator spec**  
- A **scoring rubric**  
- A **result interpretation guide**

