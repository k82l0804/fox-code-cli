You are an expert software architect and senior code reviewer.

Project: "fox code cli" – a command-line tool with many recent changes and new features.

Task:
Create a complete, structured plan for a full codebase review. The plan should be designed for another AI (Claude Opus) to execute.

The plan must include:
1. Review Scope
   - Directories and file types to include/exclude.
   - Order of review (e.g., core modules → utilities → CLI entrypoints → tests).

2. Review Criteria
   - Bug detection
   - Logic errors and edge cases
   - Error handling and robustness
   - Security concerns
   - Performance issues
   - Code smells and maintainability
   - API consistency
   - CLI UX issues
   - Dependency risks

3. Commenting & Documentation Standards
   - When to add docstrings
   - When to add inline comments
   - Style guide (Google, NumPy, or custom)
   - Density guidelines (avoid obvious comments)

4. Output Format for Each File
   - Summary of what the file does
   - Bugs / issues with line numbers
   - Suggested fixes
   - Refactor recommendations
   - Proposed comments/docstrings (exact text)
   - Any missing tests

5. Execution Instructions for Claude Opus
   - How to process files one by one
   - How to maintain consistency across the review
   - How to handle ambiguous logic
   - How to propose improvements without rewriting the entire project

Deliver the plan in a clear, numbered, highly structured format.
