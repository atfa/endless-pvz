#!/usr/bin/env python3
"""Asset pipeline for the endless PvZ game.

Downloads authentic Plants vs Zombies sprites (from public GitHub mirrors),
splits animated GIFs into frames, packs the frames into sprite sheets and
writes assets/manifest.json which the game loads at runtime.

Usage:
  python3 tools/fetch_assets.py            # download + build sheets + manifest
  python3 tools/fetch_assets.py --analyze  # report frame counts / loop periods
  python3 tools/fetch_assets.py --sheet KEY[,KEY]  # write labelled contact sheets
"""
import os, sys, json, hashlib, io, time, urllib.request, urllib.error
import concurrent.futures as cf
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, ".cache", "src")
ASSETS = os.path.join(ROOT, "assets")
SHEETS = os.path.join(ROOT, ".cache", "sheets")

PVZJS = "https://cdn.jsdelivr.net/gh/studyzy/pvzjs@main/"
WIKI = "https://plantsvszombies.wiki.gg/images/"
PVZH5 = "https://cdn.jsdelivr.net/gh/z1511676208/h5-plants-vs-zombies@main/"

# ---------------------------------------------------------------- animations
# key -> list of (anim, source_url, fps, start, end)   start/end = frame range
# in the *source* gif (end exclusive); None,None = whole gif.
Z = "images/Zombies/"
P = "images/Plants/"
I = "images/interface/"

