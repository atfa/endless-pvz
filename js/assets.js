/* Asset loading: manifest -> Image objects + audio elements.  global: PvZ.Assets */
(function (G) {
  'use strict';
  var A = G.Assets = { anim: {}, img: {}, audio: {}, manifest: null, ready: false, base: 'assets/' };

  function img(src) {
    var im = new Image();
    im.src = src;
    return im;
  }

  A.load = function (onProgress, onDone) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', A.base + 'manifest.json', true);
    xhr.onload = function () {
      var m;
      try { m = JSON.parse(xhr.responseText); } catch (e) { onDone('bad manifest'); return; }
      A.manifest = m;
      var jobs = [], k, a;
      for (k in m.anim) for (a in m.anim[k]) jobs.push([k, a, m.anim[k][a]]);
      var imgs = Object.keys(m.images || {}), auds = Object.keys(m.audio || {});
      var total = jobs.length + imgs.length + auds.length, done = 0;
      function tick() { done++; if (onProgress) onProgress(done / total, k); }
      function all() { if (onProgress) onProgress(1, 'done'); A.ready = true; if (onDone) onDone(null); }

      jobs.forEach(function (j) {
        var key = j[0], anim = j[1], info = j[2];
        var im = img(A.base + info.file);
        im.onload = tick; im.onerror = tick;
        A.anim[key] = A.anim[key] || {};
        A.anim[key][anim] = { img: im, info: info };
      });
      imgs.forEach(function (key) {
        var im = img(A.base + m.images[key]);
        im.onload = tick; im.onerror = tick;
        A.img[key] = im;
      });
      auds.forEach(function (key) {
        var au = new Audio(A.base + m.audio[key]);
        au.preload = 'auto';
        au.addEventListener('canplaythrough', tick);
        au.addEventListener('error', tick);
        A.audio[key] = au;
        setTimeout(tick, 6000);   // never block the game on audio
      });
      var waited = 0, iv = setInterval(function () {
        waited++;
        if (done >= total || waited > 60) { clearInterval(iv); all(); }
      }, 200);
    };
    xhr.onerror = function () { onDone('network'); };
    xhr.send();
  };

  /* frame rect for animation `key.anim` at time t (seconds) */
  var FALLBACK = ['idle', 'walk', 'attack', 'ready', 'armed', 'produce', 'boom'];
  function resolve(key, anim) {
    var k = A.anim[key];
    if (!k) return null;
    if (k[anim]) return k[anim];
    for (var i = 0; i < FALLBACK.length; i++) if (k[FALLBACK[i]]) return k[FALLBACK[i]];
    for (var s in k) return k[s];
    return null;
  }
  A.frame = function (key, anim, t) {
    var e = resolve(key, anim);
    if (!e) return null;
    var i = e.info.frames ? Math.floor(t * e.info.fps) % e.info.frames : 0;
    if (i < 0) i += e.info.frames;
    var c = i % e.info.cols, r = Math.floor(i / e.info.cols);
    return { img: e.img, sx: c * e.info.fw, sy: r * e.info.fh, w: e.info.fw, h: e.info.fh,
             frames: e.info.frames, fps: e.info.fps };
  };
  A.size = function (key, anim) {
    var e = resolve(key, anim);
    return e ? { w: e.info.fw, h: e.info.fh } : { w: 64, h: 64 };
  };
  A.has = function (key, anim) { return !!resolve(key, anim); };
})(window.PvZ = window.PvZ || {});
