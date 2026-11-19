#!/usr/bin/env python3
"""Import crossover zombies (CC0 packs) into assets/ and register them.

Sources (both CC0, no attribution required):
  * OpenGameArt "Dinosaurs" by ARoachIFoundOnMyPillow  -- 6 species + corpses + eggs
  * Kenney "Monster Builder Pack"                      -- modular monster parts
The source packs are static poses, so we bake small walk cycles out of them
(bob / limb swap) and use the corpse art as the death frame.
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
MAN = os.path.join(ROOT, "assets", "manifest.json")
DINO = os.environ.get("DINO_DIR", os.path.expanduser("~/tmp/pvz/dino/dino/dinosaurs"))
KMB = os.environ.get("KMB_DIR", os.path.expanduser("~/tmp/pvz/probe/kmb/PNG/Default"))
SRC_DINO = "local:opengameart.org/content/dinosaurs (CC0)"
SRC_KMB = "local:kenney.nl Monster Builder Pack (CC0)"


def strip(frames, path):
  """Save frames side by side on a common cell size, bottom-centre anchored."""
  cw = max(f.width for f in frames)
  ch = max(f.height for f in frames)
  out = Image.new("RGBA", (cw * len(frames), ch), (0, 0, 0, 0))
  for i, f in enumerate(frames):
    out.paste(f, (i * cw + (cw - f.width) // 2, ch - f.height), f)
  os.makedirs(os.path.dirname(path), exist_ok=True)
  out.save(path)
  return {"cols": len(frames), "frames": len(frames), "fw": out.width, "fh": out.height,
          "file": os.path.relpath(path, os.path.join(ROOT, "assets")).replace(os.sep, "/"),
          "fps": 6}


def bob(im, dy):
  """Return a copy of im shifted vertically by dy (keeps size)."""
  o = Image.new("RGBA", im.size, (0, 0, 0, 0))
  o.paste(im, (0, dy), im)
  return o


def load(p):
  return Image.open(p).convert("RGBA")


def dino_walk(src, amps=(-3, 0, -1, 0), fps=6):
  frames = [bob(load(src), int(round(a * max(1, load(src).height / 90.0)))) for a in amps]
  s = strip(frames, "")
  return frames, s


def add(man, key, anim, src):
  e = man["anim"].setdefault(key, {})
  e[anim["name"]] = {k: v for k, v in anim.items() if k != "name"}
  e[anim["name"]]["src"] = src


def register(man, key, name, path, fps, src, anim_name="walk", cols=None):
  """Register a strip already written at assets path `path`.  `cols` = frame count."""
  im = Image.open(path)
  W, H = im.size
  if cols is None:
    cols = max(1, round(W / H))
  fw, fh = W // cols, H
  rel = os.path.relpath(path, os.path.join(ROOT, "assets")).replace(os.sep, "/")
  man["anim"].setdefault(key, {})[anim_name] = {
      "cols": cols, "frames": cols, "fw": fw, "fh": fh, "fps": fps,
      "file": rel, "src": src}
  print("  %-22s %-7s %4dx%-4d x%d (frame %dx%d)" % (key, anim_name, W, H, cols, fw, fh))


def main():
  man = json.load(open(MAN))
  zb = os.path.join(IMG, "zombie")

  # ---------------- dinosaurs (CC0) ----------------
  # source art that faces right: the zombies walk left, so mirror them
  FLIP = {"raptor"}
  dino = {
      # key: (walk source, frames to bake, corpse, scale hint)
      "raptor": (["dino1.png"], "dino_corpse.png"),
      "triceratops": (["triceratops3.png"], "triceratops_corpse.png"),
      "ankylosaur": (["ankylosaur1.png"], "ankylosaur_corpse.png"),
      "sauropod": (["sauropod1.png"], "sauropod_corpse.png"),
      "trex": (["trex1.png"], "trex_corpse.png"),
  }
  for key, (srcs, corpse) in dino.items():
    src = os.path.join(DINO, srcs[0])
    im = load(src)
    if key in FLIP:
      im = im.transpose(Image.FLIP_LEFT_RIGHT)
    amp = max(2, int(im.height * 0.035))
    frames = [bob(im, -amp), bob(im, 0), bob(im, -amp // 2), bob(im, 0)]
    p = os.path.join(zb, key, "walk.png")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    cw = max(f.width for f in frames)
    ch = max(f.height for f in frames) + amp
    sheet = Image.new("RGBA", (cw * len(frames), ch), (0, 0, 0, 0))
    for i, f in enumerate(frames):
      sheet.paste(f, (i * cw + (cw - f.width) // 2, ch - f.height), f)
    sheet.save(p)
    register(man, "zombie." + key, key, p, 6, SRC_DINO, "walk", len(frames))
    c = load(os.path.join(DINO, corpse))
    if key in FLIP:
      c = c.transpose(Image.FLIP_LEFT_RIGHT)
    cp = os.path.join(zb, key, "die.png")
    c.save(cp)
    register(man, "zombie." + key, key, cp, 1, SRC_DINO, "die", 1)

  # pterosaur: the two colour variants are a wing-up / wing-mid flap
  fl = [load(os.path.join(DINO, "pterosaur1.png")), load(os.path.join(DINO, "pterosaur2.png"))]
  p = os.path.join(zb, "pterosaur", "walk.png")
  os.makedirs(os.path.dirname(p), exist_ok=True)
  cw = max(f.width for f in fl)
  ch = max(f.height for f in fl)
  sheet = Image.new("RGBA", (cw * 2, ch), (0, 0, 0, 0))
  for i, f in enumerate(fl):
    sheet.paste(f, (i * cw, 0), f)
  sheet.save(p)
  register(man, "zombie.pterosaur", "pterosaur", p, 5, SRC_DINO, "walk", 2)
  load(os.path.join(DINO, "pterosaur_corpse.png")).save(os.path.join(zb, "pterosaur", "die.png"))
  register(man, "zombie.pterosaur", "pterosaur", os.path.join(zb, "pterosaur", "die.png"), 1, SRC_DINO, "die", 1)

  # egg: whole -> cracked
  eg = [load(os.path.join(DINO, "eggs.png")), load(os.path.join(DINO, "eggs_fried.png"))]
  p = os.path.join(zb, "egg", "walk.png")
  os.makedirs(os.path.dirname(p), exist_ok=True)
  cw = max(f.width for f in eg)
  ch = max(f.height for f in eg)
  sheet = Image.new("RGBA", (cw * 2, ch), (0, 0, 0, 0))
  for i, f in enumerate(eg):
    sheet.paste(f, (i * cw + (cw - f.width) // 2, ch - f.height), f)
  sheet.save(p)
  register(man, "zombie.egg", "egg", p, 2, SRC_DINO, "walk", 2)

  # ---------------- kenney monsters (CC0) ----------------
  def part(n):
    return load(os.path.join(KMB, n))

  def monster(body, eye, mouth, arm, leg, name, arm_scale=1.0):
    b = part(body)
    W, H = b.width, b.height
    cell = (int(W * 1.5), int(H * 1.25))
    frames = []
    for phase in (0, 1):
      f = Image.new("RGBA", cell, (0, 0, 0, 0))
      bx, by = (cell[0] - W) // 2, cell[1] - H - int(H * 0.16)
      # legs first (behind body), swapped per phase
      lg = part(leg)
      for s in (-1, 1):
        l = lg if phase == 0 else lg.transpose(Image.FLIP_LEFT_RIGHT)
        f.paste(l, (cell[0] // 2 + s * int(W * 0.16) - l.width // 2,
                    cell[1] - l.height + (int(H * 0.05) if phase else 0)), l)
      f.paste(b, (bx, by), b)
      if arm:
        ar = part(arm)
        if arm_scale != 1.0:
          ar = ar.resize((int(ar.width * arm_scale), int(ar.height * arm_scale)))
        for s in (-1, 1):
          a = ar.transpose(Image.FLIP_LEFT_RIGHT) if s < 0 else ar
          if phase:
            a = a.rotate(-18 * s, expand=True)
          f.paste(a, (cell[0] // 2 + s * int(W * 0.46) - a.width // 2,
                      by + int(H * 0.30)), a)
      e = part(eye)
      es = int(W * 0.34) / e.width
      e = e.resize((int(e.width * es), int(e.height * es)))
      f.paste(e, (cell[0] // 2 - e.width // 2, by + int(H * 0.22)), e)
      if mouth:
        m = part(mouth)
        ms = int(W * 0.4) / m.width
        m = m.resize((int(m.width * ms), int(m.height * ms)))
        f.paste(m, (cell[0] // 2 - m.width // 2, by + int(H * 0.55)), m)
      frames.append(f)
    p = os.path.join(zb, name, "walk.png")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    strip(frames, p)
    register(man, "zombie." + name, name, p, 4, SRC_KMB, "walk", len(frames))
    # death: squashed body
    sq = b.resize((int(W * 1.25), int(H * 0.35)))
    d = Image.new("RGBA", (int(W * 1.5), int(H * 0.5)), (0, 0, 0, 0))
    d.paste(sq, ((d.width - sq.width) // 2, d.height - sq.height), sq)
    dp = os.path.join(zb, name, "die.png")
    d.save(dp)
    register(man, "zombie." + name, name, dp, 1, SRC_KMB, "die", 1)

  monster("body_greenE.png", "eye_red.png", "mouth_closed_fangs.png",
          "arm_greenB.png", "leg_greenB.png", "bomber")
  monster("body_greenB.png", "eye_psycho_light.png", "mouth_closed_teeth.png",
          "arm_greenC.png", "leg_greenC.png", "beholder")
  monster("body_blueE.png", "eye_yellow.png", None,
          None, "leg_blueB.png", "imposter")

  json.dump(man, open(MAN, "w"), indent=1, sort_keys=True)
  print("manifest anim groups:", len(man["anim"]))


if __name__ == "__main__":
  main()
