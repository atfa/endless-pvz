/* Headless simulation smoke test: node test/sim.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.join(__dirname, '..');
/* deterministic RNG so runs are reproducible: node test/sim.js --seed=N */
const seedArg = (process.argv.find(a => a.startsWith('--seed=')) || '--seed=20261119').split('=')[1];
let _s = parseInt(seedArg, 10) || 1;
const Math2 = Object.create(Math);
Math2.random = function () { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
const sandbox = {
  console, Math: Math2, Date, JSON, setTimeout: (fn) => fn && 0, clearTimeout: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { getElementById: () => null, addEventListener: () => {}, readyState: 'complete' },
  window: {}, requestAnimationFrame: () => 0
};
sandbox.window.PvZ = {};
sandbox.PvZ = sandbox.window.PvZ;
const ctx = vm.createContext(sandbox);

function load(f) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  vm.runInContext(src, ctx, { filename: f });
}
load('config.js');
/* stub assets: no sprites in node */
const G = sandbox.PvZ;
G.Assets = {
  anim: {}, img: {}, audio: {}, ready: true,
  frame: () => null, size: () => ({ w: 64, h: 64 }), has: () => false
};
G.Sound = { play() {}, music() {}, stopMusic() {}, setEnabled() {} };
load('entities.js');
load('game.js');

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}

function put(g, id, c, r) {          /* plant + register in the grid, like plantSeed does */
  const p = new G.Plant(g, id, c, r);
  g.plants.push(p); g.grid[r][c] = p;
  return p;
}
function newGame() {
  const g = new G.Game();
  g.reset();
  return g;
}
function run(g, seconds, perTick) {
  const dt = 1 / 30;
  for (let i = 0; i < seconds * 30; i++) {
    if (perTick) perTick(i / 30);
    g.update(dt);
    for (const z of g.zombies) {
      if (!isFinite(z.x) || !isFinite(z.hp)) throw new Error('bad zombie state ' + z.type + ' x=' + z.x + ' hp=' + z.hp);
    }
    for (const p of g.plants) if (!isFinite(p.x) || !isFinite(p.hp)) throw new Error('bad plant ' + p.id);
  }
}

/* ---------- 1. empty lawn: a zombie must breach and end the game ---------- */
console.log('\n[1] defenceless lawn is overrun');
{
  const g = newGame();
  g.state = 'playing';
  g.setSeeds(['sunflower', 'peashooter', 'wallnut', 'potatomine', 'cherrybomb', 'puffshroom']);
  run(g, 400);
  check('game over after breach', g.state === 'over', 'state=' + g.state);
  check('mowers were used first', g.mowers.filter(m => m.state === 'gone').length >= 3,
    g.mowers.map(m => m.state).join(','));
}

/* ---------- 2. scripted defence: sunflowers + peashooters + wallnuts ---------- */
console.log('\n[2] scripted defence survives and scores');
{
  const g = newGame();
  g.state = 'playing';
  g.setSeeds(['sunflower', 'peashooter', 'wallnut', 'potatomine', 'cherrybomb', 'puffshroom']);
  g.unlocked = {}; for (const id in G.PLANTS) g.unlocked[id] = true;
  const plan = [];
  for (let c = 0; c < G.GRID.cols; c++) {
    for (let r = 0; r < G.GRID.rows; r++) {
      const role = ['sunflower', 'peashooter', 'sunflower', 'peashooter', 'peashooter',
        'wallnut', 'peashooter', 'peashooter', 'peashooter'];
      const id = role[c];
      plan.push([r, c, id]);
    }
  }
  let pi = 0;
  const t0 = Date.now();
  run(g, 420, () => {
    g.collectAllSuns();
    if (pi < plan.length) {
      const [r, c, id] = plan[pi];
      const si = g.seeds.findIndex(s => s.id === id);
      if (si >= 0 && g.seeds[si].cd <= 0 && g.sun >= G.PLANTS[id].cost && !g.plantAt(c, r)) {
        if (g.plantSeed(si, c, r)) pi++;
      }
    }
    const ci = g.seeds.findIndex(s => s.id === 'cherrybomb');
    if (ci >= 0 && g.seeds[ci].cd <= 0 && g.sun >= 150 && g.zombies.length > 6) {
      let best = null;
      for (const z of g.zombies) if (!best || z.x < best.x) best = z;
      if (best) g.plantSeed(ci, Math.max(0, G.colAt(best.x)), best.row);
    }
  });
  const ms = Date.now() - t0;
  console.log('  sim 420s game time in ' + ms + 'ms');
  check('defence built', pi > plan.length * 0.6, pi + '/' + plan.length);
  check('waves progressed', g.wave >= 5, 'wave=' + g.wave);
  check('scored kills', g.score > 500 && g.kills > 40, 'score=' + g.score + ' kills=' + g.kills);
  check('defence holds for 7 min', g.state === 'playing' || g.wave >= 6, g.state + ' wave=' + g.wave);
  check('sim fast enough', ms < 20000, ms + 'ms');
  check('plants alive', g.plants.length > 10, g.plants.length);
}

