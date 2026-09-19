#!/usr/bin/env python3
"""
Fox CLI Logo Generator
Converts text to Unicode sextant block character art for logo.ts.

How it works:
  - pyfiglet renders text as an ASCII pixel grid (each char is '#' or ' ')
  - The grid is optionally scaled (each pixel becomes scale×scale pixels)
  - The scaled grid is processed in 2x3 blocks (2 cols, 3 rows per terminal cell)
  - Each block's 6 pixels map to a bitmask -> Unicode sextant char (U+1FB00-U+1FB3B)
  - Full blocks and spaces are used for the 63 and 0 cases

Sextant bit layout per 2x3 cell:
  [tl tr]   bits: tl=0, tr=1
  [ml mr]         ml=2, mr=3
  [bl br]         bl=4, br=5

  bitmask 0    -> ' '  (space)
  bitmask 1-62 -> chr(0x1FB00 + bitmask - 1)
  bitmask 63   -> 'U+2588'  (FULL BLOCK)

Usage:
  python logo_gen.py "Fox  CLI"
  python logo_gen.py "Fox  CLI" --font block --scale-y 2 --rows 4
  python logo_gen.py --list-fonts
  python logo_gen.py --install
"""

import sys
import argparse


# ---------------------------------------------------------------------------
# Sextant rendering
# ---------------------------------------------------------------------------

def to_grid(art_text):
    """Parse pyfiglet output into a 2D boolean pixel grid."""
    lines = art_text.split("\n")
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        return []
    width = max(len(l) for l in lines)
    return [[c != " " for c in l.ljust(width)] for l in lines]


def scale_grid(grid, sx, sy):
    """Scale a pixel grid by sx horizontally and sy vertically."""
    result = []
    for row in grid:
        scaled_row = []
        for pixel in row:
            scaled_row.extend([pixel] * sx)
        for _ in range(sy):
            result.append(scaled_row[:])
    return result


def pad_grid(grid):
    """Pad to multiples of 3 rows and 2 cols."""
    if not grid:
        return grid
    cols = len(grid[0])
    if cols % 2:
        grid = [row + [False] for row in grid]
        cols += 1
    while len(grid) % 3:
        grid.append([False] * cols)
    return grid


