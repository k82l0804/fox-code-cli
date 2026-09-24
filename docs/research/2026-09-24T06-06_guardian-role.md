# **Guardian System Specification (Supervisory Agent for Fox CLI)**  
**Version:** 1.0  
**Author:** Kim  
**Purpose:** Define the architecture, responsibilities, behaviors, and integration modes for the Guardian agent supervising Worker agents in Fox CLI.

---

## **1. Overview**
Fox is an **agentic system**, not an autocomplete tool. Worker agents execute multi-step tasks autonomously: planning, editing, running tests, retrying, and continuing until success or failure.

The **Guardian** is a second agent whose job is to supervise the Worker, detect failure modes, intervene when necessary, correct issues when possible, and ensure safe, coherent progress toward the task goal.

Guardian is not a linter, not a warning system, and not a static analyzer.  
Guardian is a **supervisory control agent**.

---

## **2. Guardian’s Core Mission**
Guardian’s mission is:

> **Ensure Worker agents complete tasks safely, coherently, and successfully by supervising, diagnosing, correcting, and orchestrating execution.**

Guardian must:

- Detect unsafe or incorrect Worker behavior  
- Stop harmful or incoherent actions  
- Diagnose what went wrong  
- Correct the issue when possible  
- Resume the Worker’s task flow  
- Escalate to the human (TUI mode) when correction requires human intent  
- Fully self-correct (CLI autonomy mode) when possible  

Guardian is responsible for **task integrity**, **repo safety**, and **execution reliability**.

---

## **3. Guardian Operating Modes**
Guardian has two operating modes, controlled by a config flag or environment variable:

### **3.1. Guardian Gatekeeper Mode (default for real users)**
Guardian actively supervises Worker execution.

Guardian may:
- Approve or reject diffs  
- Approve or reject plans  
- Stop unsafe loops  
- Stop incoherent execution  
- Rewrite plans  
- Rewrite diffs  
- Redirect Worker to correct files  
- Resume execution autonomously  
- Enforce constraints  
- Prevent drift  
- Prevent hallucinations  
- Prevent catastrophic edits  

This mode is available in both TUI and CLI.

### **3.2. Guardian Advisor Mode (expert/debug mode)**
Guardian only observes and reports.

Guardian may:
- Score diffs  
- Flag unsafe actions  
- Flag drift  
- Flag hallucinations  
- Flag blast radius  
- Flag constraint violations  
- Provide safety telemetry  

Guardian may **not**:
- Stop execution  
- Block diffs  
- Rewrite plans  
- Rewrite diffs  
- Control the loop  

This mode exists for benchmarking, research, and debugging.

---

## **4. Guardian Responsibilities**
Guardian has three major responsibilities.

### **4.1. Safety Brain**
Guardian must detect and stop:

- Unsafe diffs  
- Hallucinated file paths  
- Drift (editing unrelated files)  
- Over-editing  
- Runaway loops  
- Catastrophic actions (mass deletions, refactors)  
- Constraint violations  
- Tool misuse  
- Misinterpreted logs  
- Misinterpreted test failures  

### **4.2. Corrective Agent**
Guardian must attempt correction when possible:

- Rewrite incoherent plans  
- Rewrite unsafe diffs  
- Redirect Worker to correct files  
- Rewrite subtask instructions  
- Clarify misinterpreted test failures  
- Clarify misinterpreted logs  
- Re-scope the Worker’s next step  
- Re-anchor the Worker to the original task  

### **4.3. Task Orchestrator**
Guardian must maintain task integrity:

- Understand the overall task  
- Understand the plan  
- Understand subgoals  
- Track Worker progress  
- Decide when to intervene  
- Decide how to intervene  
- Decide how to resume execution  
- Escalate to human (TUI) when needed  
- Continue autonomously (CLI) when possible  

---

## **5. Guardian Intervention Protocol**
Guardian interventions follow a strict protocol.

### **5.1. Detection**
Guardian identifies a failure class:

