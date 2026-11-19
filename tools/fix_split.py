#!/usr/bin/env python3
"""Split double-height sprite frames (source gifs that pack two animation
frames per column) into single frames, in animation order.

usage: python3 tools/fix_split.py            # fix the known list
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = os.path.join(ROOT, 'assets', 'manifest.json')

# key, anim, number of halves per source frame
SPLIT = [('plant.squash', 'idle', 2), ('plant.squash', 'attack', 2)]


def main():
    m = json.load(open(MAN))
    for key, anim, parts in SPLIT:
        info = m['anim'][key][anim]
        path = os.path.join(ROOT, 'assets', info['file'])
        im = Image.open(path).convert('RGBA')
        fw, fh, cols, frames = info['fw'], info['fh'], info['cols'], info['frames']
        h2 = fh // parts
        tiles = []
        for n in range(frames):
            c, r = n % cols, n // cols
            t = im.crop((c * fw, r * fh, c * fw + fw, r * fh + fh))
            for p in range(parts):
                tiles.append(t.crop((0, p * h2, fw, (p + 1) * h2)))
        ncols = cols
        nrows = (len(tiles) + ncols - 1) // ncols
        out = Image.new('RGBA', (ncols * fw, nrows * h2), (0, 0, 0, 0))
        for i, t in enumerate(tiles):
            out.paste(t, ((i % ncols) * fw, (i // ncols) * h2))
        out.save(path)
        info['fh'] = h2
        info['frames'] = len(tiles)
        print('%-20s %-8s -> %d frames of %dx%d' % (key, anim, len(tiles), fw, h2))
    json.dump(m, open(MAN, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
