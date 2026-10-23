/* heroone.art site behaviour: glass header, mobile menu, section highlight,
   spotlight/tilt cards, gallery filter + lightbox, ring drawing. */
(function () {
  // page-scoped listeners are released when the player swaps to another page
  var ac = new AbortController(), sig = { signal: ac.signal };
  var observers = [];
  (window.__heroCleanup = window.__heroCleanup || []).push(function () {
    ac.abort(); observers.forEach(function (o) { o.disconnect(); });
  });
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* Header: scrolled state + mobile menu */
  var header = document.querySelector(".site-header");
  var menu = document.querySelector(".menu-button");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 12); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true, signal: ac.signal });
  }
  if (header && menu) {
    var setOpen = function (open) {
      header.classList.toggle("is-open", open);
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    menu.addEventListener("click", function () { setOpen(!header.classList.contains("is-open")); });
    header.querySelectorAll(".site-nav a").forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && header.classList.contains("is-open")) { setOpen(false); menu.focus(); } }, sig);
    document.addEventListener("pointerdown", function (e) { if (header.classList.contains("is-open") && !header.contains(e.target)) setOpen(false); }, sig);
  }

  /* Highlight the nav link for the section in view */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a[href^="#"]'));
  if (navLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && byId[en.target.id]) {
          navLinks.forEach(function (a) { a.classList.remove("is-active"); });
          byId[en.target.id].classList.add("is-active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    observers.push(spy);
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }

  /* Spotlight + tilt (333Bi Tech EcosystemGrid) */
  if (finePointer && !reduce) {
    document.querySelectorAll(".card, .portrait").forEach(function (el) {
      var tiltX = el.classList.contains("portrait") ? 8 : 5, tiltY = el.classList.contains("portrait") ? 10 : 6;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        el.style.setProperty("--mx", x + "px");
        el.style.setProperty("--my", y + "px");
        el.style.setProperty("--rx", ((y / r.height) - 0.5) * -tiltX + "deg");
        el.style.setProperty("--ry", ((x / r.width) - 0.5) * tiltY + "deg");
      });
      el.addEventListener("pointerleave", function () { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    });
  }

  /* Draw rings when they enter the viewport */
  var rings = document.querySelectorAll(".law-ring");
  if (rings.length) {
    if (reduce || !("IntersectionObserver" in window)) rings.forEach(function (r) { r.classList.add("is-drawn"); });
    else {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-drawn"); ro.unobserve(en.target); } });
      }, { threshold: 0.35 });
      observers.push(ro);
      rings.forEach(function (r) { ro.observe(r); });
    }
  }

  /* Gallery filter */
  var shots = Array.prototype.slice.call(document.querySelectorAll(".shot"));
  var filters = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
  var countEl = document.getElementById("gallery-count");
  function visibleShots() { return shots.filter(function (s) { return !s.hidden; }); }
  function applyFilter(f) {
    shots.forEach(function (s) { s.hidden = !(f === "all" || s.dataset.category === f); });
    filters.forEach(function (b) { b.setAttribute("aria-checked", String(b.dataset.filter === f)); });
    if (countEl) { var n = visibleShots().length; countEl.textContent = n + " of " + shots.length + " images"; }
  }
  filters.forEach(function (b) { b.addEventListener("click", function () { applyFilter(b.dataset.filter); }); });
  if (shots.length) applyFilter("all");

  /* Lightbox */
  var box = document.getElementById("lightbox");
  if (box && shots.length) {
    var img = box.querySelector("#lb-img");
    var current = 0;
    var show = function (shot) {
      var d = shot.dataset;
      img.src = d.full;
      img.alt = shot.querySelector("img").alt;
      box.querySelector("#lb-cat").textContent = d.category;
      box.querySelector("#lb-title").textContent = d.title;
      box.querySelector("#lb-desc").textContent = d.description;
      box.querySelector("#lb-year").textContent = d.year;
      box.querySelector("#lb-use").textContent = d.usage;
      box.querySelector("#lb-size").textContent = d.size;
      var dl = box.querySelector("#lb-download");
      dl.href = d.original;
      dl.setAttribute("download", d.original.split("/").pop());
    };
    var step = function (dir) {
      var list = visibleShots();
      current = (current + dir + list.length) % list.length;
      show(list[current]);
    };
    shots.forEach(function (s) {
      s.addEventListener("click", function () {
        current = visibleShots().indexOf(s);
        show(s);
        if (typeof box.showModal === "function") box.showModal(); else box.setAttribute("open", "");
      });
    });
    box.querySelector("#lb-close").addEventListener("click", function () { box.close(); });
    box.querySelector("#lb-prev").addEventListener("click", function () { step(-1); });
    box.querySelector("#lb-next").addEventListener("click", function () { step(1); });
    box.addEventListener("click", function (e) { if (e.target === box) box.close(); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });
  }

  /* Footer year */
  document.querySelectorAll("[data-current-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