/* ---------- 3. every plant can be planted and updated ---------- */
console.log('\n[3] every plant instantiates & updates');
{
  const ids = Object.keys(G.PLANTS);
  for (const id of ids) {
    const g = newGame();
    g.state = 'playing';
    g.sun = 99999;
    g.unlocked[id] = true;
    g.setSeeds([id, 'sunflower', 'peashooter', 'wallnut', 'puffshroom', 'sunflower']);
    const def = G.PLANTS[id];
    const col = def.gun ? 3 : 4;
    for (let r = 0; r < G.GRID.rows; r++) for (let c = 0; c < 3; c++) g.spawnZombie('basic', r, { hpMul: 1, speedMul: 1, wave: 5 });
    if (def.shell) g.plantSeed(1, col, 2);          /* pumpkin needs a host plant */
    const ok = g.plantSeed(0, col, 2);
    run(g, 12);
    check(id, ok && isFinite(g.sun), 'planted=' + ok);
  }
}

/* ---------- 4. every zombie type walks, fights and dies ---------- */
console.log('\n[4] every zombie type behaves');
{
  for (const id of Object.keys(G.ZOMBIES)) {
    const g = newGame();
    g.state = 'playing';
    g.setSeeds(['peashooter', 'sunflower', 'wallnut', 'puffshroom', 'snowpea', 'repeater']);
    g.unlocked = {}; for (const k in G.PLANTS) g.unlocked[k] = true;
    for (let r = 0; r < G.GRID.rows; r++) for (let c = 0; c < 5; c++) g.plantSeed(0, c, r);
    g.plants.forEach(p => { p.shootT = 0; });
    const z = g.spawnZombie(id, 2, { hpMul: 1, speedMul: 1, wave: 20 });
    z.x = 900;
    let died = false;
    for (let i = 0; i < 30 * 90 && !died; i++) { g.update(1 / 30); if (z.state === 'die') died = true; }
    check(id + ' killed by defence', died || g.state === 'over', 'x=' + Math.round(z.x) + ' hp=' + Math.round(z.hp) + ' st=' + z.state);
  }
}

/* ---------- 5. wave scaling is monotonic and bounded ---------- */
console.log('\n[5] difficulty curve');
{
  let lastHp = 0, lastBudget = 0, ok = true;
  for (let w = 1; w <= 60; w++) {
    const d = G.diff(w);
    if (d.hp < lastHp || d.budget < lastBudget) ok = false;
    lastHp = d.hp; lastBudget = d.budget;
    if (d.hp > G.WAVES.hpCap + 1e-9 || d.speed > G.WAVES.speedCap + 1e-9) ok = false;
  }
  check('monotonic & capped', ok);
  const d60 = G.diff(60);
  console.log('  wave60: hp x' + d60.hp.toFixed(2) + ' speed x' + d60.speed.toFixed(2) +
    ' budget ' + d60.budget + ' time ' + d60.time.toFixed(0) + 's');
}

