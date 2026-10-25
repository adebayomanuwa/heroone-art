/* heroone.art · Gallery flipbook
   Pages become leaves (front + back). Two pages per spread on wide screens, one on phones.
   Turn by dragging a page, swiping, trackpad, arrow keys, the buttons, or by clicking the
   left / right side. The contents page and the frame strip jump straight to a picture.
   Tap a picture without dragging to open it full screen (with the full-resolution download). */
(function () {
  'use strict';
  var book = document.querySelector('.fb-book');
  if (!book) return;
  var ac = new AbortController(), sig = { signal: ac.signal };
  (window.__heroCleanup = window.__heroCleanup || []).push(function () { ac.abort(); var b = document.getElementById('mz-box'); if (b && b.open) b.close(); });

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAGES = Array.prototype.slice.call(book.querySelectorAll('.fb-page'));
  var stage = book.parentElement;
  var bar = document.querySelector('.fb-bar'), label = bar.querySelector('.fb-where__l'), year = bar.querySelector('.fb-where__y');
  var prevBtn = bar.querySelector('.fb-prev'), nextBtn = bar.querySelector('.fb-next');
  var prog = document.querySelector('.fb-progress'), thumbs = Array.prototype.slice.call(document.querySelectorAll('.fb-thumb'));
  var mode = '', leaves = [], cur = 0, pw = 0, ph = 0, busy = 0;
  var TURN = 750;

  /* ── binding ── */
  function face(page, side) {
    var f = document.createElement('div');
    f.className = 'fb-face fb-face--' + side;
    if (page) f.appendChild(page);
    return f;
  }
  function build() {
    var at = firstVisiblePage();
    leaves.forEach(function (l) { l.remove(); });
    leaves = [];
    var single = mode === 'single';
    var step = single ? 1 : 2;
    for (var i = 0; i < PAGES.length; i += step) {
      var leaf = document.createElement('div');
      leaf.className = 'fb-leaf';
      leaf.appendChild(face(PAGES[i], 'front'));
      leaf.appendChild(face(single ? null : PAGES[i + 1], 'back'));
      book.appendChild(leaf);
      leaves.push(leaf);
    }
    book.classList.add('is-ready');
    book.classList.toggle('is-single', single);
    cur = single ? at : Math.ceil(at / 2);
    render(true);
  }
  function firstVisiblePage() { return mode === 'single' ? cur : Math.max(0, cur * 2 - 1); }
  function layout() {
    var m = window.innerWidth >= 900 ? 'spread' : 'single';
    // fit the stage between the header and the controls (and above the player dock)
    var fb = stage.parentElement, cs = getComputedStyle(fb), strip = document.querySelector('.fb-strip');
    var gap = parseFloat(cs.rowGap) || 14;
    var below = bar.offsetHeight + prog.offsetHeight + (strip ? strip.offsetHeight : 0) + gap * 3;
    var dock = document.documentElement.classList.contains('hx-has-dock') ? (window.innerWidth < 560 ? 92 : 104) : 0;
    var availH = Math.max(300, window.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - below - dock - 24);
    stage.style.height = availH + 'px';
    var availW = stage.getBoundingClientRect().width;
    pw = m === 'spread' ? Math.min(availW * 0.48, availH * 0.8) : Math.min(availW * 0.92, availH * 0.8);
    ph = pw / 0.8;
    book.style.setProperty('--pw', pw + 'px');
    book.style.setProperty('--ph', ph + 'px');
    book.style.setProperty('--bw', (m === 'spread' ? pw * 2 : pw) + 'px');
    if (m !== mode) { var keep = mode ? firstVisiblePage() : 0; mode = m; cur = 0; build(); go(keep, true); }
    else render(true);
  }

  /* ── state → pixels ── */
  function render(instant) {
    var n = leaves.length;
    leaves.forEach(function (l, i) {
      var turned = i < cur;
      if (instant) l.style.transition = 'none';
      l.style.setProperty('--a', turned ? '-180deg' : '0deg');
      l.style.zIndex = turned ? i + 1 : n - i;
      l.classList.toggle('is-next', i === cur);
      l.classList.toggle('is-gone', mode === 'single' && turned);
      if (instant) { void l.offsetWidth; l.style.transition = ''; }
      if (Math.abs(i - cur) <= 2) l.querySelectorAll('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; });
    });
    var shift = 0;
    if (mode === 'spread') { if (cur === 0) shift = -pw / 2; else if (cur === n) shift = pw / 2; }
    book.style.setProperty('--shift', shift + 'px');
    // where are we
    var right = mode === 'single' ? PAGES[cur] : PAGES[cur * 2], left = mode === 'single' ? null : PAGES[cur * 2 - 1];
    var shown = right || left;
    var lab = shown ? shown.getAttribute('data-label') : '';
    var cap = shown && shown.querySelector('.pg-cap span');
    label.textContent = cap ? cap.textContent : (lab || 'Gallery');
    var y = shown && shown.querySelector('.pg-folio');
    year.textContent = cap ? (lab + ' · ' + (shown.querySelector('.pg-cap .pg-folio') || {}).textContent) : (y && /\d{4}/.test(y.textContent) ? y.textContent : '');
    prevBtn.disabled = cur === 0; nextBtn.disabled = cur === n;
    prog.style.setProperty('--p', n ? cur / n : 0);
    prog.querySelector('i').style.setProperty('--p', n ? cur / n : 0);
    var vis = [PAGES.indexOf(left), PAGES.indexOf(right)];
    thumbs.forEach(function (t) { var on = vis.indexOf(+t.dataset.goto) >= 0; t.classList.toggle('is-current', on); if (on && !instant) { var st = t.parentElement; st.scrollTo({ left: t.offsetLeft - st.clientWidth / 2 + t.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' }); } });
  }
  function lift(l) { l.style.zIndex = leaves.length + 10; l.classList.add('is-turning'); setTimeout(function () { l.classList.remove('is-turning'); }, TURN); }
  function next() { if (cur >= leaves.length) return false; lift(leaves[cur]); cur++; render(); return true; }
  function prev() { if (cur <= 0) return false; var l = leaves[cur - 1]; l.classList.remove('is-gone'); lift(l); cur--; render(); return true; }
  function go(page, instant) {
    var target = Math.max(0, Math.min(leaves.length, mode === 'single' ? page : Math.ceil(page / 2)));
    if (instant || reduce) { cur = target; render(true); return; }
    clearInterval(busy);
    busy = setInterval(function () {                         // riffle through, a page at a time
      if (cur === target) return clearInterval(busy);
      if (cur < target) next(); else prev();
    }, 110);
  }

  /* ── drag / swipe ── */
  var drag = null;
  book.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, on: false, leaf: null, dir: 0, id: e.pointerId };
  }, sig);
  book.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    if (!drag.on) {
      if (Math.abs(drag.dx) < 8 || Math.abs(drag.dx) < Math.abs(e.clientY - drag.y)) return;
      drag.dir = drag.dx < 0 ? 1 : -1;
      drag.leaf = drag.dir > 0 ? leaves[cur] : leaves[cur - 1];
      if (!drag.leaf) { drag = null; return; }
      drag.on = true;
      book.setPointerCapture(e.pointerId);
      book.classList.add('is-dragging');
      drag.leaf.classList.add('is-active'); drag.leaf.classList.remove('is-gone');
      drag.leaf.style.zIndex = leaves.length + 10;
    }
    var p = Math.min(1, Math.abs(drag.dx) / (mode === 'single' ? pw * 0.9 : pw));
    var a = drag.dir > 0 ? -180 * p : -180 * (1 - p);
    drag.leaf.style.setProperty('--a', a + 'deg');
    drag.leaf.style.setProperty('--t', Math.sin(p * Math.PI).toFixed(3));
    drag.p = p;
  }, sig);
  function end(e) {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.on) return click(e, d);
    book.classList.remove('is-dragging');
    d.leaf.classList.remove('is-active');
    d.leaf.style.setProperty('--t', 0);
    var v = Math.abs(d.dx) / Math.max(1, performance.now() - d.t);
    if (d.p > 0.33 || v > 0.6) { if (d.dir > 0) cur++; else cur--; }
    render();
  }
  book.addEventListener('pointerup', end, sig);
  book.addEventListener('pointercancel', function () { if (drag && drag.on) { drag.p = 0; end({}); } drag = null; }, sig);
  function click(e, d) {
    var t = e.target;
    var go_ = t.closest && t.closest('[data-goto]');
    if (go_) return go(+go_.dataset.goto);
    var z = t.closest && t.closest('.pg-zoom');
    if (z && !z.classList.contains('pg-cover__img')) return zoom(z);
    var r = book.getBoundingClientRect();
    var onRight = mode === 'single' ? (e.clientX - r.left) > r.width * 0.35 : (e.clientX - r.left) > r.width / 2;
    if (onRight) next(); else prev();
  }

  /* ── keys, buttons, trackpad, strip ── */
  prevBtn.addEventListener('click', prev, sig);
  nextBtn.addEventListener('click', next, sig);
  thumbs.forEach(function (t) { t.addEventListener('click', function () { go(+t.dataset.goto); }, sig); });
  document.addEventListener('keydown', function (e) {
    if (document.getElementById('mz-box').open || /input|textarea/i.test((document.activeElement || {}).tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(PAGES.length);
  }, sig);
  var wheelAt = 0;
  book.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 24) return;
    e.preventDefault();
    var now = performance.now(); if (now - wheelAt < 650) return; wheelAt = now;
    if (e.deltaX > 0) next(); else prev();
  }, { passive: false, signal: ac.signal });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 150); }, sig);

  /* ── full-screen picture ── */
  var box = document.getElementById('mz-box');
  function zoom(b) {
    if (!box || !box.showModal) return;
    var img = box.querySelector('img');
    img.src = b.dataset.full; img.alt = b.dataset.title;
    box.querySelector('.mz-box__t').textContent = b.dataset.title;
    box.querySelector('.mz-box__y').textContent = b.dataset.year;
    box.querySelector('.mz-box__dl').href = b.dataset.original;
    box.showModal();
  }
  if (box) {
    box.querySelector('.mz-box__x').addEventListener('click', function () { box.close(); }, sig);
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); }, sig);
  }

  layout();
})();
