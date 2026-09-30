"""Outline text to SVG path data (no <text> in brand SVGs).

Usage: uv run --with fonttools python brand/scripts/outline.py <font.ttf> <text> [tracking_units]
Prints JSON: {"d": "<path in font units, y flipped>", "width": advance, "ascent": .., "descent": .., "bbox": [xMin,yMin,xMax,yMax]}
Coordinates are in font units with y pointing down (baseline at y=0), ready for an SVG transform.
"""
import json
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


def main() -> None:
    font_path, text = sys.argv[1], sys.argv[2]
    tracking = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    font = TTFont(font_path)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    svg_pen = SVGPathPen(glyph_set)
    bounds_pen = BoundsPen(glyph_set)
    x = 0.0
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        advance = hmtx[name][0]
        # Flip y so the path is SVG-native (y down).
        glyph_set[name].draw(TransformPen(svg_pen, (1, 0, 0, -1, x, 0)))
        glyph_set[name].draw(TransformPen(bounds_pen, (1, 0, 0, -1, x, 0)))
        x += advance + (tracking if i < len(text) - 1 else 0)
    hhea = font["hhea"]
    print(
        json.dumps(
            {
                "d": svg_pen.getCommands(),
                "width": x,
                "ascent": hhea.ascent,
                "descent": hhea.descent,
                "upm": font["head"].unitsPerEm,
                "bbox": bounds_pen.bounds,
            }
        )
    )


if __name__ == "__main__":
    main()