def grid_to_sextant(grid):
    """Convert a pixel grid to sextant Unicode rows (4 terminal rows = 12 pixel rows)."""
    grid = pad_grid([row[:] for row in grid])
    rows, cols = len(grid), len(grid[0])
    result = []
    for br in range(rows // 3):
        line = ""
        for bc in range(cols // 2):
            r, c = br * 3, bc * 2
            tl = grid[r  ][c  ]; tr = grid[r  ][c+1]
            ml = grid[r+1][c  ]; mr = grid[r+1][c+1]
            bl = grid[r+2][c  ]; brt = grid[r+2][c+1]
            mask = (tl) | (tr << 1) | (ml << 2) | (mr << 3) | (bl << 4) | (brt << 5)
            if mask == 0:
                line += " "
            elif mask == 63:
                line += "\u2588"  # FULL BLOCK
            else:
                line += chr(0x1FB00 + mask - 1)
        result.append(line.rstrip())
    return result


def grid_to_halfblock(grid):
    """
    Convert to fallback half-block art (no sextant glyphs).
    Each pair of pixel rows becomes one terminal row using U+2580/U+2584/U+2588/space.
    """
    rows, cols = len(grid), len(grid[0])
    result = []
    # Pad rows to even
    if rows % 2:
        grid = grid + [[False] * cols]
        rows += 1
    for i in range(0, rows, 2):
        line = ""
        for c in range(cols):
            t = grid[i  ][c]
            b = grid[i+1][c]
            if t and b:
                line += "\u2588"  # full block
            elif t:
                line += "\u2580"  # upper half block
            elif b:
                line += "\u2584"  # lower half block
            else:
                line += " "
        result.append(line.rstrip())
    return result


# ---------------------------------------------------------------------------
# Text rendering
# ---------------------------------------------------------------------------

def render_text(text, font, scale_x, scale_y, target_rows):
    """Render text with pyfiglet and scale to the target sextant row count."""
    try:
        import pyfiglet
    except ImportError:
        print("pyfiglet not found. Run:  pip install pyfiglet", file=sys.stderr)
        sys.exit(1)

    fig = pyfiglet.Figlet(font=font)
    art = fig.renderText(text)
    base_grid = to_grid(art)

    if not base_grid:
        print(f"pyfiglet produced no output with font '{font}'. Try --list-fonts.", file=sys.stderr)
        sys.exit(1)

    current_rows = len(base_grid)

    # Auto-choose vertical scale to hit target sextant row count
    if target_rows is not None and scale_y == 1:
        pixel_rows_needed = target_rows * 3
        if current_rows < pixel_rows_needed:
            scale_y = max(1, round(pixel_rows_needed / current_rows))

    sextant_grid = scale_grid(base_grid, scale_x, scale_y)

    # Fallback uses half-blocks (2 px per terminal row), so scale to target_rows * 2
    if target_rows is not None:
        fb_sy = max(1, round((target_rows * 2) / current_rows))
    else:
        fb_sy = max(1, (scale_y * 2) // 3)
    fallback_grid = scale_grid(base_grid, scale_x, fb_sy)

    return sextant_grid, fallback_grid


# ---------------------------------------------------------------------------
# TypeScript output
# ---------------------------------------------------------------------------

def emit_typescript(sextant_rows, fallback_rows):
    """Format rows as TypeScript logo.ts arrays."""

    def fmt_rows(rows):
        return "\n    ".join(f"`{r} `," for r in rows)

    def fmt_exit(rows):
        return ", ".join(f"`  {r}  `" for r in rows[:3])

    tui_s = sextant_rows
    plain_s = sextant_rows[:-1] if len(sextant_rows) > 3 else sextant_rows
    exit_s = sextant_rows[:3]

    tui_f = fallback_rows
    plain_f = fallback_rows[:-1] if len(fallback_rows) > 3 else fallback_rows
    exit_f = fallback_rows[:3]

    print("// Paste into src/kilocode/cli/logo.ts\n")
    print("const modern = {")
    print(f"  tui: [\n    {fmt_rows(tui_s)}\n  ],")
    print(f"  plain: [\n    {fmt_rows(plain_s)}\n  ],")
    print(f"  exit: [{fmt_exit(exit_s)}],")
    print("}\n")
    print("const fallback = {")
    print(f"  tui: [\n    {fmt_rows(tui_f)}\n  ],")
    print(f"  plain: [\n    {fmt_rows(plain_f)}\n  ],")
    print(f"  exit: [{fmt_exit(exit_f)}],")
    print("}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate sextant Unicode logo art for logo.ts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("text", nargs="?", default="Fox  CLI",
                        help="Text to render (default: 'Fox  CLI')")
    parser.add_argument("--font", "-f", default="banner3-D",
                        help="pyfiglet font (default: banner3-D). Try: banner, block, big, epic, doom")
    parser.add_argument("--scale-x", type=int, default=1, metavar="N",
                        help="Horizontal pixel scale (default: 1)")
    parser.add_argument("--scale-y", type=int, default=1, metavar="N",
                        help="Vertical pixel scale (default: auto-computed from --rows)")
    parser.add_argument("--rows", "-r", type=int, default=4, metavar="N",
                        help="Target sextant terminal rows (default: 4)")
    parser.add_argument("--raw", action="store_true",
                        help="Print raw repr of rows instead of TypeScript")
    parser.add_argument("--list-fonts", action="store_true",
                        help="List available pyfiglet fonts and exit")
    parser.add_argument("--install", action="store_true",
                        help="pip install pyfiglet and exit")
    args = parser.parse_args()

    if args.install:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyfiglet"])
        print("pyfiglet installed successfully.")
        return

    if args.list_fonts:
        try:
            import pyfiglet
        except ImportError:
            print("pyfiglet not installed. Run:  python logo_gen.py --install", file=sys.stderr)
            sys.exit(1)
        for f in sorted(pyfiglet.FigletFont.getFonts()):
            print(f)
        return

    sextant_grid, fallback_grid = render_text(
        args.text, args.font, args.scale_x, args.scale_y, args.rows
    )

    sextant_rows = [r.rstrip() for r in grid_to_sextant(sextant_grid)]
    fallback_rows = [r.rstrip() for r in grid_to_halfblock(fallback_grid)]

    if args.raw:
        print("=== sextant (modern) ===")
        for r in sextant_rows:
            print(repr(r))
        print("\n=== fallback ===")
        for r in fallback_rows:
            print(repr(r))
    else:
        emit_typescript(sextant_rows, fallback_rows)


if __name__ == "__main__":
    main()
