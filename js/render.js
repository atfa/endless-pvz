/* Renderer: canvas drawing for lawn, entities, HUD, seed chooser.  global: PvZ.Render */
(function (G) {
  'use strict';
  var GR = G.GRID, A = G.Assets;
  var R = G.Render = {};

  var PLANT_SCALE = {
    puffshroom: 1.25, sunflower: 1.25, peashooter: 1.2, wallnut: 1.0, potatomine: 1.25,
    cherrybomb: 1.15, snowpea: 1.2, chomper: 1.05, jalapeno: 1.2, fumeshroom: 1.1,
    iceshroom: 1.15, starfruit: 1.15, repeater: 1.2, spikeweed: 1.0, garlic: 1.15,
    torchwood: 1.05, tallnut: 1.0, cactus: 1.05, twinflower: 1.2, pumpkin: 1.0,
    gloomshroom: 1.05, splitpea: 1.15, threepeater: 1.05, gatlingpea: 1.15,
    spikerock: 1.0, doomshroom: 1.05, squash: 0.95, cabbagepult: 1.0,
    melonpult: 1.35, wintermelon: 0.9, boomerang: 1.25
  };
  var ZOMBIE_SCALE = { gargantuar: 0.74, zomboni: 0.86, imp: 1.0, balloon: 1.0,
    raptor: 1.9, triceratops: 1.5, ankylosaur: 1.45, sauropod: 1.25, trex: 1.3,
    pterosaur: 1.2, egg: 1.7, bomber: 0.46, beholder: 0.62, imposter: 0.5 };
  var PLANT_TINT = {
    sunflower: '#ffd94a', peashooter: '#5fbf3f', wallnut: '#b5772e', puffshroom: '#9a7fd1',
    potatomine: '#a9743f', cherrybomb: '#e04b3a', snowpea: '#57c8e8', chomper: '#8a4fc0',
    jalapeno: '#e2572c', fumeshroom: '#7f6fd0', iceshroom: '#63c9e8', starfruit: '#e8d24b',
    repeater: '#3fa83f', spikeweed: '#4f9b3a', garlic: '#e8e0c8', torchwood: '#b0603a',
    tallnut: '#a5762f', cactus: '#4fae6a', twinflower: '#f0c93a', pumpkin: '#e78a2a',
    gloomshroom: '#6a58b8', splitpea: '#49a83f', threepeater: '#3f9f4f', gatlingpea: '#2f8f3f',
    spikerock: '#3f7f3a', doomshroom: '#5a4fa8'
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  R.roundRect = roundRect;

  /* draw animation frame; ax,ay = anchor (bc = bottom center, c = center) */
  function anim(ctx, art, name, x, y, t, scale, anchor, alpha, tint) {
    var f = A.frame(art, name, t);
    if (!f) {
      if (tint) {
        ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.fillStyle = tint;
        ctx.beginPath(); ctx.arc(x, y - 26 * (scale || 1), 26 * (scale || 1), 0, 6.283); ctx.fill();
        ctx.restore();
      }
      return null;
    }
    var w = f.w * (scale || 1), h = f.h * (scale || 1);
    var dx = anchor === 'c' ? x - w / 2 : x - w / 2;
    var dy = anchor === 'c' ? y - h / 2 : y - h;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, dx, dy, w, h);
    ctx.restore();
    return { w: w, h: h, x: dx, y: dy };
  }
  R.anim = anim;

  function img(ctx, key, x, y, w, h, alpha) {
    var im = A.img[key];
    if (!im || !im.complete || !im.naturalWidth) return false;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(im, x, y, w, h);
    ctx.restore();
    return true;
  }

  /* ---------------- lawn ---------------- */
  function drawLawn(ctx, g) {
    if (!img(ctx, 'bg.lawn', 0, 0, G.W, G.H)) {
      ctx.fillStyle = '#4a8f3c'; ctx.fillRect(0, 0, G.W, G.H);
    }
    /* lane stripes for readability */
    ctx.save();
    for (var r = 0; r < GR.rows; r++) {
      if (r % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        ctx.fillRect(G.LAWN.left, G.cellTop(r), G.LAWN.right - G.LAWN.left, GR.ch);
      }
    }
    ctx.restore();
  }
  function drawGrid(ctx, g) {
    if (g.selected < 0 && !g.shovel) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (var r = 0; r <= GR.rows; r++) {
      ctx.beginPath(); ctx.moveTo(G.LAWN.left, G.GRID.y0 + r * GR.ch);
      ctx.lineTo(G.LAWN.right, G.GRID.y0 + r * GR.ch); ctx.stroke();
    }
    for (var c = 0; c <= GR.cols; c++) {
      ctx.beginPath(); ctx.moveTo(G.GRID.x0 + c * GR.cw, G.LAWN.top);
      ctx.lineTo(G.GRID.x0 + c * GR.cw, G.LAWN.bottom); ctx.stroke();
    }
    if (g.hover && g.hover.c >= 0) {
      var h = g.hover, ok = g.canPlant(g.seeds[g.selected] ? g.seeds[g.selected].id : '', h.c, h.r) === 'ok';
      ctx.fillStyle = g.shovel ? 'rgba(255,200,60,0.3)' :
        ok ? 'rgba(120,255,120,0.28)' : 'rgba(255,80,80,0.28)';
      ctx.fillRect(G.cellLeft(h.c), G.cellTop(h.r), GR.cw, GR.ch);
    }
    ctx.restore();
  }

  /* ---------------- entities ---------------- */
  function drawPlant(ctx, p) {
    var s = PLANT_SCALE[p.id] || 1;
    var art = p.art, an = p.anim;
    if (p.hasPumpkin) anim(ctx, 'plant.pumpkin', 'idle', p.x, p.y + 4, p.at, s * 0.95, 'bc');
    var r = anim(ctx, art, an, p.x, p.y, p.at, s, 'bc', p.flash > 0 ? 0.65 : 1, PLANT_TINT[p.id]);
    if (!r) {
      ctx.save();
      ctx.fillStyle = PLANT_TINT[p.id] || '#7c7';
      ctx.beginPath(); ctx.arc(p.x, p.y - 30, 26 * s, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    if (p.def.mine && !p.armed) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, p.x - 22, p.y - 8, 44, 6, 3); ctx.fill();
      ctx.fillStyle = '#ffd54a';
      roundRect(ctx, p.x - 22, p.y - 8, 44 * (1 - p.armT / p.def.mine.arm), 6, 3); ctx.fill();
      ctx.restore();
    }
    if (p.hp < p.maxHp && !p.def.bomb && !p.def.laneburn && !p.def.freeze) {
      var f = Math.max(0, p.hp / p.maxHp);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(p.x - 20, p.y - 6, 40, 4);
      ctx.fillStyle = f > 0.5 ? '#7ef07a' : f > 0.25 ? '#ffd54a' : '#ff6a4a';
      ctx.fillRect(p.x - 20, p.y - 6, 40 * f, 4);
      ctx.restore();
    }
  }
  function drawZombie(ctx, z) {
    var s = ZOMBIE_SCALE[z.type] || 1;
    var y = z.y + z.yOff - 6;
    var alpha = z.state === 'die' ? Math.max(0, 1 - z.dieT / 1.25) : 1;
    if (z.fly) { anim(ctx, 'zombie.balloon', 'fly', z.x, y, z.at, s, 'bc', alpha); }
    else anim(ctx, z.art, z.anim, z.x, y, z.at, s, 'bc', alpha);
    if (z.freezeT > 0) {
      ctx.save(); ctx.globalAlpha = 0.42; ctx.fillStyle = '#7fd8ff';
      ctx.beginPath(); ctx.ellipse(z.x, y - 55 * s, 34 * s, 62 * s, 0, 0, 6.283); ctx.fill(); ctx.restore();
    }
    if (z.slowT > 0 && z.freezeT <= 0) {
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#9fe8ff';
      ctx.beginPath(); ctx.ellipse(z.x, y - 50 * s, 30 * s, 56 * s, 0, 0, 6.283); ctx.fill(); ctx.restore();
    }
    if (z.flash > 0) {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(z.x, y - 55 * s, 30 * s, 60 * s, 0, 0, 6.283); ctx.fill(); ctx.restore();
    }
    var mx = z.x, my = y - (z.big ? 150 : 108) * s;
    if (z.armor > 0 && z.armorMax > 0) bar(ctx, mx, my, 44 * s, z.armor / z.armorMax, '#9ecbff');
    if (z.hp < z.maxHp) bar(ctx, mx, my + 7 * s, 44 * s, z.hp / z.maxHp, '#ff6a4a');
  }
  function bar(ctx, x, y, w, f, col) {
    f = Math.max(0, Math.min(1, f));
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - w / 2, y, w, 4);
    ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * f, 4);
    ctx.restore();
  }
  function drawProjectile(ctx, p) {
    var art = p.type === 'fire' ? 'fx.pea' : p.art;
    if (p.type === 'melon' || p.type === 'wmelon') {
      var key = p.type === 'melon' ? 'fx.melon' : 'fx.wmelon';
      var im = A.img[key], w = 44, h = 40;
      if (im && im.complete && im.naturalWidth) { w = im.naturalWidth * 0.5; h = im.naturalHeight * 0.5; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.at * 5);
      if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -w / 2, -h / 2, w, h);
      else { ctx.fillStyle = p.type === 'melon' ? '#3fa83f' : '#7fd8ff';
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.283); ctx.fill(); }
      ctx.restore(); return;
    }
    if (p.type === 'cabbage') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-p.at * 5);
      ctx.fillStyle = '#5fa83a'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#9adc6a'; ctx.beginPath(); ctx.arc(-3, -3, 8, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#3d7a22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.283); ctx.stroke();
      ctx.restore(); return;
    }
    if (p.type === 'boomerang') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.at * 14 * (p.dir > 0 ? 1 : -1));
      ctx.translate(-p.x, -p.y);
      anim(ctx, 'fx.star', 'idle', p.x, p.y, p.at, 0.85, 'c');
      ctx.restore(); return;
    }
    if (p.type === 'fire') {
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#ff8a2a';
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 6.283); ctx.fill(); ctx.restore();
    }
    if (!anim(ctx, art, 'idle', p.x, p.y, p.at, p.type === 'star' ? 1 : 1, 'c')) {
      ctx.save();
      ctx.fillStyle = p.type === 'snow' ? '#9fe8ff' : p.type === 'fume' ? '#a08ce8' :
        p.type === 'star' ? '#ffe066' : p.type === 'fire' ? '#ff7a2a' : '#6fd84a';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.type === 'fume' ? 16 : 8, 0, 6.283); ctx.fill();
      ctx.restore();
    }
  }
  function drawSun(ctx, s) {
    var a = s.life < 3 ? (0.35 + 0.65 * Math.abs(Math.sin(s.at * 6))) : 1;
    ctx.save();
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(s.x, s.y, 34, 0, 6.283); ctx.fill();
    ctx.restore();
    if (!anim(ctx, 'fx.sun', 'idle', s.x, s.y, s.at, 1, 'c', a)) {
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffd93a';
      ctx.beginPath(); ctx.arc(s.x, s.y, 20, 0, 6.283); ctx.fill(); ctx.restore();
    }
  }
  function drawEffect(ctx, e) {
    if (e.kind === 'head') {
      ctx.save();
      ctx.translate(e.x, e.y); ctx.rotate(e.rot); ctx.globalAlpha = Math.max(0, 1 - e.at / 1.2);
      anim(ctx, e.art, e.anim, 0, 0, e.at, 1, 'bc');
      ctx.restore();
      return;
    }
    if (e.kind === 'ice') {
      ctx.save(); ctx.globalAlpha = Math.max(0, 0.5 * (1 - e.at / e.ttl)); ctx.fillStyle = '#bfefff';
      ctx.fillRect(0, 0, G.W, G.H); ctx.restore();
      return;
    }
    if (e.kind === 'pop') {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - e.at / e.ttl);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, 8 + e.at * 60, 0, 6.283); ctx.stroke();
      ctx.restore();
      return;
    }
    var sc = e.scale;
    if (e.kind === 'boom') sc = 1.6;
    if (e.kind === 'fire') sc = 1.5;
    anim(ctx, e.art, e.anim, e.x, e.y, e.at, sc, 'bc', e.alpha);
  }

  /* ---------------- HUD ---------------- */
  var SEED_W = 74, SEED_H = 92, SEED_Y = 8, SEED_X = 128, SEED_GAP = 6;
  R.seedRect = function (i) { return { x: SEED_X + i * (SEED_W + SEED_GAP), y: SEED_Y, w: SEED_W, h: SEED_H }; };
  R.shovelRect = function () {
    return { x: SEED_X + G.WAVES.maxSeeds * (SEED_W + SEED_GAP) + 10, y: SEED_Y + 6, w: 66, h: 66 };
  };
  R.sunRect = function () { return { x: 10, y: 8, w: 108, h: 84 }; };

  function drawHUD(ctx, g) {
    var i, r;
    /* sun counter */
    var sr = R.sunRect();
    ctx.save();
    ctx.fillStyle = 'rgba(24,32,20,0.82)';
    roundRect(ctx, sr.x, sr.y, sr.w, sr.h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    if (!anim(ctx, 'fx.sun', 'idle', sr.x + 30, sr.y + 30, g.time, 0.85, 'c')) {
      ctx.save(); ctx.fillStyle = '#ffd93a'; ctx.beginPath(); ctx.arc(sr.x + 30, sr.y + 30, 16, 0, 6.283); ctx.fill(); ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(g.sun | 0), sr.x + 58, sr.y + 62);
    ctx.restore();

    /* seed packets */
    for (i = 0; i < g.seeds.length; i++) {
      var s = g.seeds[i], d = G.PLANTS[s.id], rc = R.seedRect(i);
      var afford = g.sun >= d.cost && s.cd <= 0;
      ctx.save();
      ctx.fillStyle = 'rgba(232,222,190,0.94)';
      roundRect(ctx, rc.x, rc.y, rc.w, rc.h, 7); ctx.fill();
      ctx.strokeStyle = g.selected === i ? '#ffe066' : 'rgba(60,45,25,0.6)';
      ctx.lineWidth = g.selected === i ? 4 : 2; ctx.stroke();
      ctx.restore();
      anim(ctx, G.plantArt(s.id), 'idle', rc.x + rc.w / 2, rc.y + 62, g.time * 0.6, (PLANT_SCALE[s.id] || 1) * 0.62, 'bc', 1, PLANT_TINT[s.id]);
      ctx.save();
      ctx.fillStyle = afford ? '#2b2b18' : '#8a8a7a';
      ctx.font = 'bold 16px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(d.cost), rc.x + rc.w / 2, rc.y + rc.h - 12);
      ctx.restore();
      if (s.cd > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(20,26,40,0.62)';
        roundRect(ctx, rc.x, rc.y, rc.w, rc.h * Math.min(1, s.cd / d.cd), 7); ctx.fill();
        ctx.restore();
      } else if (!afford) {
        ctx.save(); ctx.fillStyle = 'rgba(20,26,40,0.42)';
        roundRect(ctx, rc.x, rc.y, rc.w, rc.h, 7); ctx.fill(); ctx.restore();
      }
    }
    /* shovel */
    var sh = R.shovelRect();
    ctx.save();
    ctx.fillStyle = g.shovel ? 'rgba(255,214,90,0.95)' : 'rgba(120,86,42,0.9)';
    roundRect(ctx, sh.x, sh.y, sh.w, sh.h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = '34px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🪓', sh.x + sh.w / 2, sh.y + sh.h / 2 + 2);
    ctx.restore();

    /* right side: wave / score */
    ctx.save();
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = 'bold 26px system-ui,sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
    ctx.fillText('第 ' + g.wave + ' 波', G.W - 18, 12);
    ctx.font = 'bold 20px system-ui,sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('得分 ' + g.score, G.W - 18, 44);
    ctx.font = '14px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('击杀 ' + g.kills + ' · 最高 ' + g.best, G.W - 18, 70);
    ctx.restore();

    /* wave progress */
    if (g.phase === 'wave') {
      var d = G.diff(g.wave), f = 1 - Math.max(0, g.budget) / d.budget;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, G.W - 218, 92, 200, 12, 6); ctx.fill();
      ctx.fillStyle = '#8ee06a';
      roundRect(ctx, G.W - 218, 92, 200 * Math.max(0.02, Math.min(1, f)), 12, 6); ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.textAlign = 'right'; ctx.font = 'bold 16px system-ui,sans-serif'; ctx.fillStyle = '#bff0a0';
      ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
      ctx.fillText('下一波 ' + Math.ceil(g.phaseT) + 's', G.W - 18, 96);
      ctx.restore();
    }
  }

  function drawBanner(ctx, g) {
    if (!g.banner) return;
    var b = g.banner, a = Math.min(1, Math.min(b.t * 3, (b.ttl - b.t) * 2));
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 54px system-ui,sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 12;
    ctx.fillStyle = b.art === 'fx.huge' ? '#ff6a4a' : '#ffe066';
    ctx.fillText(b.text, G.W / 2, 250);
    ctx.restore();
  }
  function drawTexts(ctx, g) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = 'bold 20px system-ui,sans-serif';
    for (var i = 0; i < g.texts.length; i++) {
      var t = g.texts[i];
      if (t.x === undefined) continue;
      ctx.globalAlpha = Math.max(0, 1 - t.t / t.ttl);
      ctx.fillStyle = t.color || '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
      ctx.fillText(t.text, t.x, t.y - t.t * 26);
    }
    ctx.restore();
  }
  function drawToasts(ctx, g) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = 'bold 22px system-ui,sans-serif';
    var k = 0;
    for (var i = 0; i < g.texts.length; i++) {
      var t = g.texts[i];
      if (t.x !== undefined) continue;
      var a = Math.min(1, Math.min(t.t * 4, (t.ttl - t.t) * 2));
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = '#0d1a0a';
      var w = ctx.measureText(t.text).width + 40;
      roundRect(ctx, G.W / 2 - w / 2, 120 + k * 34, w, 30, 15); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.fillText(t.text, G.W / 2, 136 + k * 34);
      k++;
    }
    ctx.restore();
  }

  /* ---------------- seed chooser ---------------- */
  R.chooserLayout = function (g) {
    var list = g.availablePlants();
    var cols = 8, cw = 108, ch = 104, x0 = (G.W - cols * cw) / 2, y0 = 86;
    var cards = [];
    for (var i = 0; i < list.length; i++) {
      cards.push({ id: list[i], x: x0 + (i % cols) * cw, y: y0 + Math.floor(i / cols) * ch, w: cw - 8, h: ch - 10 });
    }
    return { cards: cards, cols: cols, cw: cw, ch: ch,
      start: { x: G.W / 2 - (g.resumeAfterChoose ? 235 : 110), y: G.H - 66, w: 220, h: 52 },
      cancel: { x: G.W / 2 + 15, y: G.H - 66, w: 220, h: 52 } };
  };
  function drawChooser(ctx, g) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,6,0.93)'; ctx.fillRect(0, 0, G.W, G.H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 34px system-ui,sans-serif';
    ctx.fillText((g.resumeAfterChoose ? '更换出战植物（已解锁 ' : '选择 ' + g.seedSlots() + ' 株植物出战（已解锁 ')
      + g.availablePlants().length + ' 种）', G.W / 2, 56);
    var L = R.chooserLayout(g);
    for (var i = 0; i < L.cards.length; i++) {
      var c = L.cards[i], d = G.PLANTS[c.id];
      var sel = g.pickList.indexOf(c.id) >= 0;
      ctx.fillStyle = sel ? 'rgba(120,220,90,0.28)' : 'rgba(238,228,196,0.9)';
      roundRect(ctx, c.x, c.y, c.w, c.h, 8); ctx.fill();
      ctx.strokeStyle = sel ? '#aef07a' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = sel ? 3 : 1; ctx.stroke();
      anim(ctx, G.plantArt(c.id), 'idle', c.x + c.w / 2, c.y + 74, g.time * 0.6, (PLANT_SCALE[c.id] || 1) * 0.6, 'bc', 1, PLANT_TINT[c.id]);
      ctx.fillStyle = '#20240f'; ctx.font = 'bold 14px system-ui,sans-serif';
      ctx.fillText(d.name, c.x + c.w / 2, c.y + 90);
      ctx.fillStyle = '#4a4a20'; ctx.font = '12px system-ui,sans-serif';
      ctx.fillText('阳光 ' + d.cost + ' · 第' + d.unlock + '波', c.x + c.w / 2, c.y + 106);
    }
    var slots = g.seedSlots(), st = L.start, ready = g.pickList.length === slots;
    ctx.fillStyle = ready ? '#5fbf3f' : 'rgba(120,130,110,0.8)';
    roundRect(ctx, st.x, st.y, st.w, st.h, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui,sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText((g.resumeAfterChoose ? '确认出战 (' : '开始战斗 (') + g.pickList.length + '/' + slots + ')',
      st.x + st.w / 2, st.y + st.h / 2);
    if (g.resumeAfterChoose) {
      var cn = L.cancel;
      ctx.fillStyle = 'rgba(150,90,60,0.9)';
      roundRect(ctx, cn.x, cn.y, cn.w, cn.h, 12); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('取消', cn.x + cn.w / 2, cn.y + cn.h / 2);
    }
    ctx.restore();
  }

  /* ---------------- main ---------------- */
  R.draw = function (ctx, g) {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * g.shake, (Math.random() - 0.5) * 10 * g.shake);
    drawLawn(ctx, g);
    drawGrid(ctx, g);
    /* mowers */
    for (var i = 0; i < g.mowers.length; i++) {
      var m = g.mowers[i];
      if (m.state === 'gone') continue;
      if (!anim(ctx, 'fx.mower', 'idle', m.x, m.y + 34, g.time * (m.state === 'run' ? 6 : 0.6), 1, 'bc')) {
        ctx.save(); ctx.fillStyle = '#c0392b'; roundRect(ctx, m.x - 22, m.y - 10, 44, 30, 6); ctx.fill(); ctx.restore();
      }
    }
    var r, j;
    for (i = 0; i < g.plants.length; i++) drawPlant(ctx, g.plants[i]);
    for (i = 0; i < g.effects.length; i++) if (g.effects[i].kind === 'fire') drawEffect(ctx, g.effects[i]);
    var zs = g.zombies.slice().sort(function (a, b) { return a.row - b.row; });
    for (i = 0; i < zs.length; i++) drawZombie(ctx, zs[i]);
    for (i = 0; i < g.projectiles.length; i++) drawProjectile(ctx, g.projectiles[i]);
    for (i = 0; i < g.effects.length; i++) if (g.effects[i].kind !== 'fire') drawEffect(ctx, g.effects[i]);
    for (i = 0; i < g.suns.length; i++) drawSun(ctx, g.suns[i]);
    drawTexts(ctx, g);
    if (g.flashIce > 0) { ctx.save(); ctx.globalAlpha = g.flashIce * 0.5; ctx.fillStyle = '#bfefff'; ctx.fillRect(0, 0, G.W, G.H); ctx.restore(); }
    if (g.flashFire > 0) { ctx.save(); ctx.globalAlpha = g.flashFire * 0.4; ctx.fillStyle = '#ff7a2a'; ctx.fillRect(0, 0, G.W, G.H); ctx.restore(); }
    drawHUD(ctx, g);
    drawBanner(ctx, g);
    drawToasts(ctx, g);
    if (g.state === 'choose') drawChooser(ctx, g);
    ctx.restore();
  };
  R.PLANT_TINT = PLANT_TINT;
  R.PLANT_SCALE = PLANT_SCALE;
})(window.PvZ = window.PvZ || {});
