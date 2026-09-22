/**
 * Tier 2 — GitOps Workflow Expansion (10 new fixtures)
 *
 * Advanced real-world git workflows that stress compressors:
 *   - Merge conflicts, rebases, cherry-picks, reflog, submodules
 *   - Multi-remote, detached HEAD, rename chains
 */
import type { ChallengeFixture, WorkflowStep } from "../types"

function ts(offset: number): string {
  return new Date(1727100000000 + offset * 1000).toISOString()
}

export const TIER2_GITOPS_EXPANSION_FIXTURES: readonly ChallengeFixture[] = [
  // 1. Multi-branch merge conflict chain
  {
    id: "gitops-wf-t2-21",
    tier: 2,
    category: "gitops-workflows",
    description: "Multi-branch merge conflict resolution",
    seed: 12001,
    input: {
      content: [
        `[Step 1/6] [${ts(0)}] tool=bash cmd="git checkout feature/login"\nSwitched to branch 'feature/login'\nYour branch is up to date with 'origin/feature/login'.`,
        `[Step 2/6] [${ts(5)}] tool=bash cmd="git merge feature/session"\nAuto-merging src/auth.ts\nCONFLICT (content): Merge conflict in src/auth.ts\nAutomatic merge failed; fix conflicts and then commit the result.`,
        `[Step 3/6] [${ts(15)}] tool=read\n// File: src/auth.ts\n<<<<<<< HEAD\nimport { Session } from './session';\nconst auth = new AuthHandler(session);\n=======\nimport { TokenSession } from './token-session';\nconst auth = new AuthHandler(tokenSession);\n>>>>>>> feature/session\nexport default auth;`,
        `[Step 4/6] [${ts(30)}] tool=edit\nFile updated: src/auth.ts\n  Resolved merge conflict: kept feature/session imports with feature/login handler`,
        `[Step 5/6] [${ts(35)}] tool=bash cmd="git commit -am 'Resolve merge conflict in auth.ts'"\n[feature/login c3d4e5f] Resolve merge conflict in auth.ts`,
        `[Step 6/6] [${ts(40)}] tool=bash cmd="git push origin feature/login"\nTo github.com:org/repo.git\n   a1b2c3d..c3d4e5f  feature/login -> feature/login`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git status",
      steps: [
        { tool: "bash", command: "git checkout feature/login", content: "Switched to branch 'feature/login'", timestamp: ts(0) },
        { tool: "bash", command: "git merge feature/session", content: "CONFLICT (content): Merge conflict in src/auth.ts", timestamp: ts(5) },
        { tool: "read", content: "<<<<<<< HEAD\nimport { Session }", timestamp: ts(15) },
        { tool: "edit", content: "File updated: src/auth.ts", timestamp: ts(30) },
        { tool: "bash", command: "git commit", content: "[feature/login c3d4e5f] Resolve merge conflict", timestamp: ts(35) },
        { tool: "bash", command: "git push", content: "feature/login -> feature/login", timestamp: ts(40) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["feature/login", "feature/session", "CONFLICT", "src/auth.ts"],
      workflow: "swe",
    },
  },

  // 2. Interactive rebase
  {
    id: "gitops-wf-t2-22",
    tier: 2,
    category: "gitops-workflows",
    description: "Interactive rebase with pick/reword/edit",
    seed: 12002,
    input: {
      content: [
        `[Step 1/5] [${ts(100)}] tool=bash cmd="git log --oneline -5"\na1b2c3d Fix typo in README\nd4e5f6g Improve error message for auth failures\n1122334 Add missing null check in user service\n5566778 Refactor database connection pool\n99aabbc Update CI configuration`,
        `[Step 2/5] [${ts(105)}] tool=bash cmd="git rebase -i HEAD~5"\npick a1b2c3d Fix typo in README\nreword d4e5f6g Improve error message for auth failures\nedit 1122334 Add missing null check in user service\npick 5566778 Refactor database connection pool\ndrop 99aabbc Update CI configuration\n\nSuccessfully started rebase`,
        `[Step 3/5] [${ts(120)}] tool=bash cmd="git rebase --continue"\nStopped at 1122334... Add missing null check in user service\nYou can amend the commit now, with\n  git commit --amend\nOnce you are satisfied, run\n  git rebase --continue`,
        `[Step 4/5] [${ts(140)}] tool=edit\nFile updated: src/services/user.ts\n  Added null check for user.profile before accessing fields`,
        `[Step 5/5] [${ts(145)}] tool=bash cmd="git rebase --continue"\nSuccessfully rebased and updated refs/heads/main.`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git rebase -i HEAD~5",
      steps: [
        { tool: "bash", command: "git log --oneline -5", content: "a1b2c3d Fix typo in README", timestamp: ts(100) },
        { tool: "bash", command: "git rebase -i HEAD~5", content: "pick a1b2c3d\nreword d4e5f6g\nedit 1122334", timestamp: ts(105) },
        { tool: "bash", command: "git rebase --continue", content: "Stopped at 1122334", timestamp: ts(120) },
        { tool: "edit", content: "File updated: src/services/user.ts", timestamp: ts(140) },
        { tool: "bash", command: "git rebase --continue", content: "Successfully rebased", timestamp: ts(145) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["reword", "edit 1122334", "rebase --continue", "Successfully rebased"],
      workflow: "swe",
    },
  },

  // 3. Detached HEAD recovery
  {
    id: "gitops-wf-t2-23",
    tier: 2,
    category: "gitops-workflows",
    description: "Detached HEAD checkout and recovery",
    seed: 12003,
    input: {
      content: [
        `[Step 1/4] [${ts(200)}] tool=bash cmd="git checkout a1b2c3d"\nNote: switching to 'a1b2c3d'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nHEAD is now at a1b2c3d Fix login redirect`,
        `[Step 2/4] [${ts(210)}] tool=bash cmd="git log --oneline -3"\na1b2c3d (HEAD) Fix login redirect\n9f8e7d6 Add session timeout\n5a4b3c2 Initial auth module`,
        `[Step 3/4] [${ts(215)}] tool=bash cmd="git checkout -b recovery/fix-redirect"\nSwitched to a new branch 'recovery/fix-redirect'`,
        `[Step 4/4] [${ts(220)}] tool=bash cmd="git checkout main"\nSwitched to branch 'main'\nYour branch is up to date with 'origin/main'.`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git checkout a1b2c3d",
      steps: [
        { tool: "bash", command: "git checkout a1b2c3d", content: "detached HEAD\nHEAD is now at a1b2c3d", timestamp: ts(200) },
        { tool: "bash", command: "git log --oneline -3", content: "a1b2c3d (HEAD) Fix login redirect", timestamp: ts(210) },
        { tool: "bash", command: "git checkout -b recovery/fix-redirect", content: "Switched to a new branch", timestamp: ts(215) },
        { tool: "bash", command: "git checkout main", content: "Switched to branch 'main'", timestamp: ts(220) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["detached HEAD", "a1b2c3d", "recovery/fix-redirect", "main"],
      workflow: "swe",
    },
  },

  // 4. Cherry-pick conflict
  {
    id: "gitops-wf-t2-24",
    tier: 2,
    category: "gitops-workflows",
    description: "Cherry-pick with modify/delete conflict",
    seed: 12004,
    input: {
      content: [
        `[Step 1/5] [${ts(300)}] tool=bash cmd="git cherry-pick 9f8e7d6"\nerror: could not apply 9f8e7d6... Fix API validation\nCONFLICT (modify/delete): src/api/validate.ts deleted in HEAD and modified in 9f8e7d6.\nhint: Use 'git add' or 'git rm' to resolve the conflict.`,
        `[Step 2/5] [${ts(310)}] tool=bash cmd="git status"\nOn branch main\nYou are currently cherry-picking commit 9f8e7d6.\n  (fix conflicts and run \"git cherry-pick --continue\")\n\nUnmerged paths:\n  (use \"git add/rm <file>...\" as appropriate to mark resolution)\n        deleted by us:   src/api/validate.ts`,
        `[Step 3/5] [${ts(320)}] tool=bash cmd="git checkout --theirs src/api/validate.ts"\nUpdated 1 path from the index`,
        `[Step 4/5] [${ts(325)}] tool=bash cmd="git add src/api/validate.ts"`,
        `[Step 5/5] [${ts(330)}] tool=bash cmd="git cherry-pick --continue"\n[main f1e2d3c] Fix API validation`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git cherry-pick",
      steps: [
        { tool: "bash", command: "git cherry-pick 9f8e7d6", content: "CONFLICT (modify/delete): src/api/validate.ts", timestamp: ts(300) },
        { tool: "bash", command: "git status", content: "cherry-picking commit 9f8e7d6", timestamp: ts(310) },
        { tool: "bash", command: "git checkout --theirs", content: "Updated 1 path", timestamp: ts(320) },
        { tool: "bash", command: "git add", content: "staged: src/api/validate.ts", timestamp: ts(325) },
        { tool: "bash", command: "git cherry-pick --continue", content: "[main f1e2d3c] Fix API validation", timestamp: ts(330) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["cherry-pick", "9f8e7d6", "CONFLICT", "validate.ts"],
      workflow: "swe",
    },
  },

  // 5. Reflog-based recovery
  {
    id: "gitops-wf-t2-25",
    tier: 2,
    category: "gitops-workflows",
    description: "Reflog inspection and recovery to prior state",
    seed: 12005,
    input: {
      content: [
        `[Step 1/4] [${ts(400)}] tool=bash cmd="git reflog"\na1b2c3d (HEAD -> main) HEAD@{0}: commit: Break everything\n9f8e7d6 HEAD@{1}: commit: Add feature flag\n5a4b3c2 HEAD@{2}: pull: Fast-forward\n1122334 HEAD@{3}: commit: Working state before refactor\n5566778 HEAD@{4}: commit (amend): Fix connection pool\n99aabbc HEAD@{5}: rebase (finish): returning to refs/heads/main`,
        `[Step 2/4] [${ts(405)}] tool=bash cmd="git diff HEAD@{3}..HEAD --stat"\n src/index.ts  | 45 ++++++++++++++++++++++-----------\n src/config.ts | 12 ++++------\n src/db.ts     | 28 --------------------\n 3 files changed, 32 insertions(+), 53 deletions(-)`,
        `[Step 3/4] [${ts(410)}] tool=bash cmd="git reset --hard HEAD@{3}"\nHEAD is now at 1122334 Working state before refactor`,
        `[Step 4/4] [${ts(415)}] tool=bash cmd="git log --oneline -3"\n1122334 (HEAD -> main) Working state before refactor\n5566778 Fix connection pool\n99aabbc Initial setup`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git reflog",
      steps: [
        { tool: "bash", command: "git reflog", content: "HEAD@{0}: commit: Break everything\nHEAD@{3}: commit: Working state", timestamp: ts(400) },
        { tool: "bash", command: "git diff HEAD@{3}..HEAD --stat", content: "3 files changed", timestamp: ts(405) },
        { tool: "bash", command: "git reset --hard HEAD@{3}", content: "HEAD is now at 1122334", timestamp: ts(410) },
        { tool: "bash", command: "git log --oneline -3", content: "1122334 Working state before refactor", timestamp: ts(415) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["HEAD@{3}", "reflog", "Working state before refactor", "1122334"],
      workflow: "swe",
    },
  },

  // 6. Multi-remote workflow
  {
    id: "gitops-wf-t2-26",
    tier: 2,
    category: "gitops-workflows",
    description: "Multi-remote fetch and merge from upstream",
    seed: 12006,
    input: {
      content: [
        `[Step 1/5] [${ts(500)}] tool=bash cmd="git remote -v"\norigin    git@github.com:myorg/repo.git (fetch)\norigin    git@github.com:myorg/repo.git (push)\nupstream  https://github.com/upstream-org/repo.git (fetch)\nupstream  https://github.com/upstream-org/repo.git (push)`,
        `[Step 2/5] [${ts(505)}] tool=bash cmd="git fetch upstream"\nremote: Enumerating objects: 42, done.\nremote: Counting objects: 100% (42/42), done.\nremote: Compressing objects: 100% (15/15), done.\nFrom https://github.com/upstream-org/repo\n   a1b2c3d..d4e5f6g  main     -> upstream/main\n * [new branch]      release/v3 -> upstream/release/v3`,
        `[Step 3/5] [${ts(510)}] tool=bash cmd="git merge upstream/main"\nUpdating a1b2c3d..d4e5f6g\nFast-forward\n src/core.ts  | 12 ++++++------\n src/utils.ts |  8 ++++----\n 2 files changed, 10 insertions(+), 10 deletions(-)`,
        `[Step 4/5] [${ts(515)}] tool=bash cmd="git log --oneline -5"\nd4e5f6g (HEAD -> main, upstream/main) Upstream: fix core module\nc3b2a1f Upstream: update utils\na1b2c3d (origin/main) Local: last synced commit\n9f8e7d6 Local: add feature\n5a4b3c2 Local: initial setup`,
        `[Step 5/5] [${ts(520)}] tool=bash cmd="git push origin main"\nTo github.com:myorg/repo.git\n   a1b2c3d..d4e5f6g  main -> main`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git remote -v",
      steps: [
        { tool: "bash", command: "git remote -v", content: "origin\nupstream", timestamp: ts(500) },
        { tool: "bash", command: "git fetch upstream", content: "upstream/main\nupstream/release/v3", timestamp: ts(505) },
        { tool: "bash", command: "git merge upstream/main", content: "Fast-forward\n2 files changed", timestamp: ts(510) },
        { tool: "bash", command: "git log --oneline -5", content: "upstream/main\norigin/main", timestamp: ts(515) },
        { tool: "bash", command: "git push origin main", content: "main -> main", timestamp: ts(520) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["upstream", "origin", "upstream/main", "Fast-forward"],
      workflow: "swe",
    },
  },

  // 7. Large multi-paragraph commit message
  {
    id: "gitops-wf-t2-27",
    tier: 2,
    category: "gitops-workflows",
    description: "Large commit message with body, bullet points, and metadata",
    seed: 12007,
    input: {
      content: [
        `[Step 1/3] [${ts(600)}] tool=bash cmd="git log -1 --format=full"\ncommit a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9\nAuthor: Jane Developer <jane@example.com>\nDate:   Mon Sep 22 10:30:00 2026 -0400\n\n    feat(auth): implement OAuth2 PKCE flow with token rotation\n\n    This commit implements the full OAuth2 Authorization Code flow with\n    Proof Key for Code Exchange (PKCE) as described in RFC 7636.\n\n    Changes:\n    - Added PKCE challenge generation (S256 method)\n    - Implemented authorization code exchange endpoint\n    - Added refresh token rotation with family tracking\n    - Token revocation cascade on reuse detection\n\n    Breaking changes:\n    - Removed legacy implicit grant flow\n    - Session cookie format changed (requires re-login)\n\n    Refs: AUTH-1234, SEC-567\n    Reviewed-by: Bob Smith <bob@example.com>\n    Co-authored-by: Alice Johnson <alice@example.com>`,
        `[Step 2/3] [${ts(610)}] tool=bash cmd="git diff HEAD~1 --stat"\n src/auth/oauth2.ts     | 142 +++++++++++++++++++++++++++++++++++++++++++\n src/auth/pkce.ts       |  68 +++++++++++++++++++++\n src/auth/token.ts      |  95 +++++++++++++++++++++++++++++\n test/auth/oauth2.test.ts| 112 ++++++++++++++++++++++++++++++++++\n 4 files changed, 417 insertions(+)`,
        `[Step 3/3] [${ts(615)}] tool=bash cmd="git push origin main"\nTo github.com:org/repo.git\n   9f8e7d6..a1b2c3d  main -> main`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git log -1",
      steps: [
        { tool: "bash", command: "git log -1", content: "feat(auth): implement OAuth2 PKCE flow\nAuthor: Jane Developer", timestamp: ts(600) },
        { tool: "bash", command: "git diff HEAD~1 --stat", content: "4 files changed, 417 insertions", timestamp: ts(610) },
        { tool: "bash", command: "git push origin main", content: "main -> main", timestamp: ts(615) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["OAuth2 PKCE", "Reviewed-by:", "Co-authored-by:", "AUTH-1234"],
      workflow: "swe",
    },
  },

  // 8. Staged vs unstaged mix
  {
    id: "gitops-wf-t2-28",
    tier: 2,
    category: "gitops-workflows",
    description: "Complex staged/unstaged/untracked mix with partial add",
    seed: 12008,
    input: {
      content: [
        `[Step 1/5] [${ts(700)}] tool=bash cmd="git add src/components/Button.tsx"\n`,
        `[Step 2/5] [${ts(702)}] tool=bash cmd="git status"\nOn branch feature/ui-refresh\nYour branch is ahead of 'origin/feature/ui-refresh' by 2 commits.\n  (use "git push" to publish your local commits)\n\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n        modified:   src/components/Button.tsx\n        new file:   src/components/Modal.tsx\n\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)\n        modified:   src/styles/theme.css\n        deleted:    src/legacy/oldButton.tsx\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n        src/components/Dropdown.tsx\n        src/utils/animations.ts`,
        `[Step 3/5] [${ts(710)}] tool=bash cmd="git diff --cached --stat"\n src/components/Button.tsx | 25 ++++++++++++++-----------\n src/components/Modal.tsx  | 48 ++++++++++++++++++++++++++++++++++++++++++\n 2 files changed, 62 insertions(+), 11 deletions(-)`,
        `[Step 4/5] [${ts(715)}] tool=bash cmd="git commit -m 'feat: redesign Button and add Modal component'"\n[feature/ui-refresh e5f6g7h] feat: redesign Button and add Modal component\n 2 files changed, 62 insertions(+), 11 deletions(-)`,
        `[Step 5/5] [${ts(720)}] tool=bash cmd="git stash push -m 'WIP: theme and animations'"\nSaved working directory and index state On feature/ui-refresh: WIP: theme and animations`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git status",
      steps: [
        { tool: "bash", command: "git add", content: "staged: src/components/Button.tsx", timestamp: ts(700) },
        { tool: "bash", command: "git status", content: "Changes to be committed:\n  modified: Button.tsx\nChanges not staged:\n  modified: theme.css", timestamp: ts(702) },
        { tool: "bash", command: "git diff --cached --stat", content: "2 files changed", timestamp: ts(710) },
        { tool: "bash", command: "git commit", content: "[feature/ui-refresh e5f6g7h]", timestamp: ts(715) },
        { tool: "bash", command: "git stash push", content: "WIP: theme and animations", timestamp: ts(720) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["feature/ui-refresh", "Button.tsx", "Modal.tsx", "theme.css"],
      workflow: "swe",
    },
  },

  // 9. Submodule update chain
  {
    id: "gitops-wf-t2-29",
    tier: 2,
    category: "gitops-workflows",
    description: "Recursive submodule init, update, and status",
    seed: 12009,
    input: {
      content: [
        `[Step 1/4] [${ts(800)}] tool=bash cmd="git submodule update --init --recursive"\nSubmodule 'vendor/crypto-lib' (https://github.com/crypto-org/crypto-lib.git) registered for path 'vendor/crypto-lib'\nSubmodule 'vendor/crypto-lib/deps/base64' (https://github.com/base64-org/base64.git) registered for path 'vendor/crypto-lib/deps/base64'\nCloning into '/project/vendor/crypto-lib'...\nCloning into '/project/vendor/crypto-lib/deps/base64'...\nSubmodule path 'vendor/crypto-lib': checked out 'a1b2c3d4e5f6'\nSubmodule path 'vendor/crypto-lib/deps/base64': checked out '9f8e7d6c5b4a'`,
        `[Step 2/4] [${ts(815)}] tool=bash cmd="git submodule status"\n a1b2c3d4e5f6 vendor/crypto-lib (v2.3.1)\n 9f8e7d6c5b4a vendor/crypto-lib/deps/base64 (v1.0.0)`,
        `[Step 3/4] [${ts(820)}] tool=bash cmd="cd vendor/crypto-lib && git pull origin main"\nFrom https://github.com/crypto-org/crypto-lib\n   a1b2c3d..f1e2d3c  main       -> origin/main\nUpdating a1b2c3d..f1e2d3c\nFast-forward\n src/aes.ts | 15 ++++++++++-----\n 1 file changed, 10 insertions(+), 5 deletions(-)`,
        `[Step 4/4] [${ts(830)}] tool=bash cmd="git add vendor/crypto-lib && git commit -m 'chore: update crypto-lib submodule'"\n[main g7h8i9j] chore: update crypto-lib submodule\n 1 file changed, 1 insertion(+), 1 deletion(-)`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git submodule update",
      steps: [
        { tool: "bash", command: "git submodule update --init --recursive", content: "Submodule path 'vendor/crypto-lib': checked out", timestamp: ts(800) },
        { tool: "bash", command: "git submodule status", content: "vendor/crypto-lib (v2.3.1)", timestamp: ts(815) },
        { tool: "bash", command: "git pull origin main", content: "Fast-forward", timestamp: ts(820) },
        { tool: "bash", command: "git commit", content: "chore: update crypto-lib submodule", timestamp: ts(830) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["submodule", "vendor/crypto-lib", "checked out", "v2.3.1"],
      workflow: "swe",
    },
  },

  // 10. Multi-file rename + modify
  {
    id: "gitops-wf-t2-30",
    tier: 2,
    category: "gitops-workflows",
    description: "Multi-file rename chain with modifications",
    seed: 12010,
    input: {
      content: [
        `[Step 1/5] [${ts(900)}] tool=bash cmd="git mv src/utils/helpers.ts src/utils/string-helpers.ts"`,
        `[Step 2/5] [${ts(902)}] tool=bash cmd="git mv src/utils/format.ts src/utils/number-format.ts"`,
        `[Step 3/5] [${ts(905)}] tool=bash cmd="git diff --cached --stat"\n src/utils/{helpers.ts => string-helpers.ts}  | 0\n src/utils/{format.ts => number-format.ts}    | 0\n 2 files changed, 0 insertions(+), 0 deletions(-)\n rename src/utils/{helpers.ts => string-helpers.ts} (100%)\n rename src/utils/{format.ts => number-format.ts} (100%)`,
        `[Step 4/5] [${ts(910)}] tool=edit\nFile updated: src/utils/string-helpers.ts\n  Renamed exports: formatName -> formatUserName, trimSpaces -> normalizeWhitespace\nFile updated: src/index.ts\n  Updated imports: helpers -> string-helpers, format -> number-format`,
        `[Step 5/5] [${ts(920)}] tool=bash cmd="git commit -am 'refactor: rename utility modules for clarity'"\n[main k1l2m3n] refactor: rename utility modules for clarity\n 4 files changed, 8 insertions(+), 8 deletions(-)`,
      ].join("\n\n---\n\n"),
      tool: "bash",
      command: "git mv",
      steps: [
        { tool: "bash", command: "git mv helpers.ts string-helpers.ts", content: "renamed: helpers.ts -> string-helpers.ts", timestamp: ts(900) },
        { tool: "bash", command: "git mv format.ts number-format.ts", content: "renamed: format.ts -> number-format.ts", timestamp: ts(902) },
        { tool: "bash", command: "git diff --cached --stat", content: "rename src/utils/{helpers.ts => string-helpers.ts}", timestamp: ts(905) },
        { tool: "edit", content: "File updated: src/utils/string-helpers.ts", timestamp: ts(910) },
        { tool: "bash", command: "git commit", content: "refactor: rename utility modules", timestamp: ts(920) },
      ],
    },
    expected: {
      type: "completion",
      mustContain: ["string-helpers.ts", "number-format.ts", "rename", "helpers.ts"],
      workflow: "swe",
    },
  },
]