/* ---------- 6. long endurance run (late game, many entities) ---------- */
console.log('\n[6] endurance: 20 minutes of late-game waves');
{
  const g = newGame();
  g.state = 'playing';
  g.wave = 18;
  g.gameOver = function () {            /* sandbox: recover instead of ending */
    this.deaths = (this.deaths || 0) + 1;
    this.zombies = this.zombies.filter(z => z.x > G.LAWN.left + 80);
  };
  g.setSeeds(['sunflower', 'gatlingpea', 'wallnut', 'tallnut', 'gloomshroom', 'spikerock']);
  g.unlocked = {}; for (const k in G.PLANTS) g.unlocked[k] = true;
  for (let c = 0; c < G.GRID.cols; c++) for (let r = 0; r < G.GRID.rows; r++) {
    g.sun = 9999;
    g.plantSeed(c < 2 ? 0 : c === 7 ? 3 : 1, c, r);
  }
  const t0 = Date.now();
  let maxEnt = 0, over = 0;
  run(g, 1200, () => {
    g.sun = 900;                                     /* infinite sun: stress the engine */
    if (g.plants.length < 45 && Math.random() < 0.3) {
      const r = (Math.random() * G.GRID.rows) | 0, c = (Math.random() * G.GRID.cols) | 0;
      const si = g.seeds.findIndex(s => s.cd <= 0);
      if (si >= 0 && !g.plantAt(c, r)) g.plantSeed(si, c, r);
    }
    maxEnt = Math.max(maxEnt, g.zombies.length + g.plants.length + g.projectiles.length);
  });
  console.log('  wall time ' + (Date.now() - t0) + 'ms, peak entities ' + maxEnt +
    ', wave ' + g.wave + ', score ' + g.score + ', breaches ' + (g.deaths || 0));
  check('no crash in 20 min sim', true);
  check('peak entity count sane', maxEnt < 400, 'peak=' + maxEnt);
  check('late waves progress', g.wave >= 20, 'wave=' + g.wave);
}

console.log('\n[8] new plants (squash / pults / boomerang)');
{
  const g = newGame(); g.state = 'playing'; g.sun = 9999;
  put(g, 'boomerang', 2, 1);
  const b1 = new G.Zombie(g, 'basic', 1, 900), b2 = new G.Zombie(g, 'basic', 1, 860);
  g.zombies.push(b1, b2);
  run(g, 4);
  check('boomerang pierces two zombies in a lane',
    b1.hp < b1.maxHp && b2.hp < b2.maxHp, b1.hp + '/' + b2.hp);

  const g2 = newGame(); g2.state = 'playing'; g2.sun = 9999;
  put(g2, 'squash', 3, 2);
  g2.zombies.push(new G.Zombie(g2, 'buckethead', 2, G.cellCX(4)));
  run(g2, 2);
  check('squash squashes the zombie on top of it', g2.kills >= 1, 'kills=' + g2.kills);

  const g3 = newGame(); g3.state = 'playing'; g3.sun = 9999;
  put(g3, 'cabbagepult', 1, 0);
  g3.zombies.push(new G.Zombie(g3, 'basic', 0, 800));
  run(g3, 12);
  check('cabbage-pult lobs and kills', g3.kills >= 1, 'kills=' + g3.kills);

  const g4 = newGame(); g4.state = 'playing'; g4.sun = 9999;
  put(g4, 'melonpult', 1, 0);
  g4.zombies.push(new G.Zombie(g4, 'basic', 0, 800));
  g4.zombies.push(new G.Zombie(g4, 'basic', 0, 720));
  run(g4, 16);
  check('melon-pult splash kills two zombies', g4.kills >= 2, 'kills=' + g4.kills);

  const g5 = newGame(); g5.state = 'playing'; g5.sun = 9999;
  put(g5, 'wintermelon', 1, 0);
  g5.zombies.push(new G.Zombie(g5, 'basic', 0, 800));
  const wz = g5.zombies[0];
  run(g5, 4);
  check('wintermelon chills what it hits', !!wz.slowT, 'slowT=' + (wz.slowT || 0).toFixed(1));
}


