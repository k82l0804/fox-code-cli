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
