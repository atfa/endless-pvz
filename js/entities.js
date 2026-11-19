/* Entities: plants, zombies, projectiles, suns, effects.  Pure logic, no DOM. */
(function (G) {
  'use strict';
  var GR = G.GRID;

  G.cellLeft = function (c) { return GR.x0 + c * GR.cw; };
  G.cellCX = function (c) { return GR.x0 + (c + 0.5) * GR.cw; };
  G.cellTop = function (r) { return GR.y0 + r * GR.ch; };
  G.laneY = function (r) { return GR.y0 + (r + 0.5) * GR.ch; };
  G.laneBase = function (r) { return GR.y0 + (r + 1) * GR.ch; };
  G.colAt = function (x) { return Math.floor((x - GR.x0) / GR.cw); };
  G.rowAt = function (y) { return Math.floor((y - GR.y0) / GR.ch); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ================================ PLANT ================================ */
  function Plant(game, id, col, row) {
    var d = G.PLANTS[id];
    this.id = id; this.def = d; this.col = col; this.row = row;
    this.x = G.cellCX(col); this.y = G.laneBase(row);
    this.maxHp = d.hp; this.hp = d.hp;
    this.art = G.plantArt(id); this.anim = 'idle'; this.at = Math.random() * 2;
    this.t = 0; this.shootT = Math.random() * 0.5; this.shooting = 0;
    this.produceT = d.sun ? (d.sun.first || d.sun.interval) : 0;
    this.armed = !d.mine; this.armT = d.mine ? d.mine.arm : 0;
    this.fuse = d.bomb ? 1.0 : d.laneburn ? 0.5 : d.freeze ? 0.5 : 0;
    this.digest = 0; this.dead = false; this.flash = 0; this.bite = 0;
    this.crushT = 0;
    this.lives = 1;
  }
  Plant.prototype.cellContains = function (x) {
    return x >= G.cellLeft(this.col) - 6 && x <= G.cellLeft(this.col) + GR.cw + 6;
  };
  Plant.prototype.hurt = function (dmg, g) {
    if (this.def.bomb || this.def.laneburn || this.def.freeze) return;
    this.hp -= dmg; this.flash = 0.12;
    if (this.hp <= 0) { this.dead = true; g.onPlantLost(this); }
  };
  Plant.prototype.pickAnim = function () {
    var d = this.def;
    if (d.mine) { this.anim = this.armed ? 'ready' : 'armed'; return; }
    if (d.bomb) { this.anim = 'idle'; return; }
    if (d.chomp) {
      this.anim = this.digest > 0 ? 'digest' : (this.shooting > 0 ? 'attack' : 'idle'); return;
    }
    if (this.id === 'wallnut' || this.id === 'tallnut') {
      var f = this.hp / this.maxHp;
      this.anim = f < 0.3 ? 'broken' : f < 0.66 ? 'cracked' : 'idle'; return;
    }
    if (this.shooting > 0 && G.Assets.anim[this.art] && G.Assets.anim[this.art].attack) this.anim = 'attack';
    else this.anim = 'idle';
  };
  Plant.prototype.frontZombie = function (g, rangePx) {
    var best = null, list = g.zombies;
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (z.dead || z.state === 'die' || z.state === 'drop') continue;
      if (z.fly && !(this.def.gun && this.def.gun.air)) continue;
      if (z.row !== this.row) continue;
      if (z.x > this.x - 18 && z.x < this.x + (rangePx || 9999)) {
        if (!best || z.x < best.x) best = z;
      }
    }
    return best;
  };
  Plant.prototype.update = function (dt, g) {
    var d = this.def;
    this.t += dt; this.at += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.shooting > 0) this.shooting -= dt;

    if (d.bomb) {
      this.fuse -= dt;
      if (this.fuse <= 0) { this.dead = true; g.explode(this.x, this.y, d.bomb, this); }
      return;
    }
    if (d.laneburn) {
      this.fuse -= dt;
      if (this.fuse <= 0) { this.dead = true; g.laneBurn(this.row, d.laneburn); }
      return;
    }
    if (d.freeze) {
      this.fuse -= dt;
      if (this.fuse <= 0) { this.dead = true; g.freezeLawn(d.freeze); }
      return;
    }
    if (d.mine) {
      if (!this.armed) {
        this.armT -= dt;
        if (this.armT <= 0) { this.armed = true; g.fx('pop', this.x, this.y - 40, ''); }
      } else {
        for (var i = 0; i < g.zombies.length; i++) {
          var z = g.zombies[i];
          if (z.dead || z.fly || z.row !== this.row || z.state === 'die') continue;
          if (this.cellContains(z.x)) {
            this.dead = true;
            g.explode(this.x, this.y, { dmg: d.mine.dmg, r: 0.7 }, this);
            return;
          }
        }
      }
      this.pickAnim(); return;
    }
    if (d.sun) {
      this.produceT -= dt;
      if (this.produceT <= 0) {
        this.produceT = d.sun.interval;
        this.anim = 'produce'; this.at = 0;
        g.spawnSun(this.x + (Math.random() * 26 - 13), this.y - 60, this.y - 34, d.sun.amount);
      }
      this.pickAnim(); return;
    }
    if (d.spike) {
      var hit = false;
      for (var j = 0; j < g.zombies.length; j++) {
        var zz = g.zombies[j];
        if (zz.dead || zz.fly || zz.row !== this.row || zz.state === 'die') continue;
        if (this.cellContains(zz.x)) { zz.hurt(d.spike.dps * dt, g, { pierce: true }); hit = true; }
      }
      this.spikeHit = hit ? 0.2 : this.spikeHit;
      this.pickAnim(); return;
    }
    if (d.chomp) {
      if (this.digest > 0) { this.digest -= dt; this.pickAnim(); return; }
      var t = this.frontZombie(g, GR.cw * 1.1);
      if (t && !t.def.big) {
        t.hurt(d.chomp.dmg, g, { pierce: true, chomped: true });
        this.digest = d.chomp.digest; this.shooting = 0.5;
        g.sound('chomp');
      }
      this.pickAnim(); return;
    }
    if (d.crush) {
      if (this.crushT > 0) {
        this.crushT -= dt; this.anim = 'attack';
        if (this.crushT <= 0) { this.dead = true; g.onPlantLost(this); }
        return;
      }
      var cz = this.frontZombie(g, d.crush.r * GR.cw);
      if (cz) {
        this.crushT = 0.75; this.at = 0; this.anim = 'attack';
        g.sound('munch', 0.7, 40); g.shake = 0.3;
        for (var ci = 0; ci < g.zombies.length; ci++) {
          var zz = g.zombies[ci];
          if (zz.dead || zz.state === 'die' || zz.state === 'drop') continue;
          if (zz.row === this.row && Math.abs(zz.x - this.x) < GR.cw * 1.15)
            zz.hurt(d.crush.dmg, g, { pierce: true });
        }
        g.fx('boom', this.x, this.y - 24, 'fx.crater', 'idle', { ttl: 0.7 });
      }
      this.pickAnim(); return;
    }
    if (d.gun) {
      var gun = d.gun, self = this;
      this.shootT -= dt;
      if (this.shootT > 0) { this.pickAnim(); return; }
      var rng = gun.range ? gun.range * GR.cw : 9999;
      var rows = gun.multilane ? [this.row - 1, this.row, this.row + 1] : [this.row];
      var any = false;
      for (var r = 0; r < rows.length; r++) {
        var rr = rows[r];
        if (rr < 0 || rr >= GR.rows) continue;
        var target = null, list = g.zombies;
        for (var k = 0; k < list.length; k++) {
          var z2 = list[k];
          if (z2.dead || z2.state === 'die' || z2.row !== rr) continue;
          if (z2.fly && !gun.air && gun.bullet !== 'star') continue;
          if (z2.x > this.x - 20 && z2.x < this.x + rng) {
            if (!target || z2.x < target.x) target = z2;
          }
        }
        if (target) { any = true; break; }
      }
      if (!any) { this.pickAnim(); return; }
      var shots = gun.shots || 1;
      this.shootT = gun.rate;
      this.shooting = 0.35;
      for (var s = 0; s < shots; s++) {
        (function (s) {
          var fire = function () {
            if (self.dead) return;
            if (gun.multilane) {
              for (var q = -1; q <= 1; q++) {
                var rr2 = self.row + q;
                if (rr2 < 0 || rr2 >= GR.rows) continue;
                g.spawnProjectile({ owner: self, x: self.x + 22, y: G.laneY(rr2) - 26,
                  row: rr2, dmg: gun.dmg, type: gun.bullet, air: gun.air, slow: gun.slow,
                  slowTime: gun.slowTime, dy: q * GR.ch, pierce: gun.pierce, area: gun.area });
              }
            } else {
              g.spawnProjectile({ owner: self, x: self.x + 22, y: G.laneY(self.row) - 26,
                row: self.row, dmg: gun.dmg, type: gun.bullet, air: gun.air, slow: gun.slow,
                slowTime: gun.slowTime, pierce: gun.pierce, area: gun.area,
                lob: gun.lob, splash: gun.splash, pierceN: gun.pierceN, ret: gun.ret });
              if (gun.back) {
                g.spawnProjectile({ owner: self, x: self.x - 22, y: G.laneY(self.row) - 26,
                  row: self.row, dmg: gun.dmg, type: gun.bullet, dir: -1, air: gun.air });
              }
            }
            g.sound(gun.bullet === 'fume' ? 'groan6' : 'plant', 0.25, 60);
          };
          if (s === 0) fire(); else setTimeout(fire, s * (gun.gap || 0.15) * 1000);
        })(s);
      }
      this.pickAnim(); return;
    }
    this.pickAnim();
  };

  /* ================================ ZOMBIE ================================ */
  function Zombie(game, type, row, x, opts) {
    opts = opts || {};
    var d = G.ZOMBIES[type];
    this.type = type; this.def = d; this.art = d.art;
    this.row = row; this.x = x; this.y = G.laneBase(row);
    this.hpMul = opts.hpMul || 1; this.speedMul = opts.speedMul || 1;
    this.maxHp = d.hp * this.hpMul; this.hp = this.maxHp;
    this.armorMax = (d.armorHp || 0) * this.hpMul; this.armor = this.armorMax;
    this.baseSpeed = d.speed * G.SPEED * this.speedMul;
    this.state = 'walk'; this.anim = 'walk'; this.at = Math.random() * 2;
    this.slowT = 0; this.slow = 1; this.freezeT = 0; this.dieT = 0;
    this.dead = false; this.fly = !!d.fly; this.yOff = this.fly ? -78 : 0;
    this.big = !!d.big; this.eating = null; this.flash = 0;
    this.summonT = d.summon ? 3.5 : 0; this.thrown = !d.throw; this.smashT = 0;
    this.jumpT = 0; this.enraged = false; this.spawnWave = opts.wave || 1;
    this.score = Math.round(d.score * (1 + (this.spawnWave - 1) * 0.05));
  }
  Zombie.prototype.speed = function () {
    var s = this.baseSpeed;
    if (this.slowT > 0) s *= this.slow;
    return s;
  };
  Zombie.prototype.hurt = function (dmg, g, o) {
    o = o || {};
    if (this.dead || this.state === 'die') return;
    if (this.fly && !o.pierce && !o.air) { /* flying zombies need air shots */ }
    if (this.armor > 0 && !o.pierce) {
      this.armor -= dmg;
      if (this.armor < 0) { this.hp += this.armor; this.armor = 0; }
      if (this.def.paper && this.armor <= 0 && !this.enraged) this.enrage(g);
    } else {
      this.hp -= dmg;
    }
    this.flash = 0.08;
    if (this.hp <= 0) this.die(g, o);
  };
  Zombie.prototype.enrage = function (g) {
    this.enraged = true;
    this.baseSpeed = this.def.speed * G.SPEED * this.speedMul * 2.1;
    this.anim = 'enraged'; this.at = 0;
    g.fx('paper', this.x, this.y - 60, 'zombie.newspaper', 'paper');
    g.sound('newspaper', 0.5, 200);
  };
  Zombie.prototype.die = function (g, o) {
    if (this.state === 'die') return;
    this.state = 'die'; this.dieT = 0; this.at = 0;
    this.anim = g.animFor(this, 'die');
    this.eating = null;
    g.onZombieKilled(this);
    if (this.def.explode) {
      g.fx('boom', this.x, this.y - 40, 'zombie.jackbox', 'boom');
      g.explode(this.x, this.y, this.def.explode, this);
      g.sound('explosion', 0.6, 80);
    }
    if (G.Assets.has(this.art, 'head') && !this.big) {
      g.fx('head', this.x, this.y - 70, this.art, 'head');
    }
  };
  Zombie.prototype.pickAnim = function () {
    if (this.state === 'die') return;
    if (this.state === 'drop') { this.anim = 'drop'; return; }
    if (this.state === 'jump') { this.anim = 'jump'; return; }
    if (this.freezeT > 0) { this.anim = this.eating ? this.anim : 'walk'; return; }
    if (this.eating) {
      var a = this.enraged ? 'enraged' : (this.armor > 0 ? 'attack' : (this.def.paper ? 'attack' : 'attack'));
      this.anim = G.Assets.has(this.art, a) ? a : (G.Assets.has(this.art, 'attack') ? 'attack' : 'walk');
      if (this.armor <= 0 && this.def.screendoor) this.anim = 'shieldless';
      return;
    }
    if (this.enraged && G.Assets.has(this.art, 'enraged')) { this.anim = 'enraged'; return; }
    if (this.armor <= 0 && G.Assets.has(this.art, 'ornlost')) { this.anim = 'ornlost'; return; }
    if (this.armor <= 0 && G.Assets.has(this.art, 'shieldless')) { this.anim = 'shieldless'; return; }
    if (this.armor <= 0 && G.Assets.has(this.art, 'losthead') && this.hp < 0) { this.anim = 'losthead'; return; }
    this.anim = 'walk';
  };
  Zombie.prototype.targetPlant = function (g) {
    var c = G.colAt(this.x - 26);
    if (c < 0 || c >= GR.cols) return null;
    return g.plantAt(c, this.row);
  };
  Zombie.prototype.update = function (dt, g) {
    this.at += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.state === 'die') {
      this.dieT += dt;
      if (this.dieT > 1.25) this.dead = true;
      return;
    }
    if (this.freezeT > 0) { this.freezeT -= dt; this.pickAnim(); return; }
    if (this.slowT > 0) this.slowT -= dt;

    if (this.state === 'jump') {           /* pole vault */
      this.jumpT += dt;
      this.x -= 150 * dt;
      this.yOff = -Math.sin(Math.min(1, this.jumpT / 0.75) * Math.PI) * 92;
      if (this.jumpT >= 0.75) { this.state = 'walk'; this.yOff = 0; this.vaulted = true; }
      return;
    }
    if (this.state === 'drop') {           /* balloon falling */
      this.yOff += 260 * dt;
      if (this.yOff >= 0) { this.yOff = 0; this.state = 'walk'; this.fly = false; this.art = 'zombie.basic'; this.at = 0; }
      return;
    }
    if (this.fly) {
      this.x -= this.speed() * dt;
      this.yOff = -78 + Math.sin(this.at * 2.2) * 8;
      if (this.x <= G.HOUSE_X) g.onBreach(this);
      this.pickAnim();
      return;
    }
    if (this.throwImp && this.throwImp > 0) {
      this.throwImp -= dt;
      if (this.throwImp <= 0) { g.throwImp(this); }
    }
    var p = this.targetPlant(g);
    if (this.def.prox) {                    /* creeper-like: fuse when it reaches a plant */
      if (!this.fuse && p && this.x - p.x < this.def.prox * GR.cw) {
        this.fuse = 1; this.hissT = 0; g.sound('hiss', 0.5, 100);
      }
      if (this.fuse) {
        this.hissT += dt; this.anim = 'attack';
        if (Math.floor(this.hissT * 6) % 2 === 0) this.flash = 0.09;
        if (this.hissT > 1.3) { this.hurt(999999, g, { pierce: true }); }
        return;
      }
    }
    if (this.def.vault && !this.vaulted && p && this.x - 30 < G.cellLeft(p.col) + GR.cw) {
      this.state = 'jump'; this.jumpT = 0; this.at = 0; g.sound('vault', 0.5, 200); return;
    }
    if (this.def.crush) {
      if (p && this.cellHits(p)) {
        g.crushPlant(p, this);
        this.smashT = 0.35;
      }
      if (this.smashT > 0) { this.smashT -= dt; this.anim = 'attack'; this.at += 0; }
      else this.anim = 'walk';
      this.x -= this.speed() * dt;
      if (this.x <= G.HOUSE_X) g.onBreach(this);
      return;
    }
    if (this.def.throw && !this.thrown) {
      for (var i = 0; i < g.plants.length; i++) {
        var pl = g.plants[i];
        if (pl.dead || pl.row !== this.row) continue;
        if (pl.x < this.x - GR.cw * 1.2 && pl.x > this.x - GR.cw * 3.4) {
          this.thrown = true; this.anim = 'attack'; this.at = 0;
          g.throwImp(this); break;
        }
      }
    }
    if (this.def.summon) {
      this.summonT -= dt;
      if (this.summonT <= 0 && this.x < G.LAWN.right + 40) {
        this.summonT = 999;
        g.danceSummon(this);
      }
    }
    if (p && this.cellHits(p) && !p.def.noeat) {
      this.eating = p; this.anim = this.anim;
      p.hurt(G.EAT_DPS * dt, g);
      if (p.dead) this.eating = null;
      this.pickAnim();
      return;
    }
    if (p && this.cellHits(p) && p.def.noeat) {
      p.hurt(40 * dt, g);       /* zombies grind over spike weeds */
    }
    this.eating = null;
    this.x -= this.speed() * dt;
    if (this.x <= G.HOUSE_X) g.onBreach(this);
    this.pickAnim();
  };
  Zombie.prototype.cellHits = function (p) {
    var mouth = this.x - 26;
    return mouth >= G.cellLeft(p.col) - 4 && mouth <= G.cellLeft(p.col) + GR.cw - 4;
  };

  /* ================================ PROJECTILE ================================ */
  function Projectile(g, o) {
    this.x = o.x; this.y = o.y; this.row = o.row;
    this.dmg = o.dmg; this.type = o.type || 'pea';
    this.dir = o.dir || 1;
    this.vx = (o.speed || (this.type === 'fume' ? 210 : this.type === 'star' ? 260 : 330)) * this.dir;
    this.dy = o.dy || 0;
    this.pierce = !!o.pierce; this.area = o.area || 0;
    this.slow = o.slow; this.slowTime = o.slowTime; this.air = !!o.air;
    this.lob = o.lob || 0; this.splash = o.splash || 0;
    this.pierceN = o.pierceN || 0; this.ret = !!o.ret; this.returned = false;
    this.y0 = this.y; this.x0 = this.x; this.tx = 0;
    if (this.lob) {
      this.vx = 175 * this.dir;
      var tx = G.LAWN.right - 20, lz2 = null;
      for (var li = 0; li < g.zombies.length; li++) {
        var lz = g.zombies[li];
        if (lz.dead || lz.state === 'die' || lz.row !== this.row) continue;
        if (lz.x > this.x - 12 && lz.x < tx) { tx = lz.x; lz2 = lz; }
      }
      this.tgt = lz2;
      this.minTx = this.x + 70;
      this.tx = Math.max(this.minTx, tx);
    }
    this.art = this.type === 'snow' ? 'fx.snowpea' : this.type === 'fume' ? 'fx.fume'
      : this.type === 'star' ? 'fx.star' : this.type === 'fire' ? 'fx.pea'
      : this.type === 'melon' ? 'fx.melon' : this.type === 'wmelon' ? 'fx.wmelon'
      : this.type === 'boomerang' ? 'fx.star' : 'fx.pea';
    this.dead = false; this.at = Math.random(); this.hits = [];
    this.life = 4;
  }
  Projectile.prototype.update = function (dt, g) {
    this.at += dt; this.life -= dt;
    this.x += this.vx * dt;
    if (this.lob) {
      if (this.tgt && !this.tgt.dead && this.tgt.state !== 'die' && this.tgt.row === this.row)
        this.tx = Math.max(this.minTx, this.tgt.x);
      var t = Math.max(0, Math.min(1, (this.x - this.x0) / Math.max(1, this.tx - this.x0)));
      this.y = this.y0 - this.lob * 4 * t * (1 - t);
      if (this.x >= this.tx) { this.land(g); }
      if (this.x > G.W + 60 || this.life <= 0) this.dead = true;
      return;
    }
    if (this.dy) { this.y += this.dy * dt * 0.6; }
    if (this.x < G.GRID.x0 - 60 || this.x > G.W + 60 || this.life <= 0) { this.dead = true; return; }
    /* torchwood powers peas */
    if ((this.type === 'pea' || this.type === 'snow') && this.dir > 0) {
      var tw = g.torchAt(G.colAt(this.x), this.row);
      if (tw && this.torch !== tw) {
        this.torch = tw; this.type = 'fire'; this.dmg *= 2; this.art = 'fx.pea';
        g.sound('jalapeno', 0.18, 120);
      }
    }
    var list = g.zombies, r = this.area;
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (z.dead || z.state === 'die') continue;
      if (Math.abs(z.x - this.x) > 26) continue;
      if (r > 0) { if (Math.abs(z.row - this.row) > r) continue; }
      else if (z.row !== this.row) continue;
      if (z.fly && !this.air && this.type !== 'star') continue;
      if (this.hits.indexOf(z) >= 0) continue;
      this.hits.push(z);
      z.hurt(this.dmg, g, { pierce: this.pierce, air: this.air, front: this.dir > 0 });
      if (this.slow) { z.slowT = this.slowTime || 4; z.slow = this.slow; }
      if (this.type === 'fire') z.burn = 1;
      g.fx('hit', this.x, this.y, 'fx.peahit', 'idle');
      if (this.pierceN && this.hits.length >= this.pierceN) {
        if (this.ret && !this.returned) {
          this.returned = true; this.dir = -1; this.vx = -Math.abs(this.vx); this.hits = [];
        } else { this.dead = true; }
        return;
      }
      if (!this.pierce) { this.dead = true; return; }
    }
  };
  Projectile.prototype.land = function (g) {
    var R = this.splash || 26, ar = this.area || 0;
    for (var i = 0; i < g.zombies.length; i++) {
      var z = g.zombies[i];
      if (z.dead || z.state === 'die' || z.state === 'drop') continue;
      if (Math.abs(z.row - this.row) > ar) continue;
      if (Math.abs(z.x - this.x) > R) continue;
      z.hurt(this.dmg, g, { pierce: true, front: true });
      if (this.slow) { z.slowT = this.slowTime || 4; z.slow = this.slow; }
    }
    g.fx('hit', this.x, this.y, 'fx.peahit', 'idle');
    if (this.splash) g.fx('boom', this.x, this.y, 'fx.peahit', 'idle', { ttl: 0.35 });
    this.dead = true;
  };

  /* ================================ SUN ================================ */
  function Sun(g, x, y, targetY, value) {
    this.x = x; this.y = y; this.ty = targetY; this.value = value || G.SUN_VALUE;
    this.at = 0; this.life = 11; this.dead = false; this.collect = 0;
    this.vx = 0;
  }
  Sun.prototype.update = function (dt) {
    this.at += dt;
    if (this.collect > 0) {
      this.collect += dt * 3;
      this.y -= 260 * dt; this.x += (60 - this.x) * dt * 2.4;
      if (this.collect > 0.55) this.dead = true;
      return;
    }
    if (this.y < this.ty) { this.y = Math.min(this.ty, this.y + 90 * dt); return; }
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  };

  /* ================================ EFFECT ================================ */
  function Effect(kind, x, y, art, anim, opt) {
    opt = opt || {};
    this.kind = kind; this.x = x; this.y = y; this.art = art; this.anim = anim;
    this.at = 0; this.ttl = opt.ttl || 1.2; this.dead = false;
    this.loop = !!opt.loop; this.scale = opt.scale || 1; this.alpha = opt.alpha || 1;
    this.vy = opt.vy || 0; this.vx = opt.vx || 0; this.rot = opt.rot || 0;
  }
  Effect.prototype.update = function (dt) {
    this.at += dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.kind === 'head') { this.vy += 420 * dt; this.rot += dt * 6; }
    if (this.loop) { if (this.at > this.ttl) this.dead = true; return; }
    var info = G.Assets.anim[this.art] && G.Assets.anim[this.art][this.anim];
    if (info && this.at > info.info.frames / info.info.fps) this.dead = true;
    else if (this.at > this.ttl) this.dead = true;
  };

  G.Plant = Plant; G.Zombie = Zombie; G.Projectile = Projectile;
  G.Sun = Sun; G.Effect = Effect;
})(window.PvZ = window.PvZ || {});
