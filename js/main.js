/* Bootstrap: loading, main loop, DOM wiring. */
(function (G) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var canvas, ctx, game, raf = 0, last = 0, acc = 0, soundOn = true;

  function fit() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var rect = canvas.getBoundingClientRect();
    var s = Math.max(1, Math.min(2, (rect.width / G.W) * dpr));
    var w = Math.round(G.W * s), h = Math.round(G.H * s);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingQuality = 'high';
  }

  function show(id, on) { var e = $(id); if (e) e.classList[on ? 'remove' : 'add']('hidden'); }

  function startRun() {
    game.reset();
    game.pickList = game.defaultSeeds();
    game.state = 'choose';
    show('start', false); show('gameover', false); show('pause', false);
    G.Sound.play('click', 0.5);
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (!last) last = ts;
    var dt = (ts - last) / 1000; last = ts;
    if (dt > 0.25) dt = 0.25;
    if (game.state === 'playing') {
      /* fixed-ish stepping for stability on slow devices */
      acc += dt;
      var steps = 0;
      while (acc > 1 / 60 && steps < 4) { game.update(1 / 60); acc -= 1 / 60; steps++; }
      if (steps === 4) acc = 0;
      if (game.state === 'over') {
        $('finalscore').textContent = '得分 ' + game.score + ' · 击杀 ' + game.kills;
        $('finalwave').textContent = '坚持到第 ' + game.wave + ' 波　最高分 ' + game.best;
        show('gameover', true);
      }
    } else {
      game.time += dt;
    }
    fit();
    G.Render.draw(ctx, game);
  }

  function setPaused(on) {
    if (on && game.state === 'playing') { game.state = 'paused'; show('pause', true); G.Sound.stopMusic(); }
    else if (!on && game.state === 'paused') { game.state = 'playing'; show('pause', false); G.Sound.music('theme'); }
  }

  /* ---------------- settings (difficulty, events) ---------------- */
  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem('pvz.settings') || '{}');
      if (s.diff) G.settings.diff = s.diff;
      if (typeof s.events === 'boolean') G.settings.events = s.events;
      if (typeof s.sound === 'boolean') soundOn = s.sound;
    } catch (e) { }
  }
  function saveSettings() {
    try { localStorage.setItem('pvz.settings', JSON.stringify(G.settings)); } catch (e) { }
  }
  var settingsFrom = false;
  function renderSettings() {
    var row = $('diffrow');
    row.innerHTML = '';
    for (var i = 0; i < G.DIFFS.length; i++) {
      var d = G.DIFFS[i];
      var b = document.createElement('button');
      b.className = 'diff-btn' + (G.settings.diff === d.id ? ' on' : '');
      b.innerHTML = '<span class=ic>' + d.icon + '</span><span class=nm>' + d.name + '难度</span>' +
        '<span class=ds>' + d.desc + '</span>';
      b.onclick = function () {
        G.settings.diff = d.id; saveSettings(); renderSettings();
        if (game.applyDifficulty) game.applyDifficulty();   /* takes effect NOW */
        G.Sound.play('click', 0.4);
      };
      row.appendChild(b);
    }
    $('chk-events').checked = !!G.settings.events;
  }
  function openSettings() {
    if (game.state === 'playing') setPaused(true);
    settingsFrom = game.state === 'paused';
    show('pause', false);
    renderSettings();
    show('settings', true);
    G.Sound.play('click', 0.4);
  }
  function closeSettings() {
    show('settings', false);
    if (settingsFrom) setPaused(false);
    settingsFrom = false;
  }

  /* ---- harness hooks (used by the Android activity: am start --es js "...") ---- */
  function jslog(m) { try { if (window.android && window.android.log) window.android.log(m); } catch (e) { } }

  G.setPaused = setPaused;
  G.jslog = jslog;
  G.debug = function () {
    return JSON.stringify({
      state: game.state, wave: game.wave, phase: game.phase, score: game.score, kills: game.kills,
      sun: game.sun, plants: game.plants.length, zombies: game.zombies.length,
      bullets: game.projectiles.length, suns: game.suns.length, fx: game.effects.length,
      art: Object.keys(G.Assets.anim).length, imgs: Object.keys(G.Assets.img).length,
      audio: Object.keys(G.Assets.audio).length
    });
  };
  /* scripted smoke run: build a lawn, jump to wave 6, report */
  G.plant = function (id, c, r) {
    var i = -1;
    for (var k = 0; k < game.seeds.length; k++) if (game.seeds[k].id === id) i = k;
    if (i < 0) return false;
    game.seeds[i].cd = 0; game.sun = Math.max(game.sun, G.PLANTS[id].cost + 50);
    return game.plantSeed(i, c, r);
  };
  G.zombie = function (type, row) { return game.spawnZombie(type || 'basic', row == null ? 2 : row, { wave: game.wave }); };

  G.selftest = function () {
    game.reset();
    game.state = 'playing';
    game.setSeeds(['sunflower', 'peashooter', 'wallnut', 'snowpea', 'cherrybomb', 'potatomine']);
    game.sun = 9999;
    var role = ['sunflower', 'peashooter', 'wallnut', 'snowpea'];
    var planted = 0;
    for (var c = 0; c < 4; c++) for (var r = 0; r < G.GRID.rows; r++) {
      var si = -1;
      for (var i = 0; i < game.seeds.length; i++) if (game.seeds[i].id === role[c]) si = i;
      game.seeds[si].cd = 0;
      if (g_plant(si, c, r)) planted++;
    }
    game.wave = 6;
    for (var k = 0; k < 12; k++) game.spawnZombie('basic', k % 5, { wave: 6 });
    jslog('selftest planted=' + planted + ' ' + G.debug());
  };
  function g_plant(si, c, r) { return game.plantSeed(si, c, r); }

  function init() {
    canvas = $('game'); ctx = canvas.getContext('2d');
    game = new G.Game();
    G.game = game;
    loadSettings();
    G.Sound.setEnabled(soundOn);
    try { game.best = parseInt(localStorage.getItem('pvz.best') || '0', 10) || 0; } catch (e) {}
    G.Input(canvas, game);

    $('bestscore').textContent = game.best ? '最高分：' + game.best : '';
    show('loading', true);
    G.Assets.load(function (p) {
      var b = $('loadingbar'); if (b) b.style.width = Math.round(p * 100) + '%';
      var t = $('loadingtext'); if (t) t.textContent = '载入素材… ' + Math.round(p * 100) + '%';
    }, function (err) {
      show('loading', false);
      show('start', true);
      if (err) { $('loadingtext').textContent = '素材载入失败：' + err; show('loading', true); }
    });

    $('btn-start').onclick = startRun;
    $('btn-retry').onclick = startRun;
    $('btn-resume').onclick = function () { setPaused(false); };
    $('btn-quit').onclick = function () {
      game.state = 'menu'; show('pause', false); show('start', true);
      $('bestscore').textContent = game.best ? '最高分：' + game.best : '';
      G.Sound.stopMusic();
    };    $('btn-pause').onclick = function () {
      if (game.state === 'playing') setPaused(true); else if (game.state === 'paused') setPaused(false);
    };
    $('btn-seeds').onclick = function () {
      if (game.state === 'choose') { game.closeChooser(); return; }
      if (!game.openChooser(true)) return;
      G.Sound.play('click', 0.5);
    };
    $('btn-settings').onclick = function () {
      if (!$('settings').classList.contains('hidden')) closeSettings(); else openSettings();
    };
    $('btn-settings-close').onclick = closeSettings;
    $('chk-events').onchange = function () {
      G.settings.events = this.checked; saveSettings();
      if (!this.checked) game.eventAt = -1;   /* cancel a pending event immediately too */
    };
    $('btn-sound').onclick = function () {
      soundOn = !soundOn; G.Sound.setEnabled(soundOn);
      G.settings.sound = soundOn; saveSettings();
      this.textContent = soundOn ? '🔊' : '🔇';
      if (soundOn && game.state === 'playing') G.Sound.music('theme');
    };
    $('btn-full').onclick = function () {
      var d = document;
      if (!d.fullscreenElement) { (d.documentElement.requestFullscreen || function () {}); d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(function () {}); }
      else if (d.exitFullscreen) d.exitFullscreen();
    };
    $('rotate').addEventListener('pointerdown', function () { this.classList.add('forced-hidden'); });
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && !G.noPause) setPaused(true);
    });
    window.addEventListener('blur', function () { if (!G.noPause) setPaused(true); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') setPaused(game.state === 'playing');
      if ((e.key === 's' || e.key === 'S') && (game.state === 'playing' || game.state === 'choose')) {
        if (game.state === 'choose') game.closeChooser(); else game.openChooser(true);
      }
      if (e.key === ' ' && game.state === 'playing') { e.preventDefault(); game.collectAllSuns(); }
    });
    fit();
    raf = requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.PvZ = window.PvZ || {});
