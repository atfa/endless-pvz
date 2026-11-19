/* Tiny sound manager: pooled HTMLAudio, mute toggle, one music track. */
(function (G) {
  'use strict';
  var A = G.Assets;
  var S = G.Sound = { enabled: true, musicOn: true, pools: {}, musicEl: null, last: {} };

  S.play = function (name, vol, throttleMs) {
    if (!S.enabled || !A.audio[name]) return;
    var now = Date.now();
    if (throttleMs && S.last[name] && now - S.last[name] < throttleMs) return;
    S.last[name] = now;
    try {
      var src = A.audio[name];
      var pool = S.pools[name] || (S.pools[name] = []);
      var a = null, i;
      for (i = 0; i < pool.length; i++) if (pool[i].paused || pool[i].ended) { a = pool[i]; break; }
      if (!a) {
        if (pool.length > 4) { a = pool[0]; }
        else { a = src.cloneNode(true); pool.push(a); }
      }
      a.currentTime = 0;
      a.volume = Math.max(0, Math.min(1, vol === undefined ? 0.6 : vol));
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  };

  S.music = function (name, loop) {
    if (!S.musicOn || !A.audio[name]) return;
    S.stopMusic();
    try {
      var m = A.audio[name];
      m.loop = loop !== false;
      m.volume = 0.28;
      var p = m.play();
      if (p && p.catch) p.catch(function () {});
      S.musicEl = m;
    } catch (e) {}
  };
  S.stopMusic = function () {
    if (S.musicEl) { try { S.musicEl.pause(); S.musicEl.currentTime = 0; } catch (e) {} S.musicEl = null; }
  };
  S.setEnabled = function (on) {
    S.enabled = on; S.musicOn = on;
    if (!on) S.stopMusic();
  };
})(window.PvZ = window.PvZ || {});
