import { Effect } from "effect"
import type { Argv } from "yargs"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { effectCmd, fail } from "../effect-cmd"
import { Git } from "@/git"
import { InstanceRef } from "@/effect/instance-ref"
import { Process } from "@/util/process"
import { existsSync } from "node:fs"
import { detectPrLink, parseGitRemote, parsePrUrl, readPrLinkOverride, writePrLinkOverride } from "@/foxcode/pr-link"

const subcommand = "pr"
export function cliCommand(
  input = {
    execPath: process.execPath,
    argv: process.argv,
    exists: existsSync,
  },
) {
  const script = input.argv[1]
  if (!script) return [input.execPath]
  if (script === subcommand) return [input.execPath]
  if (script.startsWith("/$bunfs/root/")) return [input.execPath]
  if (script.startsWith("B:/~BUN/root/")) return [input.execPath]
  if (input.exists(script)) return [input.execPath, script]
  return [input.execPath]
}
export const PrCommand = cmd({
  command: subcommand,
  describe: "manage pull requests",
  builder: (yargs: Argv) =>
    yargs
      .command(PrCheckoutCommand)
      .command(PrLinkCommand)
      .command(PrUnlinkCommand)
      .command(PrStatusCommand)
      .demandCommand(),
  async handler() {},
})

