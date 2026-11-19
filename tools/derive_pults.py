#!/usr/bin/env python3
"""Derive the melon-pult plant + melon projectile sprites from the wiki's
Winter Melon art (same model, recoloured), and tidy the boomerang card art.

usage: python3 tools/derive_pults.py
"""
import json, os
from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = os.path.join(ROOT, 'assets', 'manifest.json')
P = os.path.join(ROOT, 'assets', 'img', 'plant')
F = os.path.join(ROOT, 'assets', 'img', 'fx')


def reg(key, img, anim='idle'):
    out = os.path.join(P, key.split('.')[1], anim + '.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out)
    man = json.load(open(MAN))
    man['anim'].setdefault(key, {})[anim] = {
        'file': os.path.relpath(out, os.path.join(ROOT, 'assets')).replace(os.sep, '/'),
        'frames': 1, 'fw': img.width, 'fh': img.height, 'cols': 1, 'fps': 1,
        'src': 'derived'}
    json.dump(man, open(MAN, 'w'), indent=1, sort_keys=True)
    print('%-22s %dx%d' % (key, img.width, img.height))


def reg_img(key, img):
    out = os.path.join(F, key.split('.')[1] + '.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out)
    man = json.load(open(MAN))
    man['images'][key] = os.path.relpath(out, os.path.join(ROOT, 'assets')).replace(os.sep, '/')
    json.dump(man, open(MAN, 'w'), indent=1, sort_keys=True)
    print('%-22s %dx%d' % (key, img.width, img.height))


def regreen(im):
    """shift the blue of the winter melon to melon green"""
    r, g, b, a = im.split()
    from PIL import ImageChops
    # blue -> green: swap-ish, boost green channel
    g2 = ImageChops.lighter(g, b)
    r2 = ImageChops.darker(r, b)
    return Image.merge('RGBA', (r2, g2, ImageChops.darker(b, ImageChops.subtract(b, g)), a))


def main():
    wm = Image.open(os.path.join(P, 'wintermelon', 'idle.png')).convert('RGBA')
    w, h = wm.size
    proj = wm.crop((0, 0, int(w * 0.62), int(h * 0.62)))
    plant = wm.crop((int(w * 0.30), int(h * 0.42), w, h))
    proj = proj.crop(proj.getbbox())
    plant = plant.crop(plant.getbbox())
    reg('plant.melonpult', regreen(plant))
    reg_img('fx.melon', regreen(proj))
    reg_img('fx.wmelon', proj)
    # boomerang: trim the almanac card border
    bo = Image.open(os.path.join(P, 'boomerang', 'idle.png')).convert('RGBA')
    bw, bh = bo.size
    bo = bo.crop((int(bw * 0.14), int(bh * 0.16), int(bw * 0.88), int(bh * 0.92)))
    reg('plant.boomerang', bo)


if __name__ == '__main__':
    main()
