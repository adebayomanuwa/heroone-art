/* heroone.art · site-wide player (3nity Auracle deck)
   - one <audio> that survives page changes (pages are swapped in place, the player never reloads)
   - streams from a private bucket via short-lived signed URLs (/api/stream); no download links exist
   - first-party listening stats (/api/collect): play, 30-second stream, quartiles, completion, time listened
   - lock-screen / headphone controls (Media Session), resume after a full reload */
(function () {
  'use strict';
  if (window.__heroPlayer) return;
  var CFG = window.HERO_MUSIC || {};
  var TRACKS = CFG.tracks || [];
  if (!TRACKS.length) return;
  var API = (CFG.api || '/api').replace(/\/$/, '');

  /* ── storage helpers (storage can be blocked: never let that break playback) ── */
  function sget(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function sset(store, k, v) { try { window[store].setItem(k, v); } catch (e) {} }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  /* ── analytics context ── */
  var excluded = sget('localStorage', 'hx_exclude') === '1';       // set on Hero One's own devices by /studio
  var track_on = CFG.analytics !== false && !excluded;
  var sid = sget('sessionStorage', 'hx_sid') || uuid(); sset('sessionStorage', 'hx_sid', sid);
  var gpc = navigator.globalPrivacyControl === true;
  var vid = null;
  if (!gpc) { vid = sget('localStorage', 'hx_vid') || uuid(); sset('localStorage', 'hx_vid', vid); }
  var qs = new URLSearchParams(location.search);
  var firstRef = '';
  try { if (document.referrer && new URL(document.referrer).host !== location.host) firstRef = document.referrer; } catch (e) {}
  var ctx = {
    sid: sid, vid: vid,
    tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || null,
    lang: navigator.language || null,
    screen: screen.width + 'x' + screen.height,
    utm_source: qs.get('utm_source') || sget('sessionStorage', 'hx_utm_source'),
    utm_medium: qs.get('utm_medium') || sget('sessionStorage', 'hx_utm_medium'),
    utm_campaign: qs.get('utm_campaign') || sget('sessionStorage', 'hx_utm_campaign'),
    referrer: firstRef || sget('sessionStorage', 'hx_ref') || null,
  };
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (ctx[k]) sset('sessionStorage', 'hx_' + k, ctx[k]); });
  if (firstRef) sset('sessionStorage', 'hx_ref', firstRef);

  var queue = [];
  function emit(type, extra) {
    if (!track_on) return;
    var e = { type: type, at: Date.now(), page: location.pathname };
    for (var k in extra) e[k] = extra[k];
    queue.push(e);
    if (queue.length >= 20) flush();
  }
  function flush(beacon) {
    if (!queue.length) return;
    var body = JSON.stringify({ ctx: ctx, events: queue.splice(0, 50) });
    var url = API + '/collect';
    if (beacon && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return; } catch (e) {}
    }
    fetch(url, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true, credentials: 'same-origin' })
      .catch(function () {});
  }
  setInterval(function () { flush(false); }, 8000);

  /* ── audio + listen state ── */
  var audio = new Audio();
  audio.preload = 'none';
  audio.setAttribute('controlsList', 'nodownload noplaybackrate');
  audio.setAttribute('disableRemotePlayback', '');
  var idx = 0;
  var listen = null;                 // { id, track, listened, last, fired:{}, stopped }
  var urls = {};                     // track id -> { url, exp }
  var resumeAt = null;
  var retried = false;
  /* Repeat stays off until a listener asks. Off keeps the old behaviour: play the
     catalog in order, then stop. All and One exist so a lyric sheet can be rehearsed. */
  var repeatMode = sget('localStorage', 'hx_repeat');
  if (repeatMode !== 'all' && repeatMode !== 'one') repeatMode = 'off';
  var vol = parseFloat(sget('localStorage', 'hx_vol'));
  if (!isFinite(vol)) vol = 1;
  vol = Math.max(0, Math.min(1, vol));
  var lastVol = vol > 0.001 ? vol : 1;
  var remain = sget('localStorage', 'hx_remain') === '1';
  var lyricsOn = false;
  var lyr = {};
  var lyActive = -1;
  var lyLines = [];
  try { audio.volume = vol; } catch (e) {}

  function T() { return TRACKS[idx]; }
  function newListen(prev) {
    if (prev && prev.id) return { id: prev.id, track: prev.track, listened: prev.listened || 0, last: null, fired: prev.fired || {}, stopped: false };
    return { id: uuid(), track: T().id, listened: 0, last: null, fired: {}, stopped: false };
  }
  function endListen(reason) {
    if (!listen || listen.stopped) return;
    if (listen.fired.play) emit('stop', { track: listen.track, listen: listen.id, pos: audio.currentTime || 0, listened: listen.listened });
    listen.stopped = true;
  }

  function streamUrl(track) {
    var c = urls[track.id];
    if (c && c.exp > Date.now() + 60000) return Promise.resolve(c.url);
    var q = '?t=' + encodeURIComponent(track.id) + '&l=' + encodeURIComponent(listen ? listen.id : '') + '&s=' + encodeURIComponent(sid) + '&p=' + encodeURIComponent(location.pathname);
    return fetch(API + '/stream' + q, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('stream ' + r.status);
      return r.json();
    }).then(function (j) {
      urls[track.id] = { url: j.url, exp: Date.now() + (j.expires_in || 3600) * 1000 };
      return j.url;
    }).catch(function (err) {
      if (CFG.devAudio) return CFG.devAudio.replace('{id}', track.id);   // local development only
      throw err;
    });
  }

  function load(i, autoplay) {
    if (i !== idx || !listen || listen.track !== TRACKS[i].id || listen.stopped) {
      endListen('switch');
      idx = (i + TRACKS.length) % TRACKS.length;
      listen = newListen();
      audio.removeAttribute('src');
      ui.state('idle');
    }
    render();
    if (autoplay) play();
  }

  function play() {
    if (!listen || listen.stopped) listen = newListen();
    var track = T();
    ui.state('loading');
    var srcFor = audio.dataset.track === track.id && audio.getAttribute('src') ? Promise.resolve(null) : streamUrl(track);
    return srcFor.then(function (url) {
      if (url) { audio.src = url; audio.dataset.track = track.id; }
      if (resumeAt != null) {
        var t = resumeAt; resumeAt = null;
        var seekOnce = function () { try { audio.currentTime = t; } catch (e) {} };
        if (audio.readyState >= 1) seekOnce(); else audio.addEventListener('loadedmetadata', seekOnce, { once: true });
      }
      return audio.play();
    }).catch(function (err) {
      if (err && err.name === 'NotAllowedError') { ui.state('paused'); return; }
      ui.state('error');
    });
  }
  function pause() { audio.pause(); }
  function toggle() { if (audio.paused) play(); else pause(); }
  function next() { load(idx + 1, true); }
  function prev() {
    if (audio.currentTime > 4) { audio.currentTime = 0; return; }
    load(idx - 1, true);
  }

  /* playback analytics */
  audio.addEventListener('playing', function () {
    retried = false;
    ui.state('playing');
    if (listen && !listen.fired.play) { listen.fired.play = 1; emit('play', { track: listen.track, listen: listen.id, pos: audio.currentTime }); }
    listen.last = audio.currentTime;
    syncButtons();
  });
  audio.addEventListener('pause', function () {
    if (audio.ended) return;
    ui.state('paused'); syncButtons();
    if (listen && listen.fired.play) emit('pause', { track: listen.track, listen: listen.id, pos: audio.currentTime, listened: listen.listened });
  });
  audio.addEventListener('waiting', function () { ui.state('loading'); });
  var seekTimer = null;
  audio.addEventListener('seeking', function () { if (listen) listen.last = null; });
  audio.addEventListener('seeked', function () {
    syncLyrics(audio.currentTime || 0, true);
    clearTimeout(seekTimer);
    seekTimer = setTimeout(function () {
      if (listen && listen.fired.play) emit('seek', { track: listen.track, listen: listen.id, pos: audio.currentTime });
    }, 700);
  });
  audio.addEventListener('timeupdate', function () {
    ui.progress();
    syncLyrics(audio.currentTime || 0, false);
    if (!listen || audio.paused) return;
    var t = audio.currentTime;
    if (listen.last != null) {
      var dt = t - listen.last;
      if (dt > 0 && dt < 1.5) listen.listened += dt;
    }
    listen.last = t;
    var d = audio.duration, f = listen.fired, base = { track: listen.track, listen: listen.id, pos: t, listened: listen.listened };
    if (!f.s30 && listen.listened >= 30) { f.s30 = 1; emit('stream_30s', base); }
    if (d && isFinite(d)) {
      var p = t / d;
      if (!f.q25 && p >= 0.25) { f.q25 = 1; emit('q25', base); }
      if (!f.q50 && p >= 0.50) { f.q50 = 1; emit('q50', base); }
      if (!f.q75 && p >= 0.75) { f.q75 = 1; emit('q75', base); }
      if (!f.done && p >= 0.90 && listen.listened >= d * 0.5) { f.done = 1; emit('complete', base); }   // reached the end and heard most of it
    }
  });
  audio.addEventListener('ended', function () {
    endListen('ended'); flush(false);
    if (repeatMode === 'one') { replay(); return; }
    if (idx < TRACKS.length - 1) next();
    else if (repeatMode === 'all') load(0, true);
    else { ui.state('paused'); syncButtons(); }
  });
  function replay() {
    listen = newListen();
    try { audio.currentTime = 0; } catch (e) {}
    play();
  }
  audio.addEventListener('error', function () {
    // signed URL expired (or network blip): fetch a fresh one once and carry on from the same spot
    if (retried) { ui.state('error'); return; }
    retried = true;
    var at = audio.currentTime || 0;
    delete urls[T().id];
    audio.removeAttribute('src'); audio.dataset.track = '';
    resumeAt = at; play();
  });

  /* ── UI: the 3nity Auracle deck ──────────────────────────────────────────
     Dock (always there), Deck (the expanded HEAD stage), Pill (minimised face).
     The HEAD rig and DivineTouch field are ports of 333Bi Tech's AuracleHead /
     DivineField: the visor, eyes and headset react to the record through a
     loudness envelope measured offline (assets/music/<id>.json), so it works on
     every device with no Web Audio, no CORS and no extra decoding.            */
  var root, el = {}, data = {}, level = 0, avg = 0, lastPulse = 0, pulseN = 0, raf = 0, lastDraw = -1;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var EYE_L = [163, 331, 30, 16], EYE_R = [313, 300, 33, 17], CUP = [455, 258, 42], VISOR = [239, 279, 162, 112];
  var IMG = '/assets/img/auracle/';

  function fmt(s) { if (!isFinite(s) || s < 0) s = 0; var m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + (x < 10 ? '0' : '') + x; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function icon(name) {
    var p = {
      play: '<path d="M8 5.2v13.6L19 12z"/>',
      pause: '<path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.6z"/>',
      prev: '<path d="M6 6h2v12H6zM9.5 12 19 18V6z"/>',
      next: '<path d="M16 6h2v12h-2zM5 6v12l9.5-6z"/>',
      min: '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
      expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      lyrics: '<path d="M5 6.5h14M5 12h14M5 17.5h9" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
      repeat: '<path d="M17 2.5 21 6.5 17 10.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11.5V9.2A3.2 3.2 0 0 1 6.2 6H21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7 21.5 3 17.5 7 13.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12.5v2.3a3.2 3.2 0 0 1-3.2 3.2H3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      vol: '<path d="M4 9.5h2.8L11 6v12l-4.2-3.5H4z"/><path d="M14.2 9.2a3.4 3.4 0 0 1 0 5.6M16.6 7a6.2 6.2 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      mute: '<path d="M4 9.5h2.8L11 6v12l-4.2-3.5H4z"/><path d="M15 10l5 5M20 10l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    }[name];
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' + p + '</svg>';
  }

  /* DivineTouch field: nine {n/k} star polygons woven into a sphere (pure CSS 3D) */
  function starPath(n, k, R, rot) {
    var pts = [], out = [], g = (function (a, b) { while (b) { var t = b; b = a % b; a = t; } return a; })(n, k);
    for (var i = 0; i < n; i++) { var t = 2 * Math.PI * i / n + rot; pts.push([256 + R * Math.cos(t), 256 + R * Math.sin(t)]); }
    for (var s = 0; s < g; s++) {
      var seg = [], j = s;
      do { seg.push(pts[j][0].toFixed(1) + ' ' + pts[j][1].toFixed(1)); j = (j + k) % n; } while (j !== s);
      out.push('M' + seg.join(' L') + ' Z');
    }
    return out.join(' ');
  }
  function fieldHTML() {
    var CY = '#4ff0e0', MID = '#2b9fe0', IND = '#2d4a7a';
    var R = [[16, 6, 240, 0, 0, 0, IND, .45, 1.1, 74], [14, 5, 224, .22, -44, -28, IND, .5, 1, -58], [16, 7, 228, .1, -44, 28, MID, .55, 1.1, 46],
      [24, 10, 200, 0, 44, -28, MID, .55, .9, -38], [32, 14, 176, 0, 44, 28, CY, .85, .8, 30], [28, 12, 190, .05, 0, -44, CY, .65, .8, -34],
      [24, 10, 208, .13, 0, 44, MID, .5, .9, 42], [16, 7, 232, .3, -32, 0, IND, .45, 1.1, -54], [16, 6, 244, .196, 32, 0, CY, .35, 1, 66]];
    return '<div class="dtf" data-state="dormant" aria-hidden="true"><div class="dtf-stage"><div class="dtf-stack">' + R.map(function (r, i) {
      return '<div class="dtf-depth" style="transform:rotateX(' + r[4] + 'deg) rotateY(' + r[5] + 'deg)"><svg class="dtf-ring" viewBox="0 0 512 512" style="--dtf-spin:' + Math.abs(r[9]) + 's;--dtf-o:' + r[7] + ';--dtf-delay:' + (i * .09).toFixed(2) + 's;opacity:' + r[7] + (r[9] < 0 ? ';animation-direction:reverse' : '') + '"><path d="' + starPath(r[0], r[1], r[2], r[3]) + '" stroke="' + r[6] + '" stroke-width="' + r[8] + '"/></svg></div>';
    }).join('') + '</div></div></div>';
  }
  /* The HEAD rig (only accepted brand mark): severity tints the visor only */
  function headHTML(px) {
    px = px || 'hx';
    return '<div class="ah" data-state="idle" data-severity="info" role="img" aria-label="3nity Auracle">' +
      '<div class="ah-rig"><div class="ah-stage"><div class="ah-body">' +
        '<img class="ah-base" src="' + IMG + 'auracle-head-clean-512.webp" alt="" decoding="async" width="512" height="512">' +
        '<img class="ah-visor" src="' + IMG + 'auracle-head-visor-tight-512.webp" alt="" decoding="async" width="512" height="512">' +
        '<svg class="ah-fx" viewBox="0 0 512 512" aria-hidden="true"><defs>' +
          '<radialGradient id="' + px + '-eye"><stop offset="0" stop-color="#ffdca8" stop-opacity=".95"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>' +
          '<filter id="' + px + '-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>' +
          '<clipPath id="' + px + '-visor"><ellipse cx="' + VISOR[0] + '" cy="' + VISOR[1] + '" rx="' + VISOR[2] + '" ry="' + VISOR[3] + '"/></clipPath>' +
          '<linearGradient id="' + px + '-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ff0e0" stop-opacity="0"/><stop offset=".5" stop-color="#b6fff6" stop-opacity=".5"/><stop offset="1" stop-color="#4ff0e0" stop-opacity="0"/></linearGradient>' +
        '</defs>' +
        '<g clip-path="url(#' + px + '-visor)"><g class="ah-hud" stroke="#4ff0e0" stroke-width=".8" stroke-opacity=".35" fill="none"><path d="M80 200H400M80 240H400M80 280H400M80 320H400M80 360H400"/><path d="M120 160V400M180 160V400M240 160V400M300 160V400M360 160V400"/></g>' +
          '<rect class="ah-scan" x="60" y="150" width="360" height="46" fill="url(#' + px + '-scan)"/></g>' +
        '<g class="ah-eyes" filter="url(#' + px + '-soft)"><ellipse cx="' + EYE_L[0] + '" cy="' + EYE_L[1] + '" rx="' + EYE_L[2] + '" ry="' + EYE_L[3] + '" fill="url(#' + px + '-eye)"/><ellipse cx="' + EYE_R[0] + '" cy="' + EYE_R[1] + '" rx="' + EYE_R[2] + '" ry="' + EYE_R[3] + '" fill="url(#' + px + '-eye)"/></g>' +
        '<g class="ah-headset"><circle class="ah-cup" cx="' + CUP[0] + '" cy="' + CUP[1] + '" r="' + CUP[2] + '"/>' +
          [0, .46, .92].map(function (d) { return '<circle class="ah-pulse" style="--ah-d:' + d + 's" cx="' + CUP[0] + '" cy="' + CUP[1] + '" r="' + CUP[2] + '"/>'; }).join('') +
        '</g></svg>' +
      '</div></div></div></div>';
  }
  function waveHTML(cls, label) {
    return '<div class="hx-wave ' + cls + '" role="slider" tabindex="0" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0:00">' +
      '<canvas aria-hidden="true"></canvas><span class="hx-wave-tip" aria-hidden="true">0:00</span></div>';
  }

  function build() {
    root = document.createElement('div');
    root.id = 'hx-persist';
    var n = TRACKS.length;
    root.innerHTML =
      '<section class="hx-dock" aria-label="Hero One player">' +
        '<button class="hx-art" type="button" aria-label="Open now playing"><img alt="" width="52" height="52"></button>' +
        '<div class="hx-meta"><strong class="hx-title"></strong><span class="hx-sub"><i class="hx-led" aria-hidden="true"></i><span class="hx-sub-t"></span></span></div>' +
        waveHTML('hx-wave--dock', 'Seek') +
        '<span class="hx-time" aria-hidden="true">0:00</span>' +
        '<div class="hx-controls">' +
          '<button class="hx-btn hx-prev" type="button" aria-label="Previous">' + icon('prev') + '</button>' +
          '<button class="hx-btn hx-play" type="button" aria-label="Play">' + icon('play') + '<span class="hx-spin" aria-hidden="true"></span></button>' +
          '<button class="hx-btn hx-next" type="button" aria-label="Next">' + icon('next') + '</button>' +
        '</div>' +
        '<button class="hx-btn hx-lyrics-dock" type="button" aria-pressed="false" aria-label="Show lyrics">' + icon('lyrics') + '</button>' +
        '<span class="hx-vu" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
        '<button class="hx-face" type="button" aria-label="Open the 3nity Auracle deck" aria-haspopup="dialog"><img src="' + IMG + 'auracle-face-160.webp" alt="" width="40" height="40"></button>' +
        '<button class="hx-btn hx-min" type="button" aria-label="Minimise player">' + icon('min') + '</button>' +
      '</section>' +

      '<div class="hx-deck" role="dialog" aria-modal="true" aria-label="Now playing" hidden>' +
        '<div class="hx-deck-amb" aria-hidden="true"><img alt=""></div>' +
        '<div class="hx-deck-panel">' +
          '<header class="hx-deck-head"><span class="hx-kicker"><i class="hx-led" aria-hidden="true"></i>3nity Auracle <b>·</b> Now playing</span>' +
            '<button class="hx-btn hx-close" type="button" aria-label="Close">' + icon('close') + '</button></header>' +
          '<div class="hx-stage">' + fieldHTML() + '<div class="hx-head">' + headHTML() + '</div>' +
            '<div class="hx-readout" aria-hidden="true"><span>State <b class="ro-state">IDLE</b></span><span>Signal <b class="ro-sig">000</b></span><span>Field <b class="ro-trk">DORMANT</b></span></div>' +
            '<div class="hx-lyrics" hidden>' +
              '<div class="hx-ly-bar">' +
                '<div class="hx-ly-id"><span class="hx-ly-kicker">Lyrics</span></div>' +
                '<div class="hx-ly-tools"><button class="hx-tool hx-ly-copy" type="button">Copy</button><button class="hx-tool hx-ly-back" type="button">Show stage</button></div>' +
              '</div>' +
              '<div class="hx-ly-scroll" tabindex="0" aria-label="Lyrics"></div>' +
            '</div>' +
          '</div>' +
          '<div class="hx-np">' +
            '<div class="hx-np-top"><img class="hx-np-art" alt="" width="512" height="512">' +
              '<div class="hx-np-id"><span class="hx-np-no">Beats &amp; Blues</span><h2 class="hx-np-title"></h2><p class="hx-np-sub"></p><p class="hx-np-artist"></p></div></div>' +
            waveHTML('hx-wave--deck', 'Seek') +
            '<div class="hx-np-times"><span class="hx-np-cur" aria-hidden="true">0:00</span><button class="hx-np-dur" type="button" aria-label="Show time remaining">0:00</button></div>' +
            '<div class="hx-np-ctl">' +
              '<button class="hx-btn hx-prev" type="button" aria-label="Previous">' + icon('prev') + '</button>' +
              '<button class="hx-btn hx-play hx-play--xl" type="button" aria-label="Play">' + icon('play') + '<span class="hx-spin" aria-hidden="true"></span></button>' +
              '<button class="hx-btn hx-next" type="button" aria-label="Next">' + icon('next') + '</button>' +
            '</div>' +
            '<div class="hx-np-tools">' +
              '<button class="hx-tool hx-lyrics" type="button" aria-pressed="false" aria-label="Show lyrics">' + icon('lyrics') + 'Lyrics</button>' +
              '<button class="hx-tool hx-repeat" type="button" aria-pressed="false">' + icon('repeat') + '<span class="hx-repeat-l">Off</span></button>' +
              '<div class="hx-vol"><button class="hx-btn hx-mute" type="button" aria-label="Mute">' + icon('vol') + '</button>' +
                '<input class="hx-vol-range" type="range" min="0" max="1" step="0.01" value="' + vol + '" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"></div>' +
            '</div>' +
            '<nav class="hx-np-links" aria-label="About this record"><a class="hx-l-song" href="/music/">The song</a><a class="hx-l-credits" href="/music/credits/">Credits</a><a class="hx-l-press" href="/music/press/">Press release</a></nav>' +
            '<p class="hx-q-label">Records</p>' +
            '<ol class="hx-q">' + TRACKS.map(function (t, i) {
              return '<li><button type="button" data-i="' + i + '"><span class="hx-q-no" aria-hidden="true"></span><img src="' + t.cover + '" alt="" width="40" height="40"><span class="hx-q-t"><strong>' + t.full + '</strong><em>' + t.artist + '</em></span><span class="hx-q-d" data-dur="' + t.id + '"></span></button></li>';
            }).join('') + '</ol>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<button class="hx-pill" type="button" aria-label="Open player"><svg class="hx-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30"/><circle class="hx-ring-p" cx="32" cy="32" r="30"/></svg><img src="' + IMG + 'auracle-face-160.webp" alt="" width="60" height="60"><span class="hx-pill-icon">' + icon('play') + '</span></button>';
    document.body.appendChild(root);

    el.dock = root.querySelector('.hx-dock'); el.deck = root.querySelector('.hx-deck'); el.pill = root.querySelector('.hx-pill');
    el.art = root.querySelector('.hx-art'); el.artImg = el.art.querySelector('img');
    el.title = root.querySelector('.hx-title'); el.sub = root.querySelector('.hx-sub-t'); el.time = root.querySelector('.hx-time');
    el.plays = root.querySelectorAll('.hx-play'); el.vu = root.querySelectorAll('.hx-vu i');
    el.waves = Array.prototype.slice.call(root.querySelectorAll('.hx-wave'));
    el.ah = root.querySelector('.ah'); el.dtf = root.querySelector('.dtf'); el.rig = root.querySelector('.ah-rig');
    el.eyes = root.querySelector('.ah-eyes'); el.pulses = root.querySelectorAll('.ah-pulse');
    el.roState = root.querySelector('.ro-state'); el.roSig = root.querySelector('.ro-sig'); el.roTrk = root.querySelector('.ro-trk');
    el.npArt = root.querySelector('.hx-np-art'); el.npTitle = root.querySelector('.hx-np-title'); el.npArtist = root.querySelector('.hx-np-artist'); el.npSub = root.querySelector('.hx-np-sub'); el.npNo = root.querySelector('.hx-np-no');
    el.npCur = root.querySelector('.hx-np-cur'); el.npDur = root.querySelector('.hx-np-dur'); el.amb = root.querySelector('.hx-deck-amb img');
    el.credits = root.querySelector('.hx-l-credits'); el.song = root.querySelector('.hx-l-song'); el.press = root.querySelector('.hx-l-press'); el.q = root.querySelector('.hx-q');
    el.ringP = root.querySelector('.hx-ring-p'); el.pillIcon = root.querySelector('.hx-pill-icon');
    el.stage = root.querySelector('.hx-stage'); el.ly = root.querySelector('.hx-lyrics'); el.lyScroll = root.querySelector('.hx-ly-scroll');
    el.lyCopy = root.querySelector('.hx-ly-copy');
    el.lyBtn = root.querySelector('.hx-np-tools .hx-lyrics'); el.lyDock = root.querySelector('.hx-lyrics-dock');
    el.repeat = root.querySelector('.hx-repeat'); el.vol = root.querySelector('.hx-vol-range'); el.mute = root.querySelector('.hx-mute');

    root.querySelectorAll('.hx-play').forEach(function (b) { b.addEventListener('click', toggle); });
    root.querySelectorAll('.hx-prev').forEach(function (b) { b.addEventListener('click', prev); });
    root.querySelectorAll('.hx-next').forEach(function (b) { b.addEventListener('click', next); });
    el.art.addEventListener('click', function () { openLyrics(false); openDeck(true); });
    root.querySelector('.hx-face').addEventListener('click', function () { openLyrics(false); openDeck(true); });
    root.querySelector('.hx-close').addEventListener('click', function () { openDeck(false); });
    root.querySelector('.hx-min').addEventListener('click', function () { setMin(true); });
    el.pill.addEventListener('click', function () { setMin(false); });
    el.deck.addEventListener('click', function (e) { if (e.target === el.deck) openDeck(false); });
    el.deck.querySelector('.hx-np-links').addEventListener('click', function (e) { if (e.target.closest('a')) openDeck(false, { keepUrl: true }); });
    el.lyBtn.addEventListener('click', function () { openLyrics(!lyricsOn); if (el.deck.hidden) openDeck(true); });
    el.lyDock.addEventListener('click', function () { openLyrics(true); openDeck(true); });
    root.querySelector('.hx-ly-back').addEventListener('click', function () { openLyrics(false); });
    el.lyCopy.addEventListener('click', copyLyrics);
    el.lyScroll.addEventListener('click', function (e) {
      var line = e.target.closest('.hx-ly-line');
      if (!line || line.dataset.t == null) return;
      var t = parseFloat(line.dataset.t);
      if (!isFinite(t)) return;
      try { audio.currentTime = t; } catch (err) {}
      syncLyrics(t, true);
      ui.progress();
      drawWaves(true);
    });
    el.lyScroll.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var line = e.target.closest('.hx-ly-line');
      if (!line || line.dataset.t == null) return;
      e.preventDefault();
      line.click();
    });
    el.repeat.addEventListener('click', cycleRepeat);
    el.mute.addEventListener('click', function () { setVol(vol > 0.001 ? 0 : lastVol); });
    el.vol.addEventListener('input', function () { setVol(parseFloat(el.vol.value)); });
    el.npDur.addEventListener('click', function () {
      remain = !remain;
      sset('localStorage', 'hx_remain', remain ? '1' : '0');
      ui.progress();
    });
    el.q.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]'); if (!b) return;
      var i = +b.dataset.i; if (i === idx && !audio.paused) return; load(i, true);
    });
    document.addEventListener('keydown', function (e) {
      if (el.deck.hidden) return;
      var field = document.activeElement;
      var typing = field && (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA' || field.isContentEditable);
      if (e.key === 'Escape') { e.preventDefault(); openDeck(false); }
      else if (e.key === 'Tab') {                                   // keep focus inside the dialog
        var f = Array.prototype.slice.call(el.deck.querySelectorAll('button,a[href],input,[tabindex="0"]')).filter(function (x) { return !x.disabled && x.offsetParent; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      } else if (!typing && (e.key === 'l' || e.key === 'L') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openLyrics(!lyricsOn); }
      else if (!typing && (e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); cycleRepeat(); }
      else if (e.key === ' ' && field && !typing && field !== el.lyScroll && !field.classList.contains('hx-ly-line') && !/^(BUTTON|A|INPUT)$/.test(field.tagName) && field.getAttribute('role') !== 'slider') { e.preventDefault(); toggle(); }
    });
    el.deck.addEventListener('pointermove', function (e) {
      if (reduce.matches || lyricsOn) return;
      var r = el.rig.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth, y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      el.rig.style.setProperty('--tilt-y', (x * 22).toFixed(2) + 'deg'); el.rig.style.setProperty('--tilt-x', (-y * 16).toFixed(2) + 'deg');
      el.rig.style.setProperty('--look-x', (x * 10).toFixed(2) + 'px'); el.rig.style.setProperty('--look-y', (y * 6).toFixed(2) + 'px');
    }, { passive: true });
    el.waves.forEach(bindWave);
    window.addEventListener('resize', function () { lastDraw = -1; drawWaves(true); });
    setMin(sget('localStorage', 'hx_min') === '1', true);
    paintRepeat(); paintVol();
    TRACKS.forEach(function (t) { getData(t.id); });
  }

  /* Lyrics are plain text. Optional line start times live at
     /assets/music/<id>.times.json (seconds, one entry per non-empty line).
     When times match, the player highlights and scrolls the current line. */
  function parseLyrics(raw) {
    var stanzas = [], cur = [], n = 0;
    String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').forEach(function (line) {
      if (!line.trim()) { if (cur.length) { stanzas.push(cur); cur = []; } }
      else { cur.push(line.trim()); n += 1; }
    });
    if (cur.length) stanzas.push(cur);
    return { stanzas: stanzas, lineCount: n, text: stanzas.map(function (s) { return s.join('\n'); }).join('\n\n') };
  }
  function lineIndexAt(t, times) {
    if (!times || !times.length || t < times[0]) return -1;
    var i = 0;
    while (i + 1 < times.length && times[i + 1] <= t) i += 1;
    return i;
  }
  function syncLyrics(t, force) {
    if (!lyricsOn || !lyLines.length) return;
    var pack = lyr[T().id];
    if (!pack || !pack.times) return;
    var i = lineIndexAt(t, pack.times);
    if (i === lyActive && !force) return;
    if (lyActive >= 0 && lyLines[lyActive]) lyLines[lyActive].classList.remove('is-active');
    lyActive = i;
    if (i < 0 || !lyLines[i]) return;
    var node = lyLines[i];
    node.classList.add('is-active');
    var sc = el.lyScroll, nr = node.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    if (nr.top < sr.top + 20 || nr.bottom > sr.bottom - 20) {
      try { node.scrollIntoView({ block: 'center', behavior: reduce.matches ? 'auto' : 'smooth' }); }
      catch (e) { node.scrollIntoView(true); }
    }
  }
  function paintLyrics(pack) {
    el.lyScroll.replaceChildren();
    el.lyScroll.classList.remove('is-timed');
    lyActive = -1;
    lyLines = [];
    if (pack === 'loading') {
      var wait = document.createElement('p');
      wait.className = 'hx-ly-loading';
      wait.textContent = 'Loading lyrics…';
      el.lyScroll.appendChild(wait);
      el.lyCopy.disabled = true;
      return;
    }
    if (!pack || !pack.stanzas.length) {
      var empty = document.createElement('p');
      empty.className = 'hx-ly-empty';
      empty.textContent = 'Lyrics are not available for this record yet.';
      el.lyScroll.appendChild(empty);
      el.lyCopy.disabled = true;
      return;
    }
    var timed = Array.isArray(pack.times) && pack.times.length === pack.lineCount;
    if (timed) el.lyScroll.classList.add('is-timed');
    pack.stanzas.forEach(function (lines) {
      var stanza = document.createElement('p');
      stanza.className = 'hx-ly-stanza';
      lines.forEach(function (line, i) {
        if (i) stanza.appendChild(document.createElement('br'));
        var span = document.createElement('span');
        span.className = 'hx-ly-line';
        span.textContent = line;
        if (timed) {
          span.dataset.t = String(pack.times[lyLines.length]);
          span.tabIndex = 0;
          span.setAttribute('role', 'button');
        }
        stanza.appendChild(span);
        lyLines.push(span);
      });
      el.lyScroll.appendChild(stanza);
    });
    el.lyCopy.disabled = false;
    el.lyScroll.scrollTop = 0;
    if (timed) syncLyrics(audio.currentTime || 0, true);
  }
  function ensureLyrics(track) {
    if (!track.lyrics) { paintLyrics(null); return; }
    if (lyr[track.id]) { paintLyrics(lyr[track.id]); return; }
    paintLyrics('loading');
    var textUrl = new URL(track.lyrics, location.origin).href;
    var timesUrl = new URL(track.lyricsTimes || ('/assets/music/' + track.id + '.times.json'), location.origin).href;
    var textP = fetch(textUrl, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('lyrics');
      return r.text();
    });
    var timesP = fetch(timesUrl, { credentials: 'same-origin' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).catch(function () { return null; });
    Promise.all([textP, timesP]).then(function (parts) {
      var pack = parseLyrics(parts[0]);
      var times = parts[1];
      if (Array.isArray(times) && times.length === pack.lineCount) pack.times = times.map(Number);
      lyr[track.id] = pack;
      if (lyricsOn && T().id === track.id) paintLyrics(lyr[track.id]);
    }).catch(function () {
      delete lyr[track.id];
      if (lyricsOn && T().id === track.id) paintLyrics(null);
    });
  }
  function openLyrics(on) {
    lyricsOn = !!on;
    el.stage.classList.toggle('is-lyrics', lyricsOn);
    el.ly.hidden = !lyricsOn;
    [el.lyBtn, el.lyDock].forEach(function (b) {
      b.setAttribute('aria-pressed', lyricsOn ? 'true' : 'false');
      b.setAttribute('aria-label', lyricsOn ? 'Hide lyrics' : 'Show lyrics');
    });
    if (lyricsOn) { ensureLyrics(T()); lastDraw = -1; drawWaves(true); }
  }
  function copyLyrics() {
    var track = T(), pack = lyr[track.id];
    if (!pack || !pack.text) return;
    var full = track.full + '\n' + track.artist + '\n\n' + pack.text;
    var done = function () {
      el.lyCopy.textContent = 'Copied';
      setTimeout(function () { if (el.lyCopy) el.lyCopy.textContent = 'Copy'; }, 1600);
    };
    var legacy = function () {
      var ta = document.createElement('textarea');
      ta.value = full; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.left = '-999px';
      document.body.appendChild(ta); ta.select();
      try { if (document.execCommand('copy')) done(); } catch (e) {}
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(full).then(done, legacy);
    else legacy();
  }
  function cycleRepeat() {
    repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    sset('localStorage', 'hx_repeat', repeatMode);
    paintRepeat();
  }
  function paintRepeat() {
    if (!el.repeat) return;
    var label = { off: 'Off', all: 'All', one: 'One' };
    var name = {
      off: 'Repeat is off. Repeat every record.',
      all: 'Repeating every record. Repeat this record.',
      one: 'Repeating this record. Turn repeat off.',
    };
    el.repeat.querySelector('.hx-repeat-l').textContent = label[repeatMode];
    el.repeat.setAttribute('aria-label', name[repeatMode]);
    el.repeat.setAttribute('aria-pressed', repeatMode === 'off' ? 'false' : 'true');
    el.repeat.dataset.mode = repeatMode;
  }
  function setVol(v) {
    v = Math.max(0, Math.min(1, +v || 0));
    vol = v;
    if (v > 0.001) lastVol = v;
    try { audio.volume = v; } catch (e) {}
    sset('localStorage', 'hx_vol', String(Math.round(v * 100) / 100));
    paintVol();
  }
  function paintVol() {
    if (!el.vol) return;
    var pct = Math.round(vol * 100);
    if (document.activeElement !== el.vol) el.vol.value = String(vol);
    el.vol.style.setProperty('--hx-vol', pct + '%');
    el.vol.setAttribute('aria-valuenow', String(pct));
    el.vol.setAttribute('aria-valuetext', pct + ' percent');
    el.mute.setAttribute('aria-label', vol > 0.001 ? 'Mute' : 'Unmute');
    el.mute.setAttribute('aria-pressed', vol > 0.001 ? 'false' : 'true');
    el.mute.innerHTML = icon(vol > 0.001 ? 'vol' : 'mute');
  }

  /* waveform scrubber (real peaks of the master) */
  function bindWave(w) {
    var tip = w.querySelector('.hx-wave-tip'), dragging = false;
    function frac(e) { var r = w.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }
    function dur() { var d = audio.duration; if (d && isFinite(d)) return d; var x = data[T().id]; return x ? x.duration : 0; }
    function seekTo(f) {
      var d = dur(); if (!d) return;
      if (!audio.getAttribute('src')) { resumeAt = f * d; play(); return; }
      audio.currentTime = f * d; ui.progress(); drawWaves(true);
    }
    w.addEventListener('pointerdown', function (e) { dragging = true; w.setPointerCapture(e.pointerId); seekTo(frac(e)); });
    w.addEventListener('pointermove', function (e) {
      var f = frac(e); w.style.setProperty('--hx-hover', f); tip.textContent = fmt(f * dur()); w.classList.add('is-hover'); w._hover = f; drawWave(w, true);
      if (dragging) seekTo(f);
    });
    w.addEventListener('pointerup', function () { dragging = false; });
    w.addEventListener('pointerleave', function () { w.classList.remove('is-hover'); w._hover = null; drawWave(w, true); });
    w.addEventListener('keydown', function (e) {
      var d = dur(), t = audio.currentTime || 0, k = e.key;
      if (!d) return;
      if (k === 'ArrowRight' || k === 'ArrowUp') t += 5; else if (k === 'ArrowLeft' || k === 'ArrowDown') t -= 5;
      else if (k === 'PageUp') t += 30; else if (k === 'PageDown') t -= 30; else if (k === 'Home') t = 0; else if (k === 'End') t = d - 1; else return;
      e.preventDefault(); seekTo(Math.max(0, Math.min(d, t)) / d);
    });
  }
  function drawWave(w, force) {
    var c = w.querySelector('canvas'), rect = w.getBoundingClientRect();
    if (!rect.width) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(rect.width * dpr), H = Math.round(rect.height * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    var g = c.getContext('2d'), x = data[T().id], d = audio.duration && isFinite(audio.duration) ? audio.duration : (x ? x.duration : 0);
    var p = d ? Math.min(1, (audio.currentTime || 0) / d) : 0, deck = w.classList.contains('hx-wave--deck');
    var bw = (deck ? 3 : 2) * dpr, gap = (deck ? 2 : 2) * dpr, bars = Math.max(8, Math.floor((W + gap) / (bw + gap)));
    g.clearRect(0, 0, W, H);
    var grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#8e6d27'); grad.addColorStop(.5, '#c9a84c'); grad.addColorStop(1, '#ecd28a');
    var hov = w._hover;
    for (var i = 0; i < bars; i++) {
      var f = i / bars, v = .08;
      if (x) { var a = Math.floor(f * x.peaks.length), b = Math.max(a + 1, Math.floor((i + 1) / bars * x.peaks.length)), m = 0; for (var j = a; j < b; j++) m = Math.max(m, x.peaks[j]); v = Math.max(.06, m / 100); }
      var h = Math.max(2 * dpr, v * H * .92), y = (H - h) / 2, X = i * (bw + gap);
      g.fillStyle = f < p ? grad : (hov != null && f < hov ? 'rgba(236,210,138,.38)' : 'rgba(240,242,248,.17)');
      if (g.roundRect) { g.beginPath(); g.roundRect(X, y, bw, h, bw / 2); g.fill(); } else g.fillRect(X, y, bw, h);
    }
    w.setAttribute('aria-valuenow', Math.round(p * 100));
    w.setAttribute('aria-valuetext', fmt(audio.currentTime || 0) + ' of ' + fmt(d));
  }
  function drawWaves(force) {
    var px = Math.round(((audio.currentTime || 0) / (audio.duration || 1)) * 600);
    if (!force && px === lastDraw) return; lastDraw = px;
    el.waves.forEach(function (w) { if (w.offsetParent) drawWave(w); });
  }
  function getData(id) {
    if (data[id] !== undefined) return;
    data[id] = null;
    fetch('/assets/music/' + id + '.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) { delete data[id]; return; }
      var bin = atob(j.env), env = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) env[i] = bin.charCodeAt(i);
      j.env = env; data[id] = j;
      var q = root.querySelector('[data-dur="' + id + '"]'); if (q) q.textContent = fmt(j.duration);
      if (T().id === id) { ui.progress(); drawWaves(true); }
    }).catch(function () { delete data[id]; });
  }

  /* the record drives the HEAD: eyes, visor, headset pulses, VU, field */
  function tick() {
    raf = 0;
    var x = data[T().id], playing = !audio.paused;
    var target = 0;
    if (x && playing) { var k = Math.floor((audio.currentTime || 0) * x.envHz); target = (x.env[k] || 0) / 255; }
    level += (target - level) * (target > level ? .55 : .18);
    avg += (level - avg) * .04;
    root.style.setProperty('--hx-level', level.toFixed(3));
    for (var i = 0; i < el.vu.length; i++) {
      var off = x && playing ? (x.env[Math.floor((audio.currentTime || 0) * x.envHz) - i * 2] || 0) / 255 : 0;
      el.vu[i].style.transform = 'scaleY(' + Math.max(.12, playing ? (level * .6 + off * .4) * (1 - i * .08) : .12).toFixed(3) + ')';
    }
    if (!el.deck.hidden) {
      el.eyes.style.opacity = (playing ? .38 + level * .62 : '').toString();
      el.roSig.textContent = ('00' + Math.round(level * 100)).slice(-3);
      var now = performance.now();
      if (playing && !reduce.matches && level - avg > .18 && now - lastPulse > 280) {
        lastPulse = now;
        var c = el.pulses[pulseN++ % el.pulses.length];
        c.classList.remove('is-beat'); void c.getBoundingClientRect(); c.classList.add('is-beat');
      }
    }
    drawWaves(false);
    if (playing && document.visibilityState === 'visible') raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  var booted = sget('sessionStorage', 'hx_boot') === '1', lastFocus = null;
  /* The deck has its own address: /now-playing/<song>/. Opening it pushes that URL;
     closing goes back. A direct visit to /now-playing/<song>/ lands on the deck. */
  function deckUrl() { var t = T(); return t.slug ? '/now-playing/' + t.slug + '/' : null; }
  function openDeck(on, opt) {
    opt = opt || {};
    if (on === !el.deck.hidden) return;
    if (on) {
      lastFocus = document.activeElement;
      el.deck.hidden = false;
      document.documentElement.classList.add('hx-deck-open');
      requestAnimationFrame(function () { el.deck.classList.add('is-open'); });
      if (!booted && !reduce.matches) {                        // the 3-second HEAD boot, once per session
        booted = true; sset('sessionStorage', 'hx_boot', '1');
        el.ah.classList.add('is-boot'); setTimeout(function () { el.ah.classList.remove('is-boot'); }, 3000);
      }
      var u = deckUrl();
      if (!opt.silent && u && location.pathname !== u) { try { history.pushState({ hxDeck: 1 }, '', u); } catch (e) {} }
      lastDraw = -1; drawWaves(true); kick();
      setTimeout(function () { root.querySelector('.hx-deck .hx-play').focus({ preventScroll: true }); }, 30);
    } else {
      el.deck.classList.remove('is-open');
      document.documentElement.classList.remove('hx-deck-open');
      setTimeout(function () { el.deck.hidden = true; }, reduce.matches ? 0 : 280);
      if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      if (opt.silent || opt.keepUrl) return;
      var np = document.body.getAttribute('data-now-playing');
      if (history.state && history.state.hxDeck && !np) { history.back(); return; }     // back to the page underneath
      if (np) swap(document.body.getAttribute('data-song-page') || '/music/', true);   // landed on /now-playing/: go to the song
    }
  }
  function setMin(on, silent) {
    root.classList.toggle('is-min', on);
    document.documentElement.classList.toggle('hx-has-dock', !on);
    if (!silent) sset('localStorage', 'hx_min', on ? '1' : '0');
    if (!on) { lastDraw = -1; setTimeout(function () { drawWaves(true); }, 50); }
  }
  function render() {
    var t = T(), n = TRACKS.length;
    el.title.textContent = t.title; el.sub.textContent = t.artist + ' · Beats & Blues';
    el.artImg.src = t.cover; el.npArt.src = t.art; el.amb.src = t.cover;
    el.npTitle.textContent = t.title; el.npArtist.textContent = t.artist;
    var extra = t.full && t.full !== t.title ? t.full.replace(t.title, '').replace(/^[\s(]+|[\s)]+$/g, '') : '';
    el.npSub.textContent = extra; el.npSub.hidden = !extra;
    el.credits.href = t.credits || '/music/credits/'; el.song.href = t.page || '/music/'; el.press.href = t.press || '/music/press/';
    if (!el.deck.hidden && /^\/now-playing\//.test(location.pathname) && t.slug) {
      try { history.replaceState(history.state, '', '/now-playing/' + t.slug + '/'); } catch (e) {}
    }
    el.q.querySelectorAll('button[data-i]').forEach(function (b) { var on = +b.dataset.i === idx; b.classList.toggle('is-current', on); b.setAttribute('aria-current', on ? 'true' : 'false'); });
    if (lyricsOn) ensureLyrics(t);
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.full, artist: t.artist, album: 'heroone.art',
          artwork: [{ src: t.art, sizes: '512x512', type: 'image/webp' }],
        });
      } catch (e) {}
    }
    getData(t.id);
    lastDraw = -1; ui.progress(); drawWaves(true);
  }
  var SEV = { idle: 'info', loading: 'warning', playing: 'info', paused: 'info', error: 'critical' };
  var ui = {
    state: function (s) {
      if (!el.dock) return;
      root.dataset.state = s;
      var playing = s === 'playing' || s === 'loading';
      el.plays.forEach(function (b) {
        b.innerHTML = icon(playing ? 'pause' : 'play') + '<span class="hx-spin" aria-hidden="true"></span>';
        b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      });
      el.pillIcon.innerHTML = icon(playing ? 'pause' : 'play');
      el.ah.dataset.state = s === 'playing' ? 'playing' : 'idle';
      el.ah.dataset.severity = SEV[s] || 'info';
      el.dtf.dataset.state = s === 'playing' ? 'responding' : s === 'loading' ? 'thinking' : s === 'paused' ? 'listening' : 'dormant';
      el.roTrk.textContent = el.dtf.dataset.state.toUpperCase();
      el.roState.textContent = s.toUpperCase();
      if (s !== 'playing') el.eyes.style.opacity = '';
      if ('mediaSession' in navigator) try { navigator.mediaSession.playbackState = s === 'playing' ? 'playing' : 'paused'; } catch (e) {}
      if (s === 'playing') kick(); else { kick(); }
    },
    progress: function () {
      if (!el.dock) return;
      var x = data[T().id], d = audio.duration && isFinite(audio.duration) ? audio.duration : (x ? x.duration : 0), t = audio.currentTime || 0;
      el.time.textContent = fmt(t) + ' / ' + fmt(d);
      el.npCur.textContent = fmt(t);
      var left = Math.max(0, d - t);
      el.npDur.textContent = remain && d ? '\u2212' + fmt(left) : fmt(d);
      el.npDur.setAttribute('aria-label', remain ? 'Showing time remaining, ' + fmt(left) + ' left. Show duration.' : 'Showing duration, ' + fmt(d) + '. Show time remaining.');
      var f = d ? t / d : 0;
      el.ringP.style.strokeDashoffset = (188.5 * (1 - f)).toFixed(1);
      root.style.setProperty('--hx-p', f.toFixed(4));
      if (audio.paused) drawWaves(true);
    },
  };

  /* buttons anywhere on the site: <button data-play="ldcat"> */
  function syncButtons() {
    var cur = T().id, playing = !audio.paused;
    document.querySelectorAll('[data-play]').forEach(function (b) {
      var on = b.dataset.play === cur && playing;
      b.classList.toggle('is-playing', on);
      b.setAttribute('aria-pressed', String(on));
      var lab = b.querySelector('[data-play-label]');
      if (lab) lab.textContent = on ? 'Pause' : 'Play';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-play]');
    if (!b) return;
    e.preventDefault();
    var i = TRACKS.findIndex(function (t) { return t.id === b.dataset.play; });
    if (i < 0) return;
    if (root.classList.contains('is-min') && sget('localStorage', 'hx_min') !== '1') setMin(false);
    if (i === idx && listen && !listen.stopped && audio.getAttribute('src')) toggle(); else load(i, true);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lyrics]');
    if (!b) return;
    var i = TRACKS.findIndex(function (t) { return t.id === b.dataset.lyrics; });
    if (i < 0) return;
    e.preventDefault();
    if (root.classList.contains('is-min') && sget('localStorage', 'hx_min') !== '1') setMin(false);
    if (i !== idx) load(i, !audio.paused);
    openLyrics(true);
    openDeck(true);
  });

  if ('mediaSession' in navigator) {
    var ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', play); ms.setActionHandler('pause', pause);
      ms.setActionHandler('previoustrack', prev); ms.setActionHandler('nexttrack', next);
      ms.setActionHandler('seekto', function (d) { if (d.seekTime != null) audio.currentTime = d.seekTime; });
    } catch (e) {}
  }

  /* ── seamless page changes (the player is never unloaded) ── */
  function intercept(a, e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (!a.href || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-swap')) return false;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return false;
    if (/\.(pdf|jpe?g|png|webp|gif|mp3|m4a|zip|xml|txt|json)$/i.test(u.pathname)) return false;
    if (/^\/(studio|api|now-playing)(\/|$)/.test(u.pathname)) return false;
    if (u.pathname === location.pathname && u.search === location.search) return false;   // same page / in-page anchor
    return true;
  }
  var navigating = false;
  function swap(url, push) {
    if (navigating) return; navigating = true;
    document.documentElement.classList.add('hx-swapping');
    fetch(url, { credentials: 'same-origin', headers: { 'X-Hero-Swap': '1' } }).then(function (r) {
      var type = r.headers.get('content-type') || '';
      if (!r.ok || type.indexOf('text/html') < 0) throw new Error('no swap');
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.querySelector('meta[name="hx-player"]')) throw new Error('page opts out');
      if (push) history.pushState({ hx: 1 }, '', url);
      (window.__heroCleanup || []).splice(0).forEach(function (f) { try { f(); } catch (e) {} });
      return applyHead(doc, url).then(function () { applyBody(doc, url); });
    }).then(function () {
      navigating = false;
      document.documentElement.classList.remove('hx-swapping');
      var hash = new URL(url, location.href).hash;
      var target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
      syncButtons();
      pageview();
      document.dispatchEvent(new CustomEvent('hx:navigated'));
    }).catch(function () { location.href = url; });
  }
  function headKey(n) {
    if (n.tagName === 'LINK') return 'L:' + new URL(n.getAttribute('href'), location.href).href;
    return 'S:' + n.textContent.length + ':' + n.textContent.slice(0, 200);
  }
  function applyHead(doc, url) {
    document.title = doc.title;
    ['description'].forEach(function (name) {
      var a = document.querySelector('meta[name="' + name + '"]'), b = doc.querySelector('meta[name="' + name + '"]');
      if (a && b) a.setAttribute('content', b.getAttribute('content'));
    });
    var sel = 'link[rel="stylesheet"]:not([data-hx-persist]), style:not([data-hx-persist])';
    var cur = Array.prototype.slice.call(document.head.querySelectorAll(sel));
    var nxt = Array.prototype.slice.call(doc.head.querySelectorAll(sel));
    var curKeys = cur.map(headKey), nxtKeys = nxt.map(headKey);
    var loads = [];
    nxt.forEach(function (n, i) {
      if (curKeys.indexOf(nxtKeys[i]) >= 0) return;
      var c = document.importNode(n, true);
      if (c.tagName === 'LINK') {
        c.href = new URL(n.getAttribute('href'), url).href;
        loads.push(new Promise(function (res) { c.onload = c.onerror = res; setTimeout(res, 2500); }));
      }
      document.head.appendChild(c);
    });
    return Promise.all(loads).then(function () {
      cur.forEach(function (n, i) { if (nxtKeys.indexOf(curKeys[i]) < 0) n.remove(); });
      var html = document.documentElement, nh = doc.documentElement;
      ['lang', 'data-theme', 'style'].forEach(function (a) {
        if (nh.hasAttribute(a)) html.setAttribute(a, nh.getAttribute(a)); else if (a !== 'lang') html.removeAttribute(a);
      });
    });
  }
  function applyBody(doc, url) {
    var body = document.body;
    Array.prototype.slice.call(body.childNodes).forEach(function (n) { if (n !== root) body.removeChild(n); });
    Array.prototype.slice.call(body.attributes).forEach(function (a) { body.removeAttribute(a.name); });
    Array.prototype.slice.call(doc.body.attributes).forEach(function (a) { body.setAttribute(a.name, a.value); });
    var scripts = [];
    Array.prototype.slice.call(doc.body.childNodes).forEach(function (n) {
      var c = document.importNode(n, true);
      body.insertBefore(c, root);
    });
    body.querySelectorAll('script').forEach(function (old) {
      if (old.closest('#hx-persist')) return;
      if (old.type && old.type !== 'text/javascript' && old.type !== 'module') return;   // e.g. JSON-LD stays inert
      if (old.hasAttribute('data-hx-persist')) return;
      var s = document.createElement('script');
      Array.prototype.slice.call(old.attributes).forEach(function (a) { s.setAttribute(a.name, a.value); });
      if (old.src) { s.src = new URL(old.getAttribute('src'), url).href; s.async = false; }
      else s.textContent = old.textContent;
      old.replaceWith(s);
      scripts.push(s);
    });
    root.classList.toggle('on-light', document.documentElement.hasAttribute('data-hx-light') || !!document.querySelector('meta[name="hx-player"][content="light"]'));
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a || !intercept(a, e)) return;
    e.preventDefault();
    swap(a.href, true);
  });
  var shownPath = location.pathname;
  document.addEventListener('hx:navigated', function () { shownPath = location.pathname; });
  window.addEventListener('popstate', function (e) {
    var st = e.state || {};
    if (st.hxDeck && !document.body.hasAttribute('data-now-playing')) {        // forward into the deck
      var m = /^\/now-playing\/([^/]+)/.exec(location.pathname), i = m ? bySlug(m[1]) : -1;
      if (i >= 0 && i !== idx) load(i, false);
      openDeck(true, { silent: true }); return;
    }
    if (location.pathname === shownPath) { if (!el.deck.hidden) openDeck(false, { silent: true }); return; }
    if (!el.deck.hidden) openDeck(false, { silent: true });
    swap(location.href, false);
  });
  function bySlug(sl) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].slug === sl) return i; return -1; }
  // links to /now-playing/<song>/ open the deck in place
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="/now-playing/"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var u = new URL(a.href, location.href), m = /^\/now-playing\/([^/]+)\/?$/.exec(u.pathname);
    if (u.origin !== location.origin || !m) return;
    var i = bySlug(m[1]); if (i < 0) return;
    e.preventDefault();
    if (i !== idx || !audio.getAttribute('src')) load(i, true);
    openDeck(true);
  }, true);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ── visits ── */
  function pageview() { emit('pageview', { page: location.pathname, referrer: ctx.referrer }); ctx.referrer = null; }

  /* ── survive full reloads (other sites, hard refresh) ── */
  function save() {
    sset('sessionStorage', 'hx_state', JSON.stringify({
      i: idx, t: audio.currentTime || 0, playing: !audio.paused,
      listen: listen && !listen.stopped ? { id: listen.id, track: listen.track, listened: listen.listened, fired: listen.fired } : null,
    }));
  }
  window.addEventListener('pagehide', function () { save(); if (!audio.paused || (listen && listen.fired.play)) endListen('leave'); flush(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { save(); flush(true); } });

  /* ── boot ── */
  build();
  var saved = null;
  try { saved = JSON.parse(sget('sessionStorage', 'hx_state') || 'null'); } catch (e) {}
  if (saved && TRACKS[saved.i]) {
    idx = saved.i;
    listen = saved.listen && saved.listen.track === TRACKS[idx].id ? newListen(saved.listen) : newListen();
    if (saved.t > 1) resumeAt = saved.t;
  } else {
    listen = newListen();
  }
  render(); ui.state('idle'); syncButtons();
  root.classList.toggle('on-light', !!document.querySelector('meta[name="hx-player"][content="light"]'));
  pageview();
  document.addEventListener('hx:navigated', function () {
    root.classList.toggle('on-light', !!document.querySelector('meta[name="hx-player"][content="light"]'));
    landOnNowPlaying();
  });
  // A /now-playing/<song>/ page: cue that song and show the deck (playback waits for a tap)
  function landOnNowPlaying() {
    var id = document.body.getAttribute('data-now-playing'); if (!id) return;
    var i = TRACKS.findIndex(function (t) { return t.id === id; }); if (i < 0) return;
    if (i !== idx) { resumeAt = null; load(i, false); }
    openDeck(true, { silent: true });
  }
  landOnNowPlaying();
  window.__hxAuracle = { head: headHTML, field: fieldHTML };

  window.__heroPlayer = { play: play, pause: pause, toggle: toggle, next: next, prev: prev, load: load, audio: audio, flush: flush, open: function () { openDeck(true); }, close: function () { openDeck(false); } };
})();
