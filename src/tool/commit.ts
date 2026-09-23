import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { InstanceState } from "@/effect/instance-state"
import { Config } from "@/config/config"
import { generateCommitMessage } from "@/foxcode/commit-message/generate"
import { Input, Output, toModelOutput } from "@opencode-ai/core/tool/commit"

export const Parameters = Input

export interface CommitResult {
  hash: string
  message: string
  filesChanged: number
  insertions: number
  deletions: number
}

function runGit(args: string[], cwd: string): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    windowsHide: true,
  })
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  }
}

export async function executeCommit(
  repoPath: string,
  params: { message?: string; files?: readonly string[]; amend?: boolean },
  options?: {
    config?: { auto_stage?: boolean; sign?: boolean; prefix?: string; prompt?: string }
    generateMessage?: (repoPath: string, files?: readonly string[]) => Promise<string>
  },
): Promise<CommitResult> {
  // 1. Check repo
  const checkRepo = runGit(["rev-parse", "--is-inside-work-tree"], repoPath)
  if (checkRepo.exitCode !== 0) {
    throw new Error(`Not a git repository: ${repoPath}`)
  }

  // 2. Staging
  if (params.files && params.files.length > 0) {
    const addResult = runGit(["add", "--", ...params.files], repoPath)
    if (addResult.exitCode !== 0) {
      throw new Error(`Failed to stage files: ${addResult.stderr.trim() || addResult.stdout.trim()}`)
    }
  } else if (options?.config?.auto_stage !== false) {
    // Stage tracked modified/deleted files by default
    const addResult = runGit(["add", "-u"], repoPath)
    if (addResult.exitCode !== 0) {
      throw new Error(`Failed to stage tracked files: ${addResult.stderr.trim() || addResult.stdout.trim()}`)
    }
  }

  // 3. Check for staged changes
  const diffCached = runGit(["diff", "--cached", "--quiet"], repoPath)
  const hasStagedChanges = diffCached.exitCode !== 0

  if (!hasStagedChanges && !params.amend) {
    throw new Error("nothing to commit (no changes staged)")
  }

  // 4. Determine commit message
  let commitMessage = params.message?.trim()
  if (!commitMessage) {
    if (params.amend && !hasStagedChanges) {
      // Reuse previous commit message if amending without new message or changes
      const prevMsg = runGit(["log", "-1", "--format=%B"], repoPath)
      commitMessage = prevMsg.stdout.trim()
    }
    if (!commitMessage) {
      if (options?.generateMessage) {
        commitMessage = await options.generateMessage(repoPath, params.files)
      } else {
        const res = await generateCommitMessage({
          path: repoPath,
          selectedFiles: params.files ? [...params.files] : undefined,
          prompt: options?.config?.prompt,
        })
        commitMessage = res.message.trim()
      }
    }
  }

  if (!commitMessage) {
    throw new Error("Could not determine commit message")
  }

  if (options?.config?.prefix && !commitMessage.startsWith(options.config.prefix)) {
    commitMessage = `${options.config.prefix}${commitMessage}`
  }

  // 5. Run git commit
  const commitArgs = ["commit", "-m", commitMessage]
  if (params.amend) {
    commitArgs.push("--amend")
  }
  if (options?.config?.sign) {
    commitArgs.push("-S")
  }

  const commitRun = runGit(commitArgs, repoPath)
  if (commitRun.exitCode !== 0) {
    throw new Error(`git commit failed: ${commitRun.stderr.trim() || commitRun.stdout.trim()}`)
  }

  // 6. Extract commit hash and stats
  const revParse = runGit(["rev-parse", "HEAD"], repoPath)
  const hash = revParse.stdout.trim()

  let filesChanged = 0
  let insertions = 0
  let deletions = 0

  const numstat = runGit(["diff-tree", "--no-commit-id", "--numstat", "-r", "HEAD"], repoPath).stdout.trim()
  if (numstat) {
    const lines = numstat.split("\n")
    filesChanged = lines.length
    for (const line of lines) {
      const parts = line.split("\t")
      if (parts.length >= 2) {
        const ins = parseInt(parts[0]!, 10)
        const del = parseInt(parts[1]!, 10)
        if (!isNaN(ins)) insertions += ins
        if (!isNaN(del)) deletions += del
      }
    }
  }

  const logMsg = runGit(["log", "-1", "--format=%B", "HEAD"], repoPath)
  const finalMessage = logMsg.stdout.trim() || commitMessage

  return {
    hash,
    message: finalMessage,
    filesChanged,
    insertions,
    deletions,
  }
}

export const CommitTool = Tool.define(
  "commit",
  Effect.gen(function* () {
    const config = yield* Config.Service

    return {
      description:
        "Commit staged changes with a generated or provided commit message. Automatically stages modified tracked files and generates a conventional commit message from the diff.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const repoPath = instance.directory
          const cfg = yield* config.get()

          yield* ctx.ask({
            permission: "commit",
            patterns: [params.message ?? "*"],
            always: ["*"],
            metadata: {
              message: params.message,
              files: params.files,
              amend: params.amend,
            },
          })

          const result = yield* Effect.tryPromise({
            try: () =>
              executeCommit(repoPath, params, {
                config: {
                  auto_stage: cfg.commit?.auto_stage,
                  sign: cfg.commit?.sign,
                  prefix: cfg.commit?.prefix,
                  prompt: cfg.commit_message?.prompt,
                },
              }),
            catch: (err) => (err instanceof Error ? err : new Error(String(err))),
          })

          return {
            title: `[Commit ${result.hash.slice(0, 7)}] ${result.message.split("\n")[0]}`,
            output: toModelOutput(result),
            metadata: result,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
