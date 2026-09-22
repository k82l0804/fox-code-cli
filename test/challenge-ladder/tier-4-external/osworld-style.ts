/**
 * Tier 4 — OSWorld-style (20 fixtures)
 *
 * Simulated desktop state: file trees, process lists, window titles,
 * clipboard content, system info.
 */
import type { ChallengeFixture } from "../types"

function makeOSWorld(idx: number): { content: string; must: string[]; desc: string } {
  const templates = [
    (i: number) => ({
      content: `$ tree -L 2 ~/projects/webapp
/home/dev/projects/webapp
├── src
│   ├── components
│   ├── hooks
│   ├── pages
│   ├── services
│   ├── utils
│   └── index.tsx
├── test
│   ├── __fixtures__
│   ├── integration
│   └── unit
├── public
│   ├── favicon.ico
│   └── index.html
├── package.json
├── tsconfig.json
├── .env.local
└── README.md

${8 + i} directories, ${12 + i} files

$ cat package.json | jq '.dependencies | keys | length'
${18 + i}

$ du -sh node_modules/
${234 + i * 12}M\tnode_modules/

$ wc -l src/**/*.tsx src/**/*.ts 2>/dev/null | tail -1
  ${3456 + i * 100} total`,
      must: ["tree", "components", "package.json", "node_modules"],
      desc: "File tree exploration with disk usage",
    }),
    (i: number) => ({
      content: `$ ps aux --sort=-%mem | head -15
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
dev      ${1000 + i}  ${12 + i}.3  ${8 + i}.1 ${1200000 + i * 10000}  ${800000 + i * 5000} ?   Sl   09:00   ${i + 1}:23 /usr/bin/code --type=extensionHost
dev      ${2000 + i}   ${5 + i}.7  ${6 + i}.2 ${900000 + i * 8000}  ${600000 + i * 4000} ?   Sl   09:00   0:45 node /usr/share/code/out/bootstrap-node.js
dev      ${3000 + i}   ${3 + i}.1  ${4 + i}.5 ${500000 + i * 5000}  ${400000 + i * 3000} ?   Sl   09:05   0:12 /usr/bin/chrome --type=renderer
dev      ${4000 + i}   ${2 + i}.8  ${3 + i}.0 ${300000 + i * 3000}  ${250000 + i * 2000} ?   Sl   09:10   0:08 node dist/server.js
root         1   0.0  0.1  ${170000 + i * 100}  ${13000 + i * 50} ?   Ss   08:55   0:02 /sbin/init
dev      ${5000 + i}   ${1 + i}.5  ${2 + i}.8 ${400000 + i * 4000}  ${350000 + i * 2500} ?   Sl   09:00   0:34 /usr/bin/slack --type=renderer

$ free -h
              total        used        free      shared  buff/cache   available
Mem:           ${31 + i}Gi       ${18 + i}Gi       ${4 + i}Gi       ${1 + i % 3}Gi       ${8 + i}Gi       ${11 + i}Gi
Swap:         ${8 + i}Gi       ${1 + i % 4}Gi       ${7 + i % 5}Gi`,
      must: ["extensionHost", "chrome", "free -h", "Swap"],
      desc: "Process list and memory usage",
    }),
    (i: number) => ({
      content: `$ wmctrl -l
0x01c00003 -1 speedy Desktop
0x04000007  0 speedy Visual Studio Code - webapp
0x04200003  0 speedy Google Chrome - localhost:3000
0x05000003  0 speedy Terminal — bash
0x05400003  0 speedy Slack - #engineering
0x06000003  0 speedy Files — ~/projects/webapp

$ xdotool getactivewindow getwindowname
Visual Studio Code - webapp

$ xclip -o -selection clipboard
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const login = async (credentials: LoginCredentials) => {
    const response = await api.post('/auth/login', credentials);
    setUser(response.data.user);
  };
  return { user, login };
}

$ xdg-mime query default text/typescript
code.desktop`,
      must: ["Visual Studio Code", "Google Chrome", "useAuth", "xclip", "code.desktop"],
      desc: "Window list, clipboard, and file associations",
    }),
    (i: number) => ({
      content: `$ cat /etc/os-release
NAME="Ubuntu"
VERSION="${22 + i % 3}.04"
ID=ubuntu
PRETTY_NAME="Ubuntu ${22 + i % 3}.04 LTS"

$ uname -a
Linux speedy ${5 + i % 3}.15.0-${91 + i}-generic #${101 + i}-Ubuntu SMP x86_64 GNU/Linux

$ node --version
v${20 + i % 3}.${i % 10}.0

$ bun --version
1.${4 + i % 3}.${i % 10}

$ git --version
git version 2.${43 + i % 5}.${i % 3}

$ docker --version
Docker version ${24 + i % 3}.0.${i % 8}, build ${`abc${i}def`}

$ df -h /
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1       ${450 + i * 5}G   ${200 + i * 10}G   ${230 + i * 5}G  ${46 + i}% /`,
      must: ["Ubuntu", "node --version", "bun --version", "Docker version"],
      desc: "System information and tool versions",
    }),
  ]
  return templates[idx % templates.length]!(idx)
}

export const TIER4_OSWORLD_FIXTURES: readonly ChallengeFixture[] = Array.from(
  { length: 20 },
  (_, idx) => {
    const { content, must, desc } = makeOSWorld(idx)
    return {
      id: `osworld-t4-${String(idx + 1).padStart(2, "0")}`,
      tier: 4 as const,
      category: "osworld-style" as const,
      description: `OSWorld-style: ${desc} (variant ${Math.floor(idx / 4) + 1})`,
      seed: 32000 + idx,
      input: { content, tool: "bash" as const, command: "bash system-check.sh" },
      expected: {
        type: "objective" as const,
        mustContain: must,
        workflow: "shell" as const,
      },
    }
  },
)