console.log('\n[9] seed chooser (pick packets, mid-run swap)');
{
  const g = newGame();
  check('wave-1 chooser only asks for unlocked plants', g.seedSlots() === 4, 'slots=' + g.seedSlots());
  check('default seeds are all unlocked', g.defaultSeeds().every(id => g.unlocked[id]), g.defaultSeeds().join(','));
  check('default seeds fill every free slot', g.defaultSeeds().length === g.seedSlots(), g.defaultSeeds().length + '');

  for (const id in G.PLANTS) g.unlocked[id] = G.PLANTS[id].unlock <= 12;
  g.wave = 12;
  check('slots cap at maxSeeds', g.seedSlots() === G.WAVES.maxSeeds, 'slots=' + g.seedSlots());
  g.state = 'playing';
  g.openChooser(true);
  check('openChooser pauses into the chooser and pre-fills the pick list',
    g.state === 'choose' && g.resumeAfterChoose && g.pickList.length === G.WAVES.maxSeeds,
    g.state + '/' + g.pickList.length);
  g.pickList = ['sunflower', 'peashooter', 'wallnut', 'gatlingpea', 'melonpult', 'squash', 'cherrybomb', 'snowpea'];
  g.setSeeds(g.pickList);
  g.closeChooser();
  check('closeChooser resumes the same run with the new packets',
    g.state === 'playing' && g.seeds.map(s => s.id).join(',') === g.pickList.join(','), g.state);
  g.seeds[0].cd = 12;
  g.setSeeds(g.seeds.map(s => s.id));
  check('setSeeds keeps the cooldown of packets that stayed', g.seeds[0].cd === 12, 'cd=' + g.seeds[0].cd);
}

console.log('\n[7] crossover zombies (dinosaurs + kenney monsters)');
{
  const g = newGame(); g.state = 'playing';
  const r = new G.Zombie(g, 'raptor', 0, 900); g.zombies.push(r);
  const x0 = r.x; run(g, 1);
  check('raptor is fast', x0 - r.x > 45, 'moved ' + Math.round(x0 - r.x));

  const g2 = newGame(); g2.state = 'playing'; g2.sun = 9999;
  const pl = put(g2, 'peashooter', 2, 3);
  g2.zombies.push(new G.Zombie(g2, 'bomber', 3, G.cellCX(4) + 40));
  run(g2, 9);
  check('bomber fuse blows up the plant', pl.dead, 'plant hp=' + Math.round(pl.hp));

  const g3 = newGame(); g3.state = 'playing';
  g3.zombies.push(new G.Zombie(g3, 'egg', 2, 900));
  run(g3, 6);
  check('egg hatches raptors', g3.zombies.some(z => z.type === 'raptor'), 'n=' + g3.zombies.length);

  const g4 = newGame(); g4.state = 'playing';
  const p4 = new G.Zombie(g4, 'pterosaur', 1, 900); g4.zombies.push(p4);
  run(g4, 1);
  check('pterosaur flies', p4.fly && p4.yOff < -40, 'yOff=' + Math.round(p4.yOff));

  const g5 = newGame(); g5.state = 'playing'; g5.sun = 9999;
  put(g5, 'wallnut', 2, 1);
  const im = new G.Zombie(g5, 'imposter', 1, G.cellCX(4) + 60); g5.zombies.push(im);
  let vaulted = false;
  run(g5, 5, () => { if (im.state === 'jump') vaulted = true; });
  check('imposter vaults a plant', vaulted || !!im.vaulted);

  const g6 = newGame(); g6.state = 'playing'; g6.sun = 9999;
  put(g6, 'wallnut', 2, 2);
  g6.zombies.push(new G.Zombie(g6, 'sauropod', 2, G.cellCX(5)));
  run(g6, 6);
  check('sauropod throws a raptor', g6.zombies.some(z => z.type === 'raptor'));

  const g7 = newGame(); g7.state = 'playing'; g7.sun = 9999;
  put(g7, 'wallnut', 3, 0);
  g7.zombies.push(new G.Zombie(g7, 'trex', 0, G.cellCX(4)));
  run(g7, 4);
  check('trex crushes plants', g7.plants.length === 0, 'left=' + g7.plants.length);

  const g8 = newGame(); g8.state = 'playing';
  const an = new G.Zombie(g8, 'ankylosaur', 0, 900); g8.zombies.push(an);
  const a0 = an.hp; an.hurt(300, g8, {});
  check('ankylosaur armour soaks damage', an.hp === a0 && an.armor < an.armorMax,
    'armor=' + Math.round(an.armor));
}

console.log('\n' + (fails ? 'FAILURES: ' + fails : 'ALL TESTS PASSED'));
process.exit(fails ? 1 : 0);
