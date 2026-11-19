/* Endless PvZ - configuration & balance data.  global: PvZ */
window.PvZ = window.PvZ || {};
(function (G) {
  'use strict';

  /* ---------- lawn geometry (canvas is 1400x600, background fills it) ---------- */
  G.W = 1400; G.H = 600;
  /* measured off the lawn artwork: grass spans x 250..988, y 84..572 */
  G.GRID = { x0: 250, y0: 84, cw: 82, ch: 97.6, cols: 9, rows: 5 };
  G.LAWN = { left: 250, right: 988, top: 84, bottom: 572 };
  G.HOUSE_X = 208;      // zombie past this line = game over
  G.MOWER_X = 226;      // lawnmower parking spot
  G.SPAWN_X = 1450;
  G.SPEED = 23;         // px/s for a zombie with speed 1.0
  G.EAT_DPS = 45;       // zombie eating damage per second
  G.SUN_FROM_SKY = 25;

  /* ---------- plants ----------
   * cost   sun price           cd      seed packet cooldown (s)
   * hp     plant health        dps     spike damage per second
   * gun    {dmg,rate,range,bullet,shots,gap,pierce,slow,slowTime,multilane,back,area,air}
   * sun    {amount,interval,first}
   * bomb   {dmg,r,crater}      laneburn {dmg}      freeze {dmg,time}
   * mine   {arm,dmg}           chomp  {dmg,digest}
   * unlock wave at which the plant becomes available
   */
  G.PLANTS = {
    puffshroom: { name: '小喷菇', en: 'Puff-shroom', cost: 0, hp: 300, cd: 5, unlock: 1,
      gun: { dmg: 20, rate: 1.7, range: 3.2, bullet: 'puff' } },
    sunflower: { name: '向日葵', en: 'Sunflower', cost: 50, hp: 300, cd: 5, unlock: 1,
      sun: { amount: 25, interval: 10, first: 6 } },
    peashooter: { name: '豌豆射手', en: 'Peashooter', cost: 100, hp: 300, cd: 5, unlock: 1,
      gun: { dmg: 20, rate: 1.4, bullet: 'pea' } },
    wallnut: { name: '坚果墙', en: 'Wall-nut', cost: 50, hp: 4000, cd: 20, unlock: 1, armor: true },
    potatomine: { name: '土豆雷', en: 'Potato Mine', cost: 25, hp: 300, cd: 20, unlock: 2,
      mine: { arm: 14, dmg: 1800 } },
    cherrybomb: { name: '樱桃炸弹', en: 'Cherry Bomb', cost: 150, hp: 900, cd: 25, unlock: 2,
      bomb: { dmg: 1800, r: 1.15 } },
    snowpea: { name: '寒冰射手', en: 'Snow Pea', cost: 175, hp: 300, cd: 5, unlock: 3,
      gun: { dmg: 20, rate: 1.4, bullet: 'snow', slow: 0.5, slowTime: 5 } },
    chomper: { name: '大嘴花', en: 'Chomper', cost: 150, hp: 300, cd: 6, unlock: 4,
      chomp: { dmg: 3000, digest: 30 } },
    jalapeno: { name: '火爆辣椒', en: 'Jalapeno', cost: 125, hp: 900, cd: 25, unlock: 5,
      laneburn: { dmg: 1800 } },
    fumeshroom: { name: '大喷菇', en: 'Fume-shroom', cost: 75, hp: 300, cd: 5, unlock: 6,
      gun: { dmg: 20, rate: 1.4, range: 4.5, pierce: true, bullet: 'fume' } },
    iceshroom: { name: '寒冰菇', en: 'Ice-shroom', cost: 75, hp: 900, cd: 30, unlock: 7,
      freeze: { dmg: 100, time: 6 } },
    starfruit: { name: '杨桃', en: 'Starfruit', cost: 125, hp: 300, cd: 5, unlock: 8,
      gun: { dmg: 20, rate: 1.6, bullet: 'star', multilane: true, air: true } },
    repeater: { name: '双发射手', en: 'Repeater', cost: 200, hp: 300, cd: 5, unlock: 9,
      gun: { dmg: 20, rate: 1.4, shots: 2, gap: 0.16, bullet: 'pea' } },
    spikeweed: { name: '地刺', en: 'Spikeweed', cost: 100, hp: 300, cd: 20, unlock: 10,
      spike: { dps: 20 }, noeat: true },
    garlic: { name: '大蒜', en: 'Garlic', cost: 50, hp: 1200, cd: 15, unlock: 11, garlic: true, armor: true },
    torchwood: { name: '火炬树桩', en: 'Torchwood', cost: 175, hp: 900, cd: 20, unlock: 12, torch: true },
    tallnut: { name: '高坚果', en: 'Tall-nut', cost: 125, hp: 8000, cd: 30, unlock: 13, armor: true },
    cactus: { name: '仙人掌', en: 'Cactus', cost: 125, hp: 300, cd: 5, unlock: 8,
      gun: { dmg: 20, rate: 1.5, bullet: 'pea', air: true } },
    twinflower: { name: '双胞向日葵', en: 'Twin Sunflower', cost: 150, hp: 300, cd: 15, unlock: 14,
      sun: { amount: 50, interval: 10, first: 6 } },
    pumpkin: { name: '南瓜头', en: 'Pumpkin', cost: 125, hp: 4000, cd: 20, unlock: 15, armor: true, shell: true },
    gloomshroom: { name: '忧郁菇', en: 'Gloom-shroom', cost: 150, hp: 300, cd: 12, unlock: 16,
      gun: { dmg: 20, rate: 2, range: 1.4, pierce: true, area: 1, bullet: 'fume' } },
    splitpea: { name: '裂荚射手', en: 'Split Pea', cost: 150, hp: 300, cd: 5, unlock: 17,
      gun: { dmg: 20, rate: 1.6, bullet: 'pea', back: true } },
    threepeater: { name: '三线射手', en: 'Threepeater', cost: 325, hp: 300, cd: 5, unlock: 18,
      gun: { dmg: 20, rate: 1.6, bullet: 'pea', multilane: true } },
    gatlingpea: { name: '机枪射手', en: 'Gatling Pea', cost: 250, hp: 300, cd: 5, unlock: 19,
      gun: { dmg: 20, rate: 1.3, shots: 4, gap: 0.12, bullet: 'pea' } },
    spikerock: { name: '地刺王', en: 'Spikerock', cost: 250, hp: 1200, cd: 25, unlock: 20,
      spike: { dps: 45 }, noeat: true },
    doomshroom: { name: '末日菇', en: 'Doom-shroom', cost: 125, hp: 900, cd: 40, unlock: 22,
      bomb: { dmg: 3000, r: 1.6, crater: true } },
    squash: { name: '窝瓜', en: 'Squash', cost: 50, hp: 300, cd: 26, unlock: 5,
      crush: { dmg: 1800, r: 1.25 } },
    cabbagepult: { name: '卷心菜投手', en: 'Cabbage-pult', cost: 100, hp: 300, cd: 5, unlock: 7,
      gun: { dmg: 40, rate: 1.5, bullet: 'cabbage', lob: 62, splash: 42 } },
    boomerang: { name: '回旋镖射手', en: 'Bloomerang', cost: 125, hp: 300, cd: 5, unlock: 11,
      gun: { dmg: 40, rate: 1.6, bullet: 'boomerang', pierce: true, pierceN: 3, ret: true } },
    melonpult: { name: '西瓜投手', en: 'Melon-pult', cost: 300, hp: 300, cd: 5, unlock: 15,
      gun: { dmg: 80, rate: 2.6, bullet: 'melon', lob: 90, splash: 78, area: 1 } },
    wintermelon: { name: '冰瓜投手', en: 'Winter Melon', cost: 500, hp: 300, cd: 5, unlock: 24,
      gun: { dmg: 80, rate: 2.6, bullet: 'wmelon', lob: 90, splash: 78, area: 1,
        slow: 0.5, slowTime: 6 } }
  };
  /* art key == "plant." + id */

  /* ---------- zombies ----------
   * hp base health, armorHp front plate (cone/bucket/shield), speed multiplier,
   * dps eating, score points, crush runs over plants, fly over plants,
   * vault jumps the first plant, paper enrages when destroyed,
   * explode on death, summon calls friends, throw throws an imp.
   */
  G.ZOMBIES = {
    basic: { name: '僵尸', art: 'zombie.basic', hp: 200, speed: 1, score: 10, unlock: 1, weight: 100 },
    flag: { name: '旗帜僵尸', art: 'zombie.flag', hp: 200, speed: 1.4, score: 14, unlock: 1, weight: 0, flag: true },
    conehead: { name: '路障僵尸', art: 'zombie.conehead', hp: 200, armorHp: 380, speed: 1, score: 25, unlock: 2, weight: 55 },
    polevault: { name: '撑杆僵尸', art: 'zombie.polevault', hp: 200, speed: 1.35, score: 30, unlock: 3, weight: 30, vault: true },
    newspaper: { name: '报纸僵尸', art: 'zombie.newspaper', hp: 200, armorHp: 150, speed: 0.95, score: 35, unlock: 4, weight: 26, paper: true },
    football: { name: '橄榄球僵尸', art: 'zombie.football', hp: 200, armorHp: 560, speed: 1.85, score: 50, unlock: 5, weight: 26 },
    screendoor: { name: '铁门僵尸', art: 'zombie.screendoor', hp: 200, armorHp: 560, speed: 1, score: 45, unlock: 6, weight: 24, front: true },
    buckethead: { name: '铁桶僵尸', art: 'zombie.buckethead', hp: 200, armorHp: 1100, speed: 1, score: 65, unlock: 7, weight: 22 },
    jackbox: { name: '小丑僵尸', art: 'zombie.jackbox', hp: 200, speed: 1.05, score: 55, unlock: 8, weight: 20,
      explode: { dmg: 1800, r: 1.2 } },
    balloon: { name: '气球僵尸', art: 'zombie.balloon', hp: 200, speed: 1.3, score: 60, unlock: 9, weight: 18, fly: true },
    dancing: { name: '舞王僵尸', art: 'zombie.dancing', hp: 200, speed: 1.05, score: 70, unlock: 10, weight: 14,
      summon: 'backup', summonCount: 4 },
    backup: { name: '伴舞僵尸', art: 'zombie.backup', hp: 200, speed: 1.05, score: 15, unlock: 10, weight: 0 },
    zomboni: { name: '冰车僵尸', art: 'zombie.zomboni', hp: 200, armorHp: 1100, speed: 1.5, score: 120, unlock: 12,
      weight: 12, crush: true, big: true },
    mustache: { name: '胡渣僵尸', art: 'zombie.mustache', hp: 900, speed: 1.45, score: 130, unlock: 14, weight: 12 },
    gargantuar: { name: '巨人僵尸', art: 'zombie.gargantuar', hp: 3000, speed: 0.62, score: 300, unlock: 16,
      weight: 8, crush: true, big: true, throw: 'imp', smash: 1800 },
    imp: { name: '小鬼僵尸', art: 'zombie.imp', hp: 200, speed: 1.25, score: 20, unlock: 16, weight: 0 },

    /* ---- crossover guests: CC0 dinosaur pack + Kenney monster builder ---- */
    raptor: { name: '迅猛龙', art: 'zombie.raptor', hp: 150, speed: 2.3, score: 28, unlock: 6, weight: 42 },
    bomber: { name: '绿苦工', art: 'zombie.bomber', hp: 260, speed: 1.15, score: 40, unlock: 7, weight: 26,
      explode: { dmg: 900, r: 1.1, plants: true }, prox: 1.6 },
    egg: { name: '恐龙蛋', art: 'zombie.egg', hp: 340, speed: 0.55, score: 30, unlock: 8, weight: 16,
      summon: 'raptor', summonCount: 2 },
    triceratops: { name: '三角龙', art: 'zombie.triceratops', hp: 300, armorHp: 260, speed: 1.25, score: 45,
      unlock: 9, weight: 26, crush: true, smash: 900 },
    pterosaur: { name: '翼龙', art: 'zombie.pterosaur', hp: 220, speed: 1.35, score: 38, unlock: 10, weight: 22,
      fly: true },
    imposter: { name: '内鬼', art: 'zombie.imposter', hp: 220, speed: 1.7, score: 35, unlock: 11, weight: 26,
      vault: true },
    ankylosaur: { name: '甲龙', art: 'zombie.ankylosaur', hp: 320, armorHp: 900, speed: 0.62, score: 60,
      unlock: 12, weight: 20 },
    beholder: { name: '大眼怪', art: 'zombie.beholder', hp: 300, speed: 1.0, score: 50, unlock: 14, weight: 16,
      fly: true },
    sauropod: { name: '雷龙', art: 'zombie.sauropod', hp: 1500, speed: 0.45, score: 120, unlock: 16, weight: 12,
      big: true, throw: 'raptor' },
    trex: { name: '霸王龙', art: 'zombie.trex', hp: 2600, speed: 0.6, score: 220, unlock: 20, weight: 9,
      big: true, crush: true, smash: 1800 }
  };

  /* ---------- endless wave tuning ---------- */
  G.WAVES = {
    baseTime: 42,          // seconds of a wave (wave 1)
    minTime: 26,
    baseBudget: 70,        // zombie points spent per wave
    budgetGrowth: 1.18,    // per wave
    budgetCap: 5200,
    hpGrowth: 0.075,       // +7.5% zombie hp per wave
    hpCap: 9,
    speedGrowth: 0.012,
    speedCap: 1.7,
    breakTime: 11,
    hugeEvery: 5,
    sunInterval: [8, 6],   // start / min seconds between sky suns
    maxSeeds: 8
  };
  G.SUN_VALUE = 25;
  G.START_SUN = 100;
  G.LAWN_MOWERS = true;

  G.plantArt = function (id) { return 'plant.' + id; };
  G.plantName = function (id) { return (G.PLANTS[id] || {}).name || id; };

  /* difficulty multipliers for a wave (1-based) */
  G.diff = function (wave) {
    var w = Math.max(1, wave) - 1;
    return {
      hp: Math.min(G.WAVES.hpCap, 1 + G.WAVES.hpGrowth * w),
      speed: Math.min(G.WAVES.speedCap, 1 + G.WAVES.speedGrowth * w),
      budget: Math.min(G.WAVES.budgetCap,
        Math.round(G.WAVES.baseBudget * Math.pow(G.WAVES.budgetGrowth, w))),
      time: Math.max(G.WAVES.minTime, G.WAVES.baseTime - Math.min(14, w * 0.6)),
      sunEvery: Math.max(G.WAVES.sunInterval[1], G.WAVES.sunInterval[0] - w * 0.18)
    };
  };
})(window.PvZ);