- Unsafe diff  
- Drift  
- Hallucination  
- Over-editing  
- Looping  
- Misinterpretation  
- Constraint violation  
- Catastrophic action  
- Plan incoherence  

### **5.2. Stop**
Guardian halts Worker execution immediately.

### **5.3. Diagnose**
Guardian analyzes:

- What went wrong  
- Why it went wrong  
- Whether correction is possible  
- Whether human intent is required  

### **5.4. Correct (if possible)**
Guardian may:

- Rewrite the plan  
- Rewrite the diff  
- Rewrite the subtask  
- Redirect Worker  
- Re-scope the next step  
- Re-anchor the Worker to the task  

### **5.5. Resume**
Guardian resumes Worker execution:

- In TUI: only with human approval  
- In CLI autonomy: automatically  

### **5.6. Escalate (if needed)**
If correction requires human intent:

- Guardian stops  
- Guardian explains the issue  
- Guardian requests human decision  

---

## **6. Guardian Failure Classes**
Guardian must detect the following classes of failures:

1. Unsafe diffs  
2. Hallucinated paths  
3. Drift  
4. Over-editing  
5. Runaway loops  
6. Misinterpreting logs  
7. Misinterpreting test failures  
8. Editing the wrong file  
9. Plan incoherence  
10. Plan incompleteness  
11. Plan contradictions  
12. Tool misuse  
13. Constraint violations  
14. Catastrophic actions  

Guardian must be able to classify failures into these categories.

---

## **7. Guardian Integration Points**
Guardian integrates at the following points:

- After Worker generates a plan  
- After Worker generates a diff  
- After Worker runs tests  
- After Worker interprets logs  
- After Worker retries  
- After Worker loops  
- Before Worker applies changes  
- Before Worker continues execution  

Guardian must have visibility into:

- Worker’s plan  
- Worker’s diff  
- Worker’s tool calls  
- Worker’s test results  
- Worker’s logs  
- Worker’s next step  

---

## **8. Guardian Behavior in TUI vs CLI**
### **8.1. TUI Mode**
Guardian Gatekeeper:
- Stops unsafe actions  
- Diagnoses  
- Corrects  
- Presents correction to human  
- Resumes only with human approval  

Guardian Advisor:
- Warns  
- Scores  
- Flags  
- Does not stop execution  

### **8.2. CLI Autonomy Mode**
Guardian Gatekeeper:
- Stops unsafe actions  
- Diagnoses  
- Corrects  
- Resumes automatically  
- Escalates only when human intent is required  

Advisor mode is not available in CLI autonomy.

---

## **9. Guardian Design Principles**
1. **Guardian is a second agent, not a rule engine.**  
2. **Guardian supervises Worker execution.**  
3. **Guardian protects the repo.**  
4. **Guardian protects task integrity.**  
5. **Guardian corrects when possible.**  
6. **Guardian escalates when needed.**  
7. **Guardian resumes execution autonomously when appropriate.**  
8. **Guardian must be optional but default-enabled for real users.**  
9. **Guardian must be configurable via env var or config.**  
10. **Guardian must be architecturally separate from Worker.**

---

## **10. Deliverables for Architect**
Claude Opus 4.6 must produce:

1. **Guardian architecture diagram**  
2. **Guardian–Worker interaction protocol**  
3. **Guardian failure-class detection logic**  
4. **Guardian correction strategies**  
5. **Guardian plan-rewrite protocol**  
6. **Guardian diff-rewrite protocol**  
7. **Guardian escalation model**  
8. **Guardian resume model**  
9. **Guardian configuration system**  
10. **Guardian integration points in Fox CLI**  

---

## **11. Summary**
Guardian is a supervisory agent that:

- Detects failure  
- Stops execution  
- Diagnoses  
- Corrects  
- Resumes  
- Escalates when needed  

Guardian transforms Fox from a “smart code editor” into a **safe autonomous agent**.

This is a new class of CLI technology.
