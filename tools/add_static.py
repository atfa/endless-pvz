#!/usr/bin/env python3
"""Add single-frame (static) plant sprites from the PvZ wiki, downscaled to
game size, and register them in assets/manifest.json.

usage: python3 tools/add_static.py
"""
import json, os, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = os.path.join(ROOT, 'assets', 'manifest.json')
W = 'https://plantsvszombies.wiki.gg/images/'

# key, url, target height px
ITEMS = [
    ('plant.cabbagepult', W + 'Cabbage-pult.png?ef4508', 92),
    ('plant.melonpult', W + 'Melon-pult.png?6bcd6c', 96),
    ('plant.wintermelon', W + 'Winter_Melon.png?638074', 96),
    ('plant.boomerang', W + 'Bloomerang2.png?5dec2f', 88),
]


def main():
    man = json.load(open(MAN))
    for key, url, h in ITEMS:
        raw = urllib.request.urlopen(urllib.request.Request(
            url, headers={'User-Agent': 'pvz-build/1.0'}), timeout=90).read()
        import io
        im = Image.open(io.BytesIO(raw)).convert('RGBA')
        sc = h / im.height
        im = im.resize((max(1, int(im.width * sc)), h), Image.LANCZOS)
        # trim transparent margins
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
        out = os.path.join(ROOT, 'assets', 'img', 'plant', key.split('.')[1], 'idle.png')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.save(out)
        man['anim'].setdefault(key, {})['idle'] = {
            'file': os.path.relpath(out, os.path.join(ROOT, 'assets')).replace(os.sep, '/'),
            'frames': 1, 'fw': im.width, 'fh': im.height, 'cols': 1, 'fps': 1, 'src': url}
        print('%-22s %dx%d' % (key, im.width, im.height))
    man['anim'] = dict(sorted(man['anim'].items()))
    json.dump(man, open(MAN, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
