# Fox CLI Tools

## logo_gen.py — Logo Generator

Generates the `Foxy CLI` pixel-art logo used in the TUI splash screen.
Output is TypeScript-ready strings for `src/kilocode/cli/logo.ts`.

### How it works

1. [pyfiglet](https://github.com/pwaller/pyfiglet) renders text as a bitmap using a monospace font
2. The bitmap is processed in **2×3 pixel blocks** per terminal cell
3. Each block maps to a Unicode sextant character (`U+1FB00–U+1FB3B`) or half-block (`▀▄█`)
4. Two variants are produced:
   - **modern** — sextant glyphs, requires Unicode 13 font support (e.g. Nerd Fonts). Opt in with `FOX_UNICODE_LOGO=true`
   - **fallback** — half-block glyphs (`▀▄█`), universally supported. This is the default.

### Setup

```bash
python3 tools/logo_gen.py --install   # installs pyfiglet via pip
```

### Regenerate the logo

```bash
python3 tools/logo_gen.py "Foxy CLI" --font banner --rows 4
```

Paste the output into `src/kilocode/cli/logo.ts` replacing the `modern` and `fallback` blocks.

### Try different fonts

```bash
# List all available fonts
python3 tools/logo_gen.py --list-fonts

# Try a few good ones
python3 tools/logo_gen.py "Foxy CLI" --font doom --rows 4
python3 tools/logo_gen.py "Foxy CLI" --font epic --rows 4
python3 tools/logo_gen.py "Foxy CLI" --font banner3-D --rows 6
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--font` / `-f` | `banner` | pyfiglet font name |
| `--rows` / `-r` | `4` | Target sextant terminal rows |
| `--scale-x` | `1` | Horizontal pixel scale multiplier |
| `--scale-y` | `1` | Vertical pixel scale (auto-computed from `--rows` if 1) |
| `--raw` | — | Print raw `repr()` of rows instead of TypeScript |
| `--list-fonts` | — | List all available pyfiglet fonts |
| `--install` | — | `pip install pyfiglet` and exit |

### Logo rendering in the TUI

The active logo variant is controlled by `FOX_UNICODE_LOGO` in `bin/fox`:

| Value | Result |
|-------|--------|
| unset / `false` | Half-block fallback (default, universal) |
| `true` | Sextant modern art (requires Unicode 13 font) |

The glyph data lives in [`src/kilocode/cli/logo.ts`](../src/kilocode/cli/logo.ts).

---

## fox-bench.sh — Agentic Loop Benchmark

Runs a set of standard prompts through the Fox server and measures token usage, latency, cache hit rates, and cost per step.

### Usage

```bash
# Start Fox server first
bun run ./src/index.ts serve &

# Run full benchmark (4 prompts)
bash tools/fox-bench.sh

# Run a single prompt
bash tools/fox-bench.sh --prompt "What files are in the current directory?"

# View results from last run
bash tools/fox-bench.sh --report
```

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `FOX_SERVER` | `http://localhost:4096` | Fox server URL |
| `FOX_DIR` | `cwd` | Project directory |
| `FOX_SERVER_PASSWORD` | — | Auth password (optional) |

### Output

Results are saved to `/tmp/fox-bench/results.jsonl` (one JSON object per prompt).

---

## fox-quality-check.sh — Response Quality Comparison

Captures actual model responses from Kilo mode (no compression) and Fox mode (with compression), then compares them side-by-side for correctness.

### Usage

```bash
# Step 1: Capture baseline (no compression)
bun run ./src/index.ts serve &
bash tools/fox-quality-check.sh --capture kilo
kill %1; sleep 2

# Step 2: Capture compressed
FOX_EXPERIMENTAL_COMPRESS=true bun run ./src/index.ts serve &
bash tools/fox-quality-check.sh --capture fox
kill %1

# Step 3: Compare
bash tools/fox-quality-check.sh --compare
```

### What it checks

- **Factual correctness**: Does the response contain expected substrings?
- **Non-empty responses**: Did the model actually answer?
- **Token comparison**: Total input tokens for Kilo vs Fox
- **Side-by-side snippets**: First 100 chars of each response

### Adding prompts

Edit the `PROMPTS` and `EXPECTED` arrays in the script to add new quality checks.

---

## fox-vs-kilo-showdown.ts — Deterministic Compression Benchmark

Byte-level comparison of compression transforms on simulated tool outputs. **Fully deterministic** — no server or LLM required.

### Usage

```bash
bun run tools/fox-vs-kilo-showdown.ts
```

### What it measures

- **Schema minification**: Raw vs minified tool schema bytes
- **Per-fixture compression**: 8 realistic tool output fixtures
- **Combined session estimate**: Projected savings over a 10-turn session

### Fixtures

| Fixture | Simulates |
|---------|-----------|
| grep: find effect imports | 80 grep results with long workspace paths |
| grep: find TODO comments | 30 grep results |
| read: package.json | Single JSON object (non-compressible) |
| bash: ls -la | File listing (non-compressible) |
| bash: test output | 50 repetitive test lines |
| read: JSON API response | Array of 30 objects (tabular compression) |
| bash: build log | 25 repeated warnings (log dedup) |
| grep: deep path results | 40 results with deeply nested paths |

