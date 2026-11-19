/* Input: unified pointer handling for canvas (touch + mouse). */
(function (G) {
  'use strict';
  var GR = G.GRID;

  function toGame(canvas, e) {
    var r = canvas.getBoundingClientRect();
    var cx = (e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX)) || 0;
    var cy = (e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY)) || 0;
    return { x: (cx - r.left) * (G.W / r.width), y: (cy - r.top) * (G.H / r.height) };
  }
  function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  G.Input = function (canvas, game) {
    var R = G.Render;

    function cellAt(p) {
      if (p.x < G.LAWN.left || p.x > G.LAWN.right || p.y < G.LAWN.top || p.y > G.LAWN.bottom) return null;
      return { c: G.colAt(p.x), r: G.rowAt(p.y) };
    }

    function onDown(e) {
      e.preventDefault();
      var p = toGame(canvas, e);
      var g = game;
      if (g.state === 'choose') { chooseTap(p); return; }
      if (g.state !== 'playing') return;

      /* suns first */
      if (g.collectSunAt(p.x, p.y)) return;

      /* HUD */
      var sr = R.sunRect();
      if (inRect(p, sr)) { g.collectAllSuns(); return; }
      for (var i = 0; i < g.seeds.length; i++) {
        if (inRect(p, R.seedRect(i))) {
          var s = g.seeds[i], d = G.PLANTS[s.id];
          if (s.cd > 0) { G.Sound.play('click', 0.3, 60); g.toast(d.name + ' 冷却中', 1.2); return; }
          if (g.sun < d.cost) { G.Sound.play('click', 0.3, 60); g.toast('阳光不足', 1.2); return; }
          g.selected = g.selected === i ? -1 : i;
          g.shovel = false;
          G.Sound.play('click', 0.4, 40);
          return;
        }
      }
      if (inRect(p, R.shovelRect())) {
        g.shovel = !g.shovel; g.selected = -1;
        G.Sound.play('click', 0.4, 40);
        return;
      }

      /* lawn */
      var c = cellAt(p);
      if (!c) return;
      if (g.shovel) { g.shovelAt(c.c, c.r); g.shovel = false; return; }
      if (g.selected >= 0) {
        var ok = g.plantSeed(g.selected, c.c, c.r);
        if (ok) { g.selected = -1; }
        else {
          var d2 = G.PLANTS[g.seeds[g.selected].id];
          if (g.plantAt(c.c, c.r)) g.toast('这里已经有植物了', 1.2);
          else if (g.sun < d2.cost) g.toast('阳光不足', 1.2);
        }
        return;
      }
      /* tap a plant to inspect */
      var pl = g.plantAt(c.c, c.r);
      if (pl) g.toast(G.plantName(pl.id) + '  ' + Math.max(0, Math.round(pl.hp)) + '/' + pl.maxHp, 1.4);
    }

    function chooseTap(p) {
      var g = game, L = G.Render.chooserLayout(g);
      if (g.resumeAfterChoose && inRect(p, L.cancel)) { g.closeChooser(); G.Sound.play('click', 0.4, 20); return; }
      if (inRect(p, L.start)) {
        if (g.pickList.length === g.seedSlots()) {
          g.setSeeds(g.pickList);
          var wasRunning = g.resumeAfterChoose;
          g.closeChooser();
          if (!wasRunning) { g.phase = 'break'; g.phaseT = 6; }
          G.Sound.music('theme');
          G.Sound.play('points', 0.5);
        } else {
          g.toast('请选满 ' + g.seedSlots() + ' 株植物', 1.6);
        }
        return;
      }
      for (var i = 0; i < L.cards.length; i++) {
        if (inRect(p, L.cards[i])) {
          var id = L.cards[i].id, k = g.pickList.indexOf(id);
          if (k >= 0) g.pickList.splice(k, 1);
          else if (g.pickList.length < g.seedSlots()) g.pickList.push(id);
          else g.toast('最多 ' + g.seedSlots() + ' 株，先取消一个', 1.6);
          G.Sound.play('click', 0.4, 40);
          return;
        }
      }
    }

    function onMove(e) {
      var p = toGame(canvas, e);
      game.hover = cellAt(p);
    }

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };
})(window.PvZ = window.PvZ || {});
