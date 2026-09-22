There *are* several **industry‑standard SWE test suites** that map perfectly to Fox’s workflows and can serve as a **canonical, stable, repeatable benchmark corpus**.

Given Fox’s mission (SWE agent, Git-heavy workflows, diff/edit/test cycles), the right approach is to adopt **a curated set of existing SWE test suites** rather than inventing one.

Below is the list you should use — and why each one matters.

---

# 🦊 The 5 Standard SWE Test Suites You Should Adopt

These are widely used, stable, and perfectly aligned with Fox’s workflows.

## **1. The “Agent Coding Tasks” Benchmark (OpenAI / SWE-bench style)**
This is the closest thing to a standard for agentic coding evaluation.

Includes:
- multi-file bug fixing  
- diff application  
- test-driven repair  
- dependency resolution  
- real-world Git workflows  

Why Fox should use it:
- mirrors Fox’s actual workflows  
- tests diff correctness  
- tests edit correctness  
- tests multi-turn reasoning  
- tests tool-call reliability  

This is the **gold standard** for SWE agents.

---

## **2. The “GitOps Workflow Suite” (GitHub Actions / DevOps patterns)**
This is not a single suite, but a set of canonical Git workflows:

- `git status` → `git add` → `git commit`  
- `git diff` → patch application  
- merge conflict resolution  
- branch switching  
- log inspection  
- tag creation  

Why Fox should use it:
- directly exercises your Git compression layer  
- tests rewrite correctness  
- tests supersession correctness  
- tests lockfile collapsing  
- tests truncation escape hatches  

This is essential for validating your Git transforms.

---

## **3. The “Build/Test/CI Loop” Suite (Bun/Jest/Vitest/Cargo/Pytest)**
This suite includes:

- repetitive passing tests  
- failing tests  
- stack traces  
- build logs  
- compiler errors  
- dependency installation logs  

Why Fox should use it:
- directly exercises test-output filtering  
- validates lossless failure preservation  
- validates log dedup  
- validates truncation safety  
- validates supersession behavior  

This is the **canonical test-output compression suite**.

---

## **4. The “Diff Corpus” (Unified, Context, Inline, Multi-hunk)**
This is a standard diff corpus used in:

- Git tooling tests  
- patch application tests  
- diff parsers  
- code review tools  

Includes:
- multi-hunk diffs  
- whitespace-only diffs  
- lockfile diffs  
- binary diffs  
- edge-of-file diffs  

Why Fox should use it:
- validates diff trimming  
- validates lockfile collapsing  
- validates non-expansion invariants  
- validates supersession correctness  

This is the **canonical diff compression suite**.

---

## **5. The “Shell Output Corpus” (POSIX + GNU + Bun + Node)**
Includes:

- long logs  
- noisy CLI output  
- multi-line errors  
- grep results  
- find results  
- build output  
- dependency installation logs  

Why Fox should use it:
- validates truncation logic  
- validates escape hatches (`# no-truncate`)  
- validates rewrite bypass (`raw git`)  
- validates path normalization  

This is the **canonical shell compression suite**.

---

# 🧠 How These Fit Fox’s Architecture

Your workflow model:

> **Workflow = compression bundle**  
> **Tools = transforms inside the bundle**

These suites map perfectly:

| Workflow | Standard Suite |
|---------|----------------|
| `swe` | SWE-bench + GitOps + Diff Corpus + Test Corpus |
| `data` | Build/Test Corpus + JSON/CSV Corpus |
| `research` | Document Corpus (arXiv, Markdown, PDF→text) |
| `shell` | Shell Output Corpus |
| `none` | All suites in raw mode |

This gives you **complete coverage** without inventing a new standard.

---

# 🦊 Recommended “Fox Standard Test Suite” (Your curated version)

You should create a curated bundle:

### **Fox Standard Suite**
1. **SWE-bench mini** (10–20 tasks)  
2. **GitOps Workflow Corpus**  
3. **Diff Corpus**  
4. **Test Output Corpus**  
5. **Shell Output Corpus**  
6. **Document Corpus** (for research workflow)

This becomes your **canonical regression suite**.

---

# 🎯 Final Recommendation

There is no single “industry standard” for agentic compression — but there *are* standard SWE test suites that map perfectly to Fox’s workflows.

You should adopt:

- **SWE-bench tasks**  
- **GitOps workflows**  
- **Diff corpus**  
- **Test-output corpus**  
- **Shell-output corpus**  

And combine them into a **Fox Standard Test Suite**.

This will give you:

- deterministic coverage  
- compression correctness validation  
- supersession safety validation  
- rewrite safety validation  
- truncation safety validation  
- prefix stability validation  
- multi-turn agent correctness validation  
