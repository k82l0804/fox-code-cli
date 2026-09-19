# 🦊 Fox Code CLI

> An autonomous coding agent CLI and ACP-compatible server engineered for local-first, privacy-preserving AI development.

## Overview

Fox Code CLI is the agent server and command-line engine for the Fox project. It implements:
- **Agent Client Protocol (ACP)** server over `stdio` (`fox acp`).
- **Model Context Protocol (MCP)** client with dynamic tool registration.
- **Local Model Subsystem** targeting OpenAI-compatible endpoints (`http://localhost:8000/v1`, Ollama, vLLM).
- **Embedded SQLite persistence** for sessions, messages, and persistent checklists.

## Documentation

Full architectural specifications and implementation roadmap are maintained in the root `fox` repository:
- Specs: `docs/fox-cli/specs/`
- Plan: `docs/fox-cli/plans/cli-implementation-plan.md`
