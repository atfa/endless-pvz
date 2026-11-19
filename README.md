# 无尽植物大战僵尸 (Endless PvZ)

An endless **Plants vs Zombies** — no levels, waves keep coming until the lawn is overrun.
Runs as a **native Android APK** (WebView shell, fully offline) and in any desktop browser.

## Play

* Install `pvz.apk` on the phone (Android 7.0+), rotate to landscape, tap **开始游戏**.
* Pick up to 8 seed packets, then tap a card and tap a lawn tile to plant. Tap falling suns to collect them.
* Waves grow bigger, faster and tougher forever; every 5th wave is a huge wave. Lawnmowers are one-shot saves.
* Score = kills + waves survived; the best score is stored locally.
* 31 plants unlock as waves progress — sun producers, shooters, walls, mines and bombs, plus
  窝瓜 (Squash), 卷心菜投手 / 西瓜投手 / 冰瓜投手 (lobbed splash pults), 回旋镖射手
  (piercing boomerang that hits on the way back) and 机枪射手 (Gatling Pea).
* 26 zombies, including 10 crossover guests: 迅猛龙 / 三角龙 / 甲龙 / 雷龙 / 霸王龙 /
  翼龙 / 恐龙蛋 (hatches raptors), plus the Kenney monsters 绿苦工 (creper with a fuse),
  大眼怪 (flying beholder) and 内鬼 (Among-Us style vaulting imposter).
  New zombie traits: `crush` (walks over plants), `prox` (creeps up and blows its own target
  up), `summon` / `throw` (spawns a smaller zombie), `armorHp`, `fly`, `vault`, `big`.

Controls: tap card → tap tile · shovel icon removes a plant · ⏸ pauses · space collects all suns (desktop).

## Seed packets (出战卡片)

You fight with **8 seed packets**, and you pick them yourself:

* Before a run the chooser opens. It only asks for as many packets as you have unlocked
  (4 at wave 1, 8 from wave 15 on) — tap cards to toggle, then **开始战斗**.
* Whenever a wave unlocks something new you get a toast; tap the **🌱** button (top right, next to ⏸)
  to open the chooser **mid-run**: the wave, lawn, sun and score are untouched, the current 8 packets
  come pre-selected, so you can swap a few and press **确认出战** (or **取消** to back out).
* Packets that stay in the load-out keep their cooldown, so swapping is not a cooldown-wipe exploit.
* Desktop shortcut: **S** opens/closes the chooser, **space** collects sun, **P** pauses.

## Layout

```
index.html          entry page (canvas + overlays)
css/style.css       UI chrome
js/config.js        balance data: plants, zombies, wave curve
js/assets.js        manifest loader + animation frames
js/audio.js         sfx / music
js/entities.js      Plant / Zombie / Projectile / Sun
js/game.js          waves, spawning, collisions, scoring
js/render.js        canvas drawing (lawn, HUD, entities, effects)
js/input.js         pointer/keyboard input
js/main.js          main loop, DOM wiring, harness hooks (PvZ.*)
assets/manifest.json  74 animation groups, 13 images, 26 sounds
assets/img/, assets/audio/   fetched art & audio (see tools/)
tools/fetch_assets.py        downloads + converts the original PvZ sprites/sounds
tools/montage.py             sprite-sheet packer used by fetch_assets
tools/add_crossover.py       bakes the CC0 crossover zombies (dinosaurs + Kenney parts)
test/sim.js                  headless simulation test suite (node test/sim.js)
```

## Asset credits

All **code is hand-written** for this project; only art and audio are third-party.

| source | licence | used for |
|---|---|---|
| PvZ sprite rips via `tools/fetch_assets.py` (cdn.jsdelivr.net, plantsvszombies.wiki.gg) | original EA/PopCap art, fair-use prototype | plants, classic zombies, lawn, sounds |
| [OpenGameArt – Dinosaurs](https://opengameart.org/content/dinosaurs) | CC0 | raptor, triceratops, ankylosaur, sauropod, T-rex, pterosaur, dino egg (+ corpses as death frames) |
| [Kenney Monster Builder Pack](https://kenney.nl/assets/monster-builder-pack) | CC0 | 绿苦工, 大眼怪, 内鬼 (assembled from body/eye/mouth/leg parts) |

`tools/add_crossover.py` re-bakes those sheets and registers them in
`assets/manifest.json`; every entry keeps its origin in the `src` field.

## Run in a browser

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Rebuild the APK

The whole build runs on the phone (skill `dev-apk-on-android`):

```sh
cd ~/apps/pvz && ./sync.sh     # copy game -> apk assets, build, install, launch
```

`~/apps/pvz` holds the Android shell: `AndroidManifest.xml`,
`src/com/example/pvz/MainActivity.java` (WebView + harness hooks) and
`src/com/example/pvz/AssetServer.java` (loopback HTTP server that serves the
`assets/game/` folder, so the game needs no external storage).

## Tests

```sh
node test/sim.js            # headless: waves, economy, kills, game over, new plants, crossover zombies
```

## Tuning

Everything lives in `js/config.js` (`G.WAVES`): wave budget growth, HP/speed caps,
break length, huge-wave interval. `G.EAT_DPS`, `G.START_SUN`, `G.SPEED` are next to it.

## Harness (drive the running app from a shell)

```sh
cd ~/apps/pvz && ./js.sh "PvZ.debug()"
./js.sh "PvZ.plant('peashooter',3,2); PvZ.zombie('gargantuar',0)"
```

`PvZ.noPause=true` stops the app from pausing when the Termux window takes focus.