export const PrCheckoutCommand = effectCmd({
  command: "checkout <number>",
  describe: "fetch and checkout a pull/merge request branch, then run fox",
  builder: (yargs) =>
    yargs.positional("number", {
      type: "number",
      describe: "PR/MR number to checkout",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.pr.checkout")(function* (args) {
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")
    if (ctx.project.vcs !== "git") {
      return yield* fail("Could not find git repository. Please run this command from a git repository.")
    }

    const git = yield* Git.Service
    const worktree = ctx.worktree

    const prNumber = args.number
    const cli = cliCommand()

    const originResult = yield* git.run(["remote", "get-url", "origin"], { cwd: worktree })
    let rawUrl: string | undefined = originResult.exitCode === 0 ? originResult.text().trim() : undefined

    if (!rawUrl) {
      const remotesResult = yield* git.run(["remote"], { cwd: worktree })
      const firstRemote =
        remotesResult.exitCode === 0 ? remotesResult.text().trim().split("\n")[0]?.trim() : undefined
      if (firstRemote) {
        const remoteResult = yield* git.run(["remote", "get-url", firstRemote], { cwd: worktree })
        if (remoteResult.exitCode === 0) {
          rawUrl = remoteResult.text().trim()
        }
      }
    }

    const remote = rawUrl ? parseGitRemote(rawUrl) : undefined
    const host = remote?.host.toLowerCase() ?? ""
    const isGitHub = host === "github.com"
    const isGitLab = host.includes("gitlab")

    let localBranchName: string

    if (isGitHub) {
      localBranchName = `pr/${prNumber}`
      UI.println(`Fetching and checking out PR #${prNumber}...`)

      const checkout = yield* Effect.promise(() =>
        Process.run(["gh", "pr", "checkout", `${prNumber}`, "--branch", localBranchName, "--force"], { nothrow: true }),
      )
      if (checkout.code !== 0) {
        return yield* fail(`Failed to checkout PR #${prNumber}. Make sure you have gh CLI installed and authenticated.`)
      }

      const prInfoResult = yield* Effect.promise(() =>
        Process.text(
          [
            "gh",
            "pr",
            "view",
            `${prNumber}`,
            "--json",
            "headRepository,headRepositoryOwner,isCrossRepository,headRefName",
          ],
          { nothrow: true },
        ),
      )

      if (prInfoResult.code === 0 && prInfoResult.text.trim()) {
        try {
          const prInfo = JSON.parse(prInfoResult.text)
          if (prInfo?.isCrossRepository && prInfo.headRepository && prInfo.headRepositoryOwner) {
            const forkOwner = prInfo.headRepositoryOwner.login
            const forkName = prInfo.headRepository.name
            const remoteName = forkOwner

            const remotes = (yield* git.run(["remote"], { cwd: worktree })).text().trim()
            if (!remotes.split("\n").includes(remoteName)) {
              yield* git.run(["remote", "add", remoteName, `https://github.com/${forkOwner}/${forkName}.git`], {
                cwd: worktree,
              })
              UI.println(`Added fork remote: ${remoteName}`)
            }

            yield* git.run(["branch", `--set-upstream-to=${remoteName}/${prInfo.headRefName}`, localBranchName], {
              cwd: worktree,
            })
          }
        } catch {}
      }
    } else if (isGitLab) {
      localBranchName = `mr/${prNumber}`
      UI.println(`Fetching and checking out MR !${prNumber}...`)

      const glabInstalled = yield* Effect.promise(() =>
        Process.run(["glab", "--version"], { nothrow: true }).then((res) => res.code === 0),
      )
      if (!glabInstalled) {
        return yield* fail(
          `GitLab remote detected, but the 'glab' CLI is not installed.\n` +
            `Please check out the branch manually using git, and link it with:\n` +
            `  fox pr link <merge-request-url>`,
        )
      }

      const checkout = yield* Effect.promise(() =>
        Process.run(["glab", "mr", "checkout", `${prNumber}`, "--branch", localBranchName], { nothrow: true }),
      )
      if (checkout.code !== 0) {
        return yield* fail(`Failed to checkout MR !${prNumber}. Make sure you are authenticated with glab ('glab auth login').`)
      }
    } else {
      return yield* fail(
        `Automatic checkout is not supported for remote host '${remote?.host || "unknown"}'.\n` +
          `Please check out the branch manually using git, and link it with:\n` +
          `  fox pr link <pull-or-merge-request-url>`,
      )
    }

    UI.println(`Successfully checked out #${prNumber} as branch '${localBranchName}'`)
    UI.println()
    UI.println("Starting fox...")
    UI.println()

    const code = yield* Effect.promise(
      () =>
        Process.spawn(cli, {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
          cwd: process.cwd(),
        }).exited,
    )
    if (code !== 0) return yield* Effect.die(new Error(`fox exited with code ${code}`))
  }),
})
export const PrLinkCommand = effectCmd({
  command: "link <url>",
  describe: "link the current worktree to a pull request",
  builder: (yargs) =>
    yargs.positional("url", {
      type: "string",
      describe: "PR URL to link",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.pr.link")(function* (args) {
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")

    const link = parsePrUrl(args.url)
    if (!link) return yield* fail(`Invalid PR URL: ${args.url}`)

    yield* Effect.promise(() => writePrLinkOverride(ctx.worktree, link))
    UI.println(`Linked PR #${link.prNumber} (${link.platform})`)
    UI.println(link.prUrl)
  }),
})

export const PrUnlinkCommand = effectCmd({
  command: "unlink",
  describe: "clear the linked pull request",
  handler: Effect.fn("Cli.pr.unlink")(function* () {
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")

    yield* Effect.promise(() => writePrLinkOverride(ctx.worktree, { cleared: true }))
    UI.println("PR link cleared")
  }),
})

export const prStatusHandler = Effect.fn("Cli.pr.status")(function* () {
  const ctx = yield* InstanceRef
  if (!ctx) return yield* fail("Could not load instance context")

  const override = yield* Effect.promise(() => readPrLinkOverride(ctx.worktree))
  if (override && "cleared" in override) {
    UI.println("PR link cleared")
    return
  }
  if (override) {
    UI.println(`Linked PR #${override.prNumber} (${override.platform})`)
    UI.println(override.prUrl)
    return
  }

  const detected = yield* Effect.promise(() => detectPrLink())
  if (detected) {
    UI.println(`Detected PR #${detected.prNumber} (${detected.platform})`)
    UI.println(detected.prUrl)
    return
  }
  UI.println("no PR linked")
})

export const PrStatusCommand = effectCmd({
  command: "status",
  describe: "show the linked pull request",
  handler: prStatusHandler,
})