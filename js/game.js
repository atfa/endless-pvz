/* Game: state, waves, spawning, collisions, scoring.  global: PvZ.Game */
(function (G) {
  'use strict';
  var GR = G.GRID, WV = G.WAVES;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (a) { return a[(Math.random() * a.length) | 0]; };

  function Game() {
    this.reset();                    /* every field must exist before the first draw */
    this.state = 'menu';           // menu | choose | playing | paused | over
    this.best = 0;
  }

  Game.prototype.reset = function () {
    this.plants = []; this.zombies = []; this.projectiles = [];
    this.suns = []; this.effects = []; this.texts = [];
    this.grid = [];
    for (var r = 0; r < GR.rows; r++) { this.grid[r] = []; for (var c = 0; c < GR.cols; c++) this.grid[r][c] = null; }
    this.mowers = [];
    for (var i = 0; i < GR.rows; i++) this.mowers.push({ row: i, x: G.MOWER_X, state: 'idle', y: G.laneBase(i) - 30 });
    this.sun = G.START_SUN;
    this.score = 0; this.kills = 0;
    this.wave = 1; this.waveT = 0; this.phase = 'break'; this.phaseT = 10;
    this.budget = 0; this.spawnT = 0; this.hugeDone = false;
    this.sunT = 4;
    this.time = 0;
    this.selected = -1; this.shovel = false;
    this.banner = null; this.shake = 0; this.flashIce = 0; this.flashFire = 0;
    this.overT = 0;
    this.unlocked = {};
    for (var id in G.PLANTS) this.unlocked[id] = G.PLANTS[id].unlock <= 1;
    this.seedIds = this.defaultSeeds();
    this.seeds = this.seedIds.map(function (id) { return { id: id, cd: 0 }; });
  };
  Game.prototype.defaultSeeds = function () {
    var av = this.availablePlants();
    var pref = ['sunflower', 'peashooter', 'wallnut', 'puffshroom', 'potatomine', 'cherrybomb'];
    var out = [];
    for (var i = 0; i < pref.length; i++)
      if (av.indexOf(pref[i]) >= 0) out.push(pref[i]);
    for (i = 0; i < av.length && out.length < WV.maxSeeds; i++)
      if (out.indexOf(av[i]) < 0) out.push(av[i]);
    return out.slice(0, WV.maxSeeds);
  };
  /* how many seed packets must be picked: never more than what is unlocked */
  Game.prototype.seedSlots = function () {
    return Math.max(1, Math.min(WV.maxSeeds, this.availablePlants().length));
  };
  Game.prototype.availablePlants = function () {
    var out = [];
    for (var id in G.PLANTS) if (this.unlocked[id]) out.push(id);
    out.sort(function (a, b) { return G.PLANTS[a].unlock - G.PLANTS[b].unlock || G.PLANTS[a].cost - G.PLANTS[b].cost; });
    return out;
  };
  Game.prototype.setSeeds = function (ids) {
    var old = {};
    for (var i = 0; i < this.seeds.length; i++) old[this.seeds[i].id] = this.seeds[i].cd;
    this.seedIds = ids.slice(0, WV.maxSeeds);
    this.seeds = this.seedIds.map(function (id) { return { id: id, cd: old[id] || 0 }; });
  };

  /* open the seed chooser, also mid-run: keeps wave, score and lawn untouched */
  Game.prototype.openChooser = function (resume) {
    if (this.state !== 'playing' && this.state !== 'choose') return false;
    this.resumeAfterChoose = !!resume;
    var cur = [];
    for (var i = 0; i < this.seeds.length; i++) cur.push(this.seeds[i].id);
    var av = this.availablePlants();
    for (i = 0; i < av.length && cur.length < this.seedSlots(); i++)
      if (cur.indexOf(av[i]) < 0) cur.push(av[i]);
    this.pickList = cur.slice(0, this.seedSlots());
    this.pickList = cur;
    this.state = 'choose';
    G.Sound.stopMusic();
    return true;
  };
  Game.prototype.closeChooser = function () {
    this.resumeAfterChoose = false;
    this.state = 'playing';
  };

  /* ---------------- helpers ---------------- */
  Game.prototype.plantAt = function (c, r) {
    if (c < 0 || c >= GR.cols || r < 0 || r >= GR.rows) return null;
    return this.grid[r][c];
  };
  Game.prototype.torchAt = function (c, r) {
    var p = this.plantAt(c, r);
    return p && p.def.torch ? p : null;
  };
  Game.prototype.animFor = function (z, kind) {
    if (G.Assets.has(z.art, kind)) return kind;
    if (G.Assets.has(z.art, 'die')) return 'die';
    if (G.Assets.has(z.art, 'losthead')) return 'losthead';
    return 'walk';
  };
  Game.prototype.sound = function (n, v, t) { G.Sound.play(n, v, t); };
  Game.prototype.fx = function (kind, x, y, art, anim, opt) {
    this.effects.push(new G.Effect(kind, x, y, art, anim, opt));
  };
  Game.prototype.toast = function (text, ttl) {
    this.texts.push({ text: text, t: 0, ttl: ttl || 2.6, big: false });
  };
  Game.prototype.bannerMsg = function (text, art, ttl) {
    this.banner = { text: text, art: art, t: 0, ttl: ttl || 3.2 };
  };

  /* ---------------- planting ---------------- */
  Game.prototype.canPlant = function (id, c, r) {
    var d = G.PLANTS[id];
    if (!d) return 'bad';
    var p = this.plantAt(c, r);
    if (d.shell) return p && !p.def.shell ? 'ok' : 'blocked';
    if (d.bomb || d.laneburn || d.freeze) return !p ? 'ok' : 'blocked';
    return !p ? 'ok' : 'blocked';
  };
  Game.prototype.plantSeed = function (seedIndex, c, r) {
    var s = this.seeds[seedIndex];
    if (!s) return false;
    var d = G.PLANTS[s.id];
    if (s.cd > 0 || this.sun < d.cost) return false;
    var ok = this.canPlant(s.id, c, r);
    if (ok === 'blocked') return false;
    if (ok === 'bad') return false;
    var old = this.plantAt(c, r);
    if (d.shell && old) {                    /* pumpkin: armour the plant below */
      old.maxHp += d.hp; old.hp += d.hp; old.hasPumpkin = true;
      s.cd = d.cd; this.sun -= d.cost;
      this.sound('plant', 0.5); this.fx('pop', old.x, old.y - 30, 'plant.pumpkin', 'idle', { ttl: 0.5 });
      return true;
    }
    var p = new G.Plant(this, s.id, c, r);
    this.grid[r][c] = p; this.plants.push(p);
    this.sun -= d.cost; s.cd = d.cd;
    this.sound('plant', 0.5);
    return true;
  };
  Game.prototype.shovelAt = function (c, r) {
    var p = this.plantAt(c, r);
    if (!p) return false;
    p.dead = true;
    this.onPlantLost(p);
    this.sound('click', 0.5);
    return true;
  };
  Game.prototype.onPlantLost = function (p) {
    if (this.grid[p.row] && this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
    p.dead = true;
    this.fx('pop', p.x, p.y - 20, 'fx.crater', 'idle', { ttl: 0.4, scale: 0.6 });
  };

  /* ---------------- combat helpers ---------------- */
  Game.prototype.spawnProjectile = function (o) { this.projectiles.push(new G.Projectile(this, o)); };
  Game.prototype.spawnSun = function (x, y, ty, value) {
    this.suns.push(new G.Sun(this, x, y, ty, value));
  };
  Game.prototype.explode = function (x, y, bomb, src) {
    var r = (bomb.r || 1) * GR.cw;
    var row = src && src.row != null ? src.row : G.rowAt(y);
    this.fx('boom', x, y - 30, 'plant.cherrybomb', 'boom', { ttl: 1.1 });
    this.sound('explosion', 0.7, 60);
    this.shake = 0.35;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead || z.state === 'die') continue;
      var dx = Math.abs(z.x - x), dy = Math.abs(G.laneY(z.row) - G.laneY(row));
      if (dx <= r && dy <= r) z.hurt(bomb.dmg, this, { pierce: true });
    }
    if (bomb.plants) {                       /* creeper-like blasts take plants out */
      for (var pi = this.plants.length - 1; pi >= 0; pi--) {
        var pp = this.plants[pi];
        if (pp.dead) continue;
        if (Math.abs(pp.x - x) <= r && Math.abs(G.laneY(pp.row) - G.laneY(row)) <= r) pp.hurt(bomb.dmg, this);
      }
    }
    if (bomb.crater) {
      for (var rr = row - 1; rr <= row + 1; rr++) {
        for (var cc = G.colAt(x) - 1; cc <= G.colAt(x) + 1; cc++) {
          var p = this.plantAt(cc, rr);
          if (p) { p.dead = true; this.onPlantLost(p); }
        }
      }
    }
  };
  Game.prototype.laneBurn = function (row, o) {
    this.fx('fire', G.LAWN.left + 100, G.laneY(row), 'plant.jalapeno', 'boom', { ttl: 1.4, scale: 1 });
    this.sound('jalapeno', 0.7, 60);
    this.flashFire = 0.35;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead || z.row !== row || z.state === 'die') continue;
      z.hurt(o.dmg, this, { pierce: true });
    }
  };
  Game.prototype.freezeLawn = function (o) {
    this.sound('frozen', 0.7, 60);
    this.flashIce = 0.6;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead || z.state === 'die') continue;
      z.freezeT = o.time;
      z.hurt(o.dmg, this, { pierce: true });
    }
    this.fx('ice', G.W / 2, G.H / 2, 'plant.iceshroom', 'boom', { ttl: 1.2, alpha: 0.55, scale: 8 });
  };
  Game.prototype.crushPlant = function (p, z) {
    if (p.def.spike && p.id === 'spikeweed') { p.dead = true; this.onPlantLost(p); return; }
    p.hurt(9999, this);
    this.fx('pop', p.x, p.y - 20, 'fx.crater', 'idle', { ttl: 0.5 });
  };
  Game.prototype.throwImp = function (z) {
    var imp = new G.Zombie(this, z.def.throw || 'imp', z.row, z.x - 60, { hpMul: z.hpMul, speedMul: z.speedMul, wave: this.wave });
    imp.state = 'walk';
    this.zombies.push(imp);
    this.fx('pop', z.x - 40, z.y - 120, 'zombie.imp', 'walk', { ttl: 0.6 });
  };
  Game.prototype.danceSummon = function (z) {
    this.sound('hugewave', 0.4, 500);
    for (var i = 0; i < (z.def.summonCount || 4); i++) {
      var b = new G.Zombie(this, z.def.summon, z.row, z.x + 40 + i * 34,
        { hpMul: z.hpMul, speedMul: z.speedMul, wave: this.wave });
      this.zombies.push(b);
    }
    z.anim = 'summon'; z.at = 0;
  };
  Game.prototype.onZombieKilled = function (z) {
    this.kills++;
    this.score += z.score;
    this.fx('pop', z.x, z.y - 110, '', '', { ttl: 0.9 });
    this.texts.push({ x: z.x, y: G.laneY(z.row) - 40, text: '+' + z.score, t: 0, ttl: 1, color: '#ffe066' });
    this.sound(pick(['groan3', 'groan4', 'groan5', 'groan6']), 0.35, 120);
  };
  Game.prototype.onBreach = function (z) {
    if (this.state !== 'playing') return;
    z.x = G.HOUSE_X;
    if (z.state !== 'die') { this.gameOver(); }
  };

  /* ---------------- zombies & waves ---------------- */
  Game.prototype.spawnZombie = function (type, row, opts) {
    var z = new G.Zombie(this, type, row === undefined ? (Math.random() * GR.rows) | 0 : row,
      G.SPAWN_X + rnd(0, 60), opts);
    this.zombies.push(z);
    return z;
  };
  Game.prototype.pickZombieType = function (budget) {
    var pool = [], tot = 0, w = this.wave;
    for (var id in G.ZOMBIES) {
      var d = G.ZOMBIES[id];
      if (d.unlock > w || !d.weight) continue;
      var cost = d.score;
      if (cost > budget) continue;
      pool.push([id, d.weight]); tot += d.weight;
    }
    if (!pool.length) return null;
    var r = Math.random() * tot;
    for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  };
  Game.prototype.startWave = function () {
    var d = G.diff(this.wave);
    this.budget = d.budget;
    this.waveTime = d.time;
    this.waveT = 0;
    this.phase = 'wave';
    this.hugeDone = false;
    this.spawnT = 0.5;
    var huge = this.wave % WV.hugeEvery === 0;
    this.bannerMsg(huge ? '一大波僵尸正在接近！' : '第 ' + this.wave + ' 波',
      huge ? 'fx.huge' : null, huge ? 3.4 : 2.2);
    this.sound(huge ? 'hugewave' : 'siren', 0.6, 300);
  };
  Game.prototype.endWave = function () {
    this.phase = 'break';
    this.phaseT = WV.breakTime;
    this.wave++;
    var newOnes = [], w = this.wave;
    for (var id in G.PLANTS) {
      if (!this.unlocked[id] && G.PLANTS[id].unlock <= w) {
        this.unlocked[id] = true; newOnes.push(G.plantName(id));
      }
    }
    this.bannerMsg('第 ' + (this.wave - 1) + ' 波清除！', null, 2);
    this.sun += 25;
    if (newOnes.length) {
      this.toast('新植物解锁：' + newOnes.join('、') + '（点 🌱 换卡）', 5);
      this.sound('points', 0.6);
    }
    this.sound('win', 0.5, 500);
  };
  Game.prototype.updateWaves = function (dt) {
    var d = G.diff(this.wave);
    if (this.phase === 'break') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startWave();
      return;
    }
    this.waveT += dt;
    var huge = this.wave % WV.hugeEvery === 0;
    /* steady spawning while budget remains */
    if (this.budget > 0) {
      this.spawnT -= dt;
      var interval = Math.max(0.55, Math.min(3.6, this.waveTime / Math.max(4, this.budget / 95)));
      if (this.spawnT <= 0) {
        var t = this.pickZombieType(this.budget);
        if (!t && this.budget < 20) this.budget = 0;      /* nothing affordable left: wave is spent */
        if (t) {
          var cost = G.ZOMBIES[t].score;
          this.spawnZombie(t, undefined, { hpMul: d.hp, speedMul: d.speed, wave: this.wave });
          this.budget -= cost;
          if (Math.random() < 0.25 && this.wave > 3) {
            var t2 = this.pickZombieType(this.budget);
            if (t2) { this.spawnZombie(t2, undefined, { hpMul: d.hp, speedMul: d.speed, wave: this.wave }); this.budget -= G.ZOMBIES[t2].score; }
          }
        }
        this.spawnT = interval * rnd(0.7, 1.3);
      }
    } else if (huge && !this.hugeDone) {
      this.hugeDone = true;
      var n = 6 + Math.min(14, this.wave);
      for (var i = 0; i < n; i++) {
        var type = Math.random() < 0.25 ? 'flag' : this.pickZombieType(9999) || 'basic';
        var z = this.spawnZombie(type, (Math.random() * GR.rows) | 0, { hpMul: d.hp, speedMul: d.speed, wave: this.wave });
        z.x = G.SPAWN_X + i * 46;
      }
      this.bannerMsg('一大波僵尸正在接近！', 'fx.huge', 3);
      this.sound('finalwave', 0.7, 200);
    }
    var alive = 0;
    for (var j = 0; j < this.zombies.length; j++) if (!this.zombies[j].dead) alive++;
    var stalled = this.waveT > this.waveTime + 90 && this.budget <= 0;
    if ((this.budget <= 0 && (!huge || this.hugeDone) && alive === 0) || stalled) this.endWave();
  };

  /* ---------------- mowers ---------------- */
  Game.prototype.updateMowers = function (dt) {
    for (var i = 0; i < this.mowers.length; i++) {
      var m = this.mowers[i];
      if (m.state === 'gone') continue;
      if (m.state === 'idle') {
        for (var j = 0; j < this.zombies.length; j++) {
          var z = this.zombies[j];
          if (z.dead || z.row !== m.row || z.state === 'die' || z.fly) continue;
          if (z.x <= G.MOWER_X + 30) {
            m.state = 'run'; this.sound('mower', 0.7, 200); this.shake = 0.2; break;
          }
        }
      } else {
        m.x += 430 * dt;
        for (var k = 0; k < this.zombies.length; k++) {
          var zz = this.zombies[k];
          if (zz.dead || zz.row !== m.row || zz.state === 'die') continue;
          if (Math.abs(zz.x - m.x) < 46) {
            if (zz.big) { zz.hurt(1500 * dt * 4, this, { pierce: true }); }
            else { zz.hurt(99999, this, { pierce: true }); }
          }
        }
        if (m.x > G.W + 80) m.state = 'gone';
      }
    }
  };

  /* ---------------- main update ---------------- */
  Game.prototype.update = function (dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    var i;
    for (i = 0; i < this.seeds.length; i++) if (this.seeds[i].cd > 0) this.seeds[i].cd -= dt;
    this.updateWaves(dt);

    for (i = 0; i < this.plants.length; i++) this.plants[i].update(dt, this);
    this.plants = this.plants.filter(function (p) {
      if (p.dead && this.grid[p.row] && this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
      return !p.dead;
    }, this);

    for (i = 0; i < this.zombies.length; i++) this.zombies[i].update(dt, this);
    this.zombies = this.zombies.filter(function (z) { return !z.dead; });

    for (i = 0; i < this.projectiles.length; i++) this.projectiles[i].update(dt, this);
    this.projectiles = this.projectiles.filter(function (p) { return !p.dead; });

    /* garlic shuffles zombies into neighbouring lanes */
    for (i = 0; i < this.plants.length; i++) {
      var p = this.plants[i];
      if (!p.def.garlic) continue;
      for (var j = 0; j < this.zombies.length; j++) {
        var z = this.zombies[j];
        if (z.dead || z.row !== p.row || z.eating !== p) continue;
        if (Math.random() < dt * 0.7) {
          var dir = Math.random() < 0.5 ? -1 : 1;
          var nr = z.row + dir;
          if (nr >= 0 && nr < GR.rows) { z.row = nr; z.y = G.laneBase(nr); z.eating = null; z.at = 0; }
        }
      }
    }

    this.updateMowers(dt);

    /* sky sun */
    var d = G.diff(this.wave);
    this.sunT -= dt;
    if (this.sunT <= 0) {
      this.sunT = d.sunEvery * rnd(0.8, 1.25);
      var x = rnd(G.LAWN.left + 30, G.LAWN.right - 20);
      this.spawnSun(x, -30, rnd(G.LAWN.top + 120, G.LAWN.bottom - 30), G.SUN_VALUE);
    }
    for (i = 0; i < this.suns.length; i++) this.suns[i].update(dt);
    this.suns = this.suns.filter(function (s) { return !s.dead; });

    for (i = 0; i < this.effects.length; i++) this.effects[i].update(dt);
    this.effects = this.effects.filter(function (e) { return !e.dead; });

    for (i = 0; i < this.texts.length; i++) this.texts[i].t += dt;
    this.texts = this.texts.filter(function (t) { return t.t < t.ttl; });
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.ttl) this.banner = null; }
    if (this.shake > 0) this.shake -= dt;
    if (this.flashIce > 0) this.flashIce -= dt;
    if (this.flashFire > 0) this.flashFire -= dt;
  };

  Game.prototype.collectSunAt = function (x, y) {
    for (var i = this.suns.length - 1; i >= 0; i--) {
      var s = this.suns[i];
      if (s.collect) continue;
      if (Math.abs(s.x - x) < 46 && Math.abs(s.y - y) < 46) {
        s.collect = 0.01;
        this.sun += s.value;
        this.score += 1;
        this.sound('coin', 0.5, 40);
        return true;
      }
    }
    return false;
  };
  Game.prototype.collectAllSuns = function () {
    for (var i = 0; i < this.suns.length; i++) if (!this.suns[i].collect) { this.suns[i].collect = 0.01; this.sun += this.suns[i].value; }
  };

  Game.prototype.gameOver = function () {
    if (this.state === 'over') return;
    this.state = 'over';
    this.overT = 0;
    this.sound('lose', 0.6);
    this.fx('hand', G.HOUSE_X + 60, G.laneY(2), 'fx.zombiehand', 'idle', { ttl: 6, loop: true });
    G.Sound.stopMusic();
    if (this.score > this.best) { this.best = this.score; try { localStorage.setItem('pvz.best', String(this.best)); } catch (e) {} }
  };
  Game.prototype.animFrame = function (art, anim, t) { return G.Assets.frame(art, anim, t); };

  G.Game = Game;
})(window.PvZ = window.PvZ || {});