ANIM = {
    # ---- plants -------------------------------------------------------
    "plant.sunflower": [
        ("idle", PVZJS + P + "SunFlower/SunFlower.gif", 12, 0, 25),
        ("produce", PVZJS + P + "SunFlower/SunFlower1.gif", 14, 0, 25),
    ],
    "plant.twinflower": [
        ("idle", PVZJS + P + "TwinSunflower/TwinSunflower.gif", 12, 0, 25),
        ("produce", PVZJS + P + "TwinSunflower/TwinSunflower1.gif", 14, 0, 25),
    ],
    "plant.peashooter": [
        ("idle", PVZJS + P + "Peashooter/Peashooter.gif", 12, 0, 20),
        ("attack", PVZJS + P + "Peashooter/Peashooter.gif", 20, 20, 25),
    ],
    "plant.snowpea": [
        ("idle", PVZJS + P + "SnowPea/SnowPea.gif", 12, 0, 20),
        ("attack", PVZJS + P + "SnowPea/SnowPea.gif", 20, 20, 25),
    ],
    "plant.repeater": [
        ("idle", PVZJS + P + "Repeater/Repeater.gif", 12, 0, 20),
        ("attack", PVZJS + P + "Repeater/Repeater.gif", 20, 20, 25),
    ],
    "plant.gatlingpea": [("idle", PVZJS + P + "GatlingPea/GatlingPea.gif", 14, None, None)],
    "plant.splitpea": [("idle", PVZJS + P + "SplitPea/SplitPea.gif", 12, None, None)],
    "plant.threepeater": [("idle", PVZJS + P + "Threepeater/Threepeater.gif", 12, None, None)],
    "plant.starfruit": [("idle", PVZJS + P + "Starfruit/Starfruit.gif", 12, None, None)],
    "plant.puffshroom": [
        ("idle", PVZJS + P + "PuffShroom/PuffShroom.gif", 12, None, None),
        ("sleep", PVZJS + P + "PuffShroom/PuffShroomSleep.gif", 6, None, None),
    ],
    "plant.fumeshroom": [
        ("idle", PVZJS + P + "FumeShroom/FumeShroom.gif", 12, None, None),
        ("attack", PVZJS + P + "FumeShroom/FumeShroomAttack.gif", 12, None, None),
    ],
    "plant.gloomshroom": [
        ("idle", PVZJS + P + "GloomShroom/GloomShroom.gif", 12, None, None),
        ("attack", PVZJS + P + "GloomShroom/GloomShroomAttack.gif", 16, None, None),
    ],
    "plant.wallnut": [
        ("idle", PVZJS + P + "WallNut/WallNut.gif", 8, None, None),
        ("cracked", PVZJS + P + "WallNut/Wallnut_cracked1.gif", 8, None, None),
        ("broken", PVZJS + P + "WallNut/Wallnut_cracked2.gif", 8, None, None),
    ],
    "plant.tallnut": [
        ("idle", PVZJS + P + "TallNut/TallNut.gif", 8, None, None),
        ("cracked", PVZJS + P + "TallNut/TallnutCracked1.gif", 8, None, None),
        ("broken", PVZJS + P + "TallNut/TallnutCracked2.gif", 8, None, None),
    ],
    "plant.cherrybomb": [
        ("idle", PVZJS + P + "CherryBomb/CherryBomb.gif", 12, None, None),
        ("boom", PVZJS + P + "CherryBomb/Boom.gif", 22, None, None),
    ],
    "plant.jalapeno": [
        ("idle", PVZJS + P + "Jalapeno/Jalapeno.gif", 12, None, None),
        ("boom", PVZJS + P + "Jalapeno/JalapenoAttack.gif", 20, None, None),
    ],
    "plant.iceshroom": [
        ("idle", PVZJS + P + "IceShroom/IceShroom.gif", 12, None, None),
        ("boom", PVZJS + P + "IceShroom/Snow.gif", 12, None, None),
    ],
    "plant.squash": [
        ("idle", PVZJS + P + "Squash/Squash.gif", 12, None, None),
        ("attack", PVZJS + P + "Squash/SquashAttack.gif", 22, None, None),
    ],
    "plant.cabbagepult": [("idle", WIKI + "Cabbage-pult.gif", 10, None, None)],
    "plant.melonpult": [("idle", WIKI + "Melon-pult.gif", 10, None, None)],
    "plant.wintermelon": [("idle", WIKI + "Melon-pult.gif", 10, None, None)],
    "plant.boomerang": [
        ("idle", WIKI + "BloomerangAttacking1.png", 1, None, None),
        ("attack", WIKI + "BloomerangAttacking2.png", 1, None, None),
    ],
    "plant.potatomine": [
        ("armed", PVZJS + P + "PotatoMine/PotatoMine.gif", 8, None, None),
        ("ready", PVZJS + P + "PotatoMine/PotatoMineNotReady.gif", 8, None, None),
        ("boom", PVZJS + P + "PotatoMine/ExplosionSpudow.gif", 12, None, None),
    ],
    "plant.chomper": [
        ("idle", PVZJS + P + "Chomper/Chomper.gif", 12, None, None),
        ("attack", PVZJS + P + "Chomper/ChomperAttack.gif", 20, None, None),
        ("digest", PVZJS + P + "Chomper/ChomperDigest.gif", 10, None, None),
    ],
    "plant.garlic": [("idle", PVZJS + P + "Garlic/Garlic.gif", 8, None, None)],
    "plant.spikeweed": [("idle", PVZJS + P + "Spikeweed/Spikeweed.gif", 8, None, None)],
    "plant.spikerock": [("idle", PVZJS + P + "Spikerock/Spikerock.gif", 8, None, None)],
    "plant.torchwood": [("idle", PVZJS + P + "Torchwood/Torchwood.gif", 8, None, None)],
    "plant.pumpkin": [("idle", PVZJS + P + "PumpkinHead/PumpkinHead.gif", 8, None, None)],
    "plant.cactus": [
        ("idle", PVZJS + P + "Cactus/Cactus.gif", 12, None, None),
        ("attack", PVZJS + P + "Cactus/Attack.gif", 18, None, None),
    ],
    "plant.doomshroom": [
        ("idle", PVZJS + P + "DoomShroom/DoomShroom.gif", 12, None, None),
        ("boom", PVZJS + P + "DoomShroom/BeginBoom.gif", 20, None, None),
    ],
    # ---- projectiles / effects -----------------------------------------
    "fx.pea": [("idle", PVZJS + "images/Plants/PB00.gif", 12, None, None)],
    "fx.pea2": [("idle", PVZJS + "images/Plants/PB01.gif", 12, None, None)],
    "fx.snowpea": [("idle", PVZJS + "images/Plants/PB-10.gif", 12, None, None)],
    "fx.peahit": [("idle", PVZJS + "images/Plants/PeaBulletHit.gif", 24, None, None)],
    "fx.fume": [("idle", PVZJS + P + "FumeShroom/FumeShroomBullet.gif", 20, None, None)],
    "fx.star": [("idle", PVZJS + P + "Starfruit/Star.gif", 20, None, None)],
    "fx.sun": [("idle", PVZJS + I + "Sun.gif", 12, None, None)],
    "fx.shovel": [("idle", PVZJS + I + "Shovel/0.gif", 12, None, None)],
    "fx.mower": [("idle", PVZJS + I + "LawnCleaner.png", 12, None, None)],
    "fx.mowerpool": [("idle", PVZJS + I + "PoolCleaner.png", 12, None, None)],
    "fx.crater": [("idle", PVZJS + I + "crater1.png", 12, None, None)],
    "fx.shadow": [("idle", PVZJS + I + "plantshadow32.png", 12, None, None)],
    "fx.huge": [("idle", PVZJS + I + "LargeWave.gif", 12, None, None)],
    "fx.finalwave": [("idle", PVZJS + I + "FinalWave.gif", 12, None, None)],
    "fx.zombiehand": [("idle", PVZJS + I + "ZombieHand.png", 12, None, None)],
    "fx.ice": [("idle", PVZJS + I + "splash.png", 12, None, None)],
    # ---- zombies -------------------------------------------------------
    "zombie.basic": [
        ("walk", PVZJS + Z + "Zombie/Zombie.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "Zombie/ZombieAttack.gif", 14, 14, 27),
        ("die", PVZJS + Z + "Zombie/ZombieDie.gif", 16, 0, 16),
        ("head", PVZJS + Z + "Zombie/ZombieHead.gif", 16, None, None),
        ("losthead", PVZJS + Z + "Zombie/ZombieLostHead.gif", 12, 0, 14),
        ("losthead_attack", PVZJS + Z + "Zombie/ZombieLostHeadAttack.gif", 14, 14, 27),
    ],
    "zombie.conehead": [
        ("walk", PVZJS + Z + "ConeheadZombie/ConeheadZombie.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "ConeheadZombie/ConeheadZombieAttack.gif", 14, 14, 27),
    ],
    "zombie.buckethead": [
        ("walk", PVZJS + Z + "BucketheadZombie/BucketheadZombie.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "BucketheadZombie/BucketheadZombieAttack.gif", 14, 14, 27),
    ],
    "zombie.flag": [
        ("walk", PVZJS + Z + "FlagZombie/FlagZombie.gif", 14, 0, 14),
        ("attack", PVZJS + Z + "FlagZombie/FlagZombieAttack.gif", 14, 14, 27),
        ("losthead", PVZJS + Z + "FlagZombie/FlagZombieLostHead.gif", 12, 0, 14),
    ],
    "zombie.newspaper": [
        ("walk", PVZJS + Z + "NewspaperZombie/HeadWalk0.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "NewspaperZombie/HeadAttack0.gif", 14, 0, 13),
        ("enraged", PVZJS + Z + "NewspaperZombie/LostHeadWalk0.gif", 18, 0, 14),
        ("paper", PVZJS + Z + "NewspaperZombie/LostNewspaper.gif", 16, None, None),
        ("die", PVZJS + Z + "NewspaperZombie/Die.gif", 16, 0, 16),
    ],
    "zombie.polevault": [
        ("walk", PVZJS + Z + "PoleVaultingZombie/PoleVaultingZombieWalk.gif", 12, 0, 14),
        ("jump", PVZJS + Z + "PoleVaultingZombie/PoleVaultingZombieJump.gif", 18, 0, 29),
        ("attack", PVZJS + Z + "PoleVaultingZombie/PoleVaultingZombieAttack.gif", 14, 14, 28),
        ("losthead", PVZJS + Z + "PoleVaultingZombie/PoleVaultingZombieLostHead.gif", 12, None, None),
    ],
    "zombie.football": [
        ("walk", PVZJS + Z + "FootballZombie/FootballZombie.gif", 16, 0, 15),
        ("attack", PVZJS + Z + "FootballZombie/Attack.gif", 18, 16, 30),
        ("die", PVZJS + Z + "FootballZombie/Die.gif", 18, 0, 18),
        ("losthead", PVZJS + Z + "FootballZombie/LostHead.gif", 16, 0, 15),
        ("ornlost", PVZJS + Z + "FootballZombie/OrnLost.gif", 16, 0, 15),
    ],
    "zombie.screendoor": [
        ("walk", PVZJS + Z + "ScreenDoorZombie/ScreenDoorZombie.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "ScreenDoorZombie/ScreenDoorZombieAttack.gif", 14, 14, 27),
        ("shieldless", PVZJS + Z + "ScreenDoorZombie/HeadWalk1.gif", 12, 0, 14),
    ],
    "zombie.jackbox": [
        ("walk", PVZJS + Z + "JackinTheBoxZombie/Walk.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "JackinTheBoxZombie/Attack.gif", 16, None, None),
        ("boom", PVZJS + Z + "JackinTheBoxZombie/Boom.gif", 20, None, None),
        ("die", PVZJS + Z + "JackinTheBoxZombie/Die.gif", 16, 0, 16),
    ],
    "zombie.balloon": [
        ("walk", PVZJS + Z + "BalloonZombie/Walk.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "BalloonZombie/Attack.gif", 14, 0, 13),
        ("drop", PVZJS + Z + "BalloonZombie/Drop.gif", 18, 0, 29),
        ("die", PVZJS + Z + "BalloonZombie/Die.gif", 14, 0, 14),
    ],
    "zombie.dancing": [
        ("walk", PVZJS + Z + "DancingZombie/DancingZombie.gif", 12, None, None),
        ("dance", PVZJS + Z + "DancingZombie/Dancing.gif", 12, None, None),
        ("summon", PVZJS + Z + "DancingZombie/Summon1.gif", 14, None, None),
        ("attack", PVZJS + Z + "DancingZombie/Attack.gif", 14, 0, 14),
        ("die", PVZJS + Z + "DancingZombie/Die.gif", 16, 0, 16),
    ],
    "zombie.backup": [
        ("walk", PVZJS + Z + "BackupDancer/BackupDancer.gif", 12, None, None),
        ("attack", PVZJS + Z + "BackupDancer/Attack.gif", 14, 0, 15),
        ("die", PVZJS + Z + "BackupDancer/Die.gif", 14, 0, 14),
        ("mound", PVZJS + Z + "BackupDancer/Mound.gif", 12, None, None),
    ],
    "zombie.zomboni": [
        ("walk", PVZJS + Z + "Zomboni/1.gif", 12, None, None),
        ("die", PVZJS + Z + "Zomboni/4.gif", 16, 11, 16),
        ("boom", PVZJS + Z + "Zomboni/5.gif", 18, None, None),
    ],
    "zombie.gargantuar": [
        ("walk", PVZJS + Z + "LGBOSS/1.gif", 10, None, None),
        ("attack", PVZJS + Z + "LGBOSS/2.gif", 16, None, None),
        ("die", PVZJS + Z + "LGBOSS/3.gif", 16, 8, 14),
        ("boom", PVZJS + Z + "LGBOSS/5.gif", 18, None, None),
    ],
    "zombie.imp": [
        ("walk", PVZJS + Z + "Imp/Zombie.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "Imp/ZombieAttack.gif", 14, 0, 14),
        ("die", PVZJS + Z + "Imp/ZombieDie.gif", 16, 0, 14),
    ],
    "zombie.mustache": [
        ("walk", PVZJS + Z + "MustacheZombie/Zombie.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "MustacheZombie/ZombieAttack.gif", 14, 14, 27),
    ],
    "zombie.snorkel": [
        ("walk", PVZJS + Z + "SnorkelZombie/Walk1.gif", 12, 0, 14),
        ("attack", PVZJS + Z + "SnorkelZombie/Attack.gif", 14, 0, 13),
    ],
}

# plain (non-animated) images copied as-is
IMAGES = {
    "bg.lawn": PVZJS + I + "background1.jpg",
    "bg.lawn_unsodded": PVZJS + I + "background1unsodded.jpg",
    "ui.logo": PVZJS + I + "Logo.png",
    "ui.zombies_won": PVZJS + I + "ZombiesWon.png",
    "ui.seedbar": PVZJS + I + "SeedChooser_Background.png",
    "ui.card": PVZJS + I + "Almanac_PlantCard.png",
    "ui.button": PVZJS + I + "Button.png",
    "ui.flag_empty": PVZJS + I + "FlagMeterEmpty.png",
    "ui.flag_full": PVZJS + I + "FlagMeterFull.png",
    "ui.flag_progress": PVZJS + I + "FlagMeterLevelProgress.png",
    "ui.sunback": PVZJS + I + "SunBack.png",
    "fx.melon": WIKI + "Melon.png",
}

# audio (mp3, copied as-is)
AUDIO = {
    "theme": PVZJS + "audio/Loonboon.mp3",
    "awooga": PVZJS + "audio/awooga.mp3",
    "chomp": PVZJS + "audio/chomp.mp3",
    "chompsoft": PVZJS + "audio/chompsoft.mp3",
    "plant": PVZJS + "audio/plant_water.mp3",
    "explosion": PVZJS + "audio/explosion.mp3",
    "coin": PVZJS + "audio/points.mp3",
    "groan3": PVZJS + "audio/groan3.mp3",
    "groan4": PVZJS + "audio/groan4.mp3",
    "groan5": PVZJS + "audio/groan5.mp3",
    "groan6": PVZJS + "audio/groan6.mp3",
    "mower": PVZJS + "audio/lawnmower.mp3",
    "click": PVZJS + "audio/buttonclick.mp3",
    "frozen": PVZJS + "audio/frozen.mp3",
    "jalapeno": PVZJS + "audio/jalapeno.mp3",
    "siren": PVZJS + "audio/siren.mp3",
    "hugewave": PVZJS + "audio/hugewave.mp3",
    "finalwave": PVZJS + "audio/finalwave.mp3",
    "lose": PVZJS + "audio/losemusic.mp3",
    "scream": PVZJS + "audio/scream.mp3",
    "zamboni": PVZJS + "audio/zamboni.mp3",
    "vault": PVZJS + "audio/polevault.mp3",
    "newspaper": PVZJS + "audio/newspaper_rarrgh2.mp3",
    "balloon": PVZJS + "audio/ballooninflate.mp3",
    "doom": PVZJS + "audio/doomshroom.mp3",
    "win": PVZJS + "audio/winmusic.mp3",
}

# ---------------------------------------------------------------- helpers
def mirrors(url):
    yield url
    if url.startswith(PVZJS):
        yield "https://raw.githubusercontent.com/studyzy/pvzjs/main/" + url[len(PVZJS):]
    elif url.startswith(PVZH5):
        yield "https://raw.githubusercontent.com/z1511676208/h5-plants-vs-zombies/main/" + url[len(PVZH5):]


def fetch(url, tries=6):
    name = url.split("//", 1)[1].replace("/", "_")
    path = os.path.join(CACHE, name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(CACHE, exist_ok=True)
    last = None
    for i in range(tries):
        for u in mirrors(url):
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "pvz-web/1.0"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = r.read()
                if not data:
                    raise IOError("empty")
                tmp = path + ".part.%d" % os.getpid()
                with open(tmp, "wb") as f:
                    f.write(data)
                os.replace(tmp, path)
                return path
            except Exception as e:  # noqa
                last = e
                time.sleep(0.6 * (i + 1))
    raise IOError("download failed %s: %s" % (url, last))


def gif_frames(path):
    """Return list of RGBA PIL images, one per gif frame (single-image files ok)."""
    im = Image.open(path)
    out = []
    try:
        n = getattr(im, "n_frames", 1)
    except Exception:
        n = 1
    for i in range(n):
        try:
            im.seek(i)
        except EOFError:
            break
        fr = im.convert("RGBA")
        out.append(fr)
    return out


def fhash(img):
    return hashlib.md5(img.tobytes()).hexdigest()


def dedupe(frames):
    out, prev = [], None
    for f in frames:
        h = fhash(f)
        if h != prev:
            out.append(f)
            prev = h
    return out


def pack_sheet(frames, maxw=1024, maxh=1024):
    """Grid-pack frames; returns (sheet image, cols, fw, fh)."""
    fw = max(f.width for f in frames)
    fh = max(f.height for f in frames)
    cols = max(1, min(len(frames), maxw // max(1, fw)))
    rows = (len(frames) + cols - 1) // cols
    while rows * fh > maxh and cols < len(frames):
        cols += 1
        rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        c, r = i % cols, i // cols
        sheet.paste(f, (c * fw + (fw - f.width) // 2, r * fh + (fh - f.height)))
    return sheet, cols, fw, fh


def out_path(key, anim):
    p = os.path.join(ASSETS, "img", key.replace(".", "/"), anim + ".png")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def rel(path):
    return os.path.relpath(path, ASSETS).replace(os.sep, "/")


def build_one(key, anim, url, fps, start, end):
    src = fetch(url)
    frames = gif_frames(src)
    if start is not None:
        frames = frames[start:end]
    frames = dedupe(frames)
    if not frames:
        raise IOError("no frames: " + url)
    sheet, cols, fw, fh = pack_sheet(frames)
    op = out_path(key, anim)
    sheet.save(op, optimize=True)
    return key, anim, {
        "file": rel(op), "frames": len(frames), "fw": fw, "fh": fh,
        "cols": cols, "fps": fps, "src": url,
    }


def analyze(key):
    for anim, url, fps, s, e in ANIM[key]:
        try:
            src = fetch(url)
            fr = gif_frames(src)
            hs = [fhash(f) for f in fr]
            uniq = len(set(hs))
            # smallest loop period
            per = 0
            n = len(hs)
            for p in range(1, n // 2 + 1):
                if all(hs[i] == hs[i + p] for i in range(n - p)):
                    per = p
                    break
            print("%-26s %-14s frames=%-3d uniq=%-3d loop=%-3d %dx%d  %s"
                  % (key, anim, len(fr), uniq, per, fr[0].width, fr[0].height, url.split("main/")[-1]))
        except Exception as ex:
            print("%-26s %-14s FAIL %s" % (key, anim, ex))


def contact_sheet(key, outdir=SHEETS):
    os.makedirs(outdir, exist_ok=True)
    for anim, url, fps, s, e in ANIM[key]:
        src = fetch(url)
        fr = gif_frames(src)
        n = len(fr)
        cols = 8
        rows = (n + cols - 1) // cols
        fw, fh = fr[0].size
        sc = min(1.0, 120.0 / max(fw, fh))
        w, h = int(fw * sc), int(fh * sc)
        pad = 16
        sheet = Image.new("RGBA", (cols * (w + 4), rows * (h + pad)), (24, 24, 30, 255))
        d = ImageDraw.Draw(sheet)
        for i, f in enumerate(fr):
            c, r = i % cols, i // cols
            x, y = c * (w + 4), r * (h + pad)
            sheet.paste(f.resize((w, h)), (x, y))
            d.text((x + 2, y + h + 1), str(i), fill=(255, 255, 0, 255))
        p = os.path.join(outdir, "%s.%s.png" % (key.replace(".", "_"), anim))
        sheet.save(p)
        print(p, n, "frames")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "build"
    keys = sys.argv[2].split(",") if len(sys.argv) > 2 else list(ANIM)
    os.makedirs(CACHE, exist_ok=True)
    if mode == "--analyze":
        for k in keys:
            analyze(k)
        return
    if mode == "--sheet":
        for k in keys:
            contact_sheet(k)
        return

    jobs = [(k, a) for k in keys for (a, u, f, s, e) in [(x[0], x[1], x[2], x[3], x[4]) for x in ANIM[k]]]
    srcs = {}
    for k in keys:
        for anim, url, fps, s, e in ANIM[k]:
            srcs[(k, anim)] = (url, fps, s, e)

    manifest_path = os.path.join(ASSETS, "manifest.json")
    man = {}
    if os.path.exists(manifest_path):
        man = json.load(open(manifest_path))
    man.setdefault("anim", {})
    man.setdefault("images", {})
    man.setdefault("audio", {})

    done = 0
    with cf.ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(build_one, k, a, *srcs[(k, a)]): (k, a) for (k, a) in jobs}
        for fu in cf.as_completed(futs):
            k, a = futs[fu]
            try:
                key, anim, info = fu.result()
                man["anim"].setdefault(key, {})[anim] = info
                done += 1
                print("ok  %-24s %-14s %2df %4dx%-4d cols=%d" %
                      (key, anim, info["frames"], info["fw"], info["fh"], info["cols"]))
            except Exception as e:
                print("FAIL %-24s %s" % (k, e))

    def copy(url, dest):
        src = fetch(url)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(src, "rb") as f:
            data = f.read()
        with open(dest, "wb") as f:
            f.write(data)
        return len(data)

    for key, url in IMAGES.items():
        d = os.path.join(ASSETS, "img", key.replace(".", "/") + os.path.splitext(url)[1].lower())
        try:
            copy(url, d)
            man["images"][key] = rel(d)
            print("img %-22s %s" % (key, man["images"][key]))
        except Exception as e:
            print("FAIL img %s %s" % (key, e))
    for key, url in AUDIO.items():
        d = os.path.join(ASSETS, "audio", key + ".mp3")
        try:
            copy(url, d)
            man["audio"][key] = rel(d)
        except Exception as e:
            print("FAIL audio %s %s" % (key, e))
    man["anim"] = dict(sorted(man["anim"].items()))
    man["generated"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(manifest_path, "w") as f:
        json.dump(man, f, indent=1, sort_keys=True)
    print("manifest:", manifest_path, "anims:", sum(len(v) for v in man["anim"].values()))


if __name__ == "__main__":
    main()
