/* heroone.art · Book with 3nity Auracle
   A guided chat that takes a booking request to the right desk.
   - opens from any [data-book] element (the header "Book" button, footer, contact)
   - lives inside #hx-persist, so it survives page changes like the player
   - sends to /api/book (saved privately to the studio) and always offers the
     same request as a ready-made email to the desk, so nothing depends on one path */
(function () {
  'use strict';
  if (window.__heroBook) return;
  window.__heroBook = true;

  var DESK = {
    booking: { name: 'Booking', email: 'mraltd@yahoo.com' },
    management: { name: 'Management', email: 'millenialrenaissance@yahoo.com' },
  };
  var TOPICS = [
    { id: 'performance', label: 'Performance or show', desk: 'booking' },
    { id: 'feature', label: 'Feature or collaboration', desk: 'booking' },
    { id: 'production', label: 'Production', desk: 'booking' },
    { id: 'sync', label: 'Sync and licensing', desk: 'booking' },
    { id: 'press', label: 'Press or interview', desk: 'management' },
    { id: 'management', label: 'Management', desk: 'management' },
  ];
  var STORE = 'hx_book';
  var API = ((window.HERO_MUSIC || {}).api || '/api').replace(/\/$/, '');

  function sget() { try { return JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }
  function sset(v) { try { sessionStorage.setItem(STORE, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rich(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); }

  var st = sget() || fresh();
  function fresh() { return { step: 'topic', data: {}, log: [], sent: false }; }

  var root, panel, logEl, input, sendBtn, head, field, statusEl, opened = false;

  function build() {
    var host = document.getElementById('hx-persist') || document.body;
    root = document.createElement('div');
    root.id = 'hx-book';
    var A = window.__hxAuracle || {};
    root.innerHTML =
      '<section class="bk" role="dialog" aria-modal="false" aria-labelledby="bk-title" hidden>' +
        '<header class="bk__head">' +
          '<div class="bk__mark">' + (A.head ? A.head('bk') : '<img src="/assets/img/auracle/auracle-face-160.webp" alt="">') + '</div>' +
          '<div class="bk__title"><h2 id="bk-title">3nity Auracle</h2><p class="bk__status" data-field="listening"><i></i><span>Booking desk · Hero One</span></p></div>' +
          '<button class="bk__icon bk__restart" type="button" aria-label="Start over" title="Start over">⟲</button>' +
          '<button class="bk__icon bk__x" type="button" aria-label="Close">×</button>' +
        '</header>' +
        '<div class="bk__body">' + (A.field ? '<div class="bk__field">' + A.field() + '</div>' : '') + '<div class="bk__log" aria-live="polite"></div></div>' +
        '<form class="bk__composer" autocomplete="on"><label class="sr-only" for="bk-in">Message</label>' +
          '<textarea id="bk-in" rows="1" maxlength="1200" placeholder="Type here"></textarea>' +
          '<input class="bk__hp" tabindex="-1" autocomplete="off" aria-hidden="true" name="website">' +
          '<button class="bk__send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</form>' +
        '<p class="bk__foot">Requests go to Hero One’s desks only. <a href="mailto:mraltd@yahoo.com">mraltd@yahoo.com</a></p>' +
      '</section>';
    host.appendChild(root);
    panel = root.querySelector('.bk'); logEl = root.querySelector('.bk__log'); input = root.querySelector('#bk-in');
    sendBtn = root.querySelector('.bk__send'); head = root.querySelector('.ah'); field = root.querySelector('.dtf'); statusEl = root.querySelector('.bk__status');
    root.querySelector('.bk__x').addEventListener('click', close);
    root.querySelector('.bk__restart').addEventListener('click', restart);
    root.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); submit(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input.value); } });
    logEl.addEventListener('click', onAction);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && opened) close(); });
    renderLog();
  }

  /* ── conversation ── */
  function say(text, actions, delay) {
    mood('thinking');
    var typing = document.createElement('div'); typing.className = 'bk-msg bk-msg--a'; typing.innerHTML = '<div class="bk-typing"><span></span><span></span><span></span></div>';
    logEl.appendChild(typing); scroll();
    setTimeout(function () {
      typing.remove();
      push({ who: 'a', text: text, actions: actions || null });
      mood('speaking'); setTimeout(function () { mood('listening'); }, 900);
    }, delay == null ? 520 : delay);
  }
  function me(text) { push({ who: 'u', text: text }); }
  function push(m) { st.log.push(m); sset(st); logEl.appendChild(msgEl(m, st.log.length - 1)); scroll(); }
  function msgEl(m, i) {
    var d = document.createElement('div');
    d.className = 'bk-msg bk-msg--' + m.who;
    var h = '<div class="bk-msg__t">' + rich(m.text) + '</div>';
    if (m.card) h += m.card;
    if (m.actions && i === st.log.length - 1) h += '<div class="bk-acts">' + m.actions.map(function (a) {
      return a.href ? '<a class="bk-act' + (a.gold ? ' bk-act--gold' : '') + '" href="' + esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(a.label) + '</a>'
        : '<button type="button" class="bk-act' + (a.gold ? ' bk-act--gold' : '') + '" data-act="' + esc(a.act) + '"' + (a.val ? ' data-val="' + esc(a.val) + '"' : '') + '>' + esc(a.label) + '</button>';
    }).join('') + '</div>';
    d.innerHTML = h;
    return d;
  }
  function renderLog() { logEl.innerHTML = ''; st.log.forEach(function (m, i) { logEl.appendChild(msgEl(m, i)); }); scroll(); }
  function scroll() { requestAnimationFrame(function () { logEl.scrollTop = logEl.scrollHeight; }); }
  function mood(f) {
    if (statusEl) statusEl.dataset.field = f;
    if (field) field.dataset.state = f === 'speaking' ? 'responding' : f;
    if (head) head.dataset.state = f === 'speaking' ? 'speaking' : f === 'thinking' ? 'playing' : 'idle';
  }

  function greet() {
    say('I’m **3nity Auracle**. I’ll take your request to Hero One’s desk.\n\n**Booking** · mraltd@yahoo.com\n**Management** · millenialrenaissance@yahoo.com\n\nWhat would you like to talk about?',
      TOPICS.map(function (t) { return { label: t.label, act: 'topic', val: t.id }; }), 300);
  }
  var ASK = {
    name: 'Who am I speaking with? Your name, and your company if there is one.',
    email: 'Which email should the reply go to?',
    when: 'When and where? A date, a city or a venue. If it’s open, choose Skip.',
    message: 'Tell me what you have in mind. Details help the desk answer properly.',
  };
  function ask(step) {
    st.step = step; sset(st);
    input.placeholder = { name: 'Your name', email: 'you@example.com', when: 'Date, city, venue', message: 'Your request' }[step] || 'Type here';
    input.setAttribute('inputmode', step === 'email' ? 'email' : 'text');
    input.setAttribute('autocomplete', { name: 'name', email: 'email' }[step] || 'off');
    say(ASK[step], step === 'when' ? [{ label: 'Skip', act: 'skip' }] : null);
    setTimeout(function () { input.focus({ preventScroll: true }); }, 600);
  }

  function submit(raw) {
    var v = String(raw || '').trim();
    if (!v || st.sent && st.step === 'done') return;
    if (root.querySelector('.bk__hp').value) return;              // a bot filled the hidden field
    input.value = '';
    if (st.step === 'topic') {
      var t = TOPICS.find(function (x) { return x.label.toLowerCase() === v.toLowerCase(); });
      me(v);
      if (t) return chooseTopic(t.id, true);
      st.data.topic = 'other'; st.data.desk = 'booking'; st.data.topicLabel = v.slice(0, 80);
      return ask('name');
    }
    if (st.step === 'name') { me(v); st.data.name = v.slice(0, 120); return ask('email'); }
    if (st.step === 'email') {
      me(v);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return say('That email doesn’t look complete. Could you type it again?');
      st.data.email = v.slice(0, 200); return ask('when');
    }
    if (st.step === 'when') { me(v); st.data.when = v.slice(0, 200); return ask('message'); }
    if (st.step === 'message') {
      me(v);
      if (v.length < 8) return say('A little more detail, please. What, where, and anything the desk should know.');
      st.data.message = v.slice(0, 1200); return review();
    }
    if (st.step === 'review' || st.step === 'done') { me(v); say('Use the buttons above to send, or start over with ⟲.'); }
  }
  function chooseTopic(id, typed) {
    var t = TOPICS.find(function (x) { return x.id === id; }); if (!t) return;
    if (!typed) me(t.label);
    st.data.topic = t.id; st.data.topicLabel = t.label; st.data.desk = t.desk;
    say('That goes to the **' + DESK[t.desk].name + '** desk (' + DESK[t.desk].email + ').', null, 380);
    setTimeout(function () { ask('name'); }, 900);
  }
  function review() {
    st.step = 'review'; sset(st);
    var d = st.data, desk = DESK[d.desk || 'booking'];
    var card = '<dl class="bk-card">' +
      row('To', desk.name + ' · ' + desk.email) + row('About', d.topicLabel) + row('From', d.name) + row('Reply to', d.email) +
      (d.when ? row('When / where', d.when) : '') + row('Message', d.message) + '</dl>';
    mood('thinking');
    setTimeout(function () {
      push({ who: 'a', text: 'Here’s your request. Send it to the desk?', card: card,
        actions: [{ label: 'Send to the desk', act: 'send', gold: true }, { label: 'Open in my email', href: mailto() }, { label: 'Copy', act: 'copy' }, { label: 'Edit', act: 'restart' }] });
      mood('listening');
    }, 500);
  }
  function row(k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; }
  function plain() {
    var d = st.data;
    return 'About: ' + d.topicLabel + '\nFrom: ' + d.name + '\nReply to: ' + d.email + (d.when ? '\nWhen / where: ' + d.when : '') + '\n\n' + d.message + '\n\nSent from heroone.art';
  }
  function mailto() {
    var d = st.data, desk = DESK[d.desk || 'booking'];
    return 'mailto:' + desk.email + '?subject=' + encodeURIComponent('Hero One · ' + d.topicLabel + ' · ' + d.name) + '&body=' + encodeURIComponent(plain());
  }
  function send() {
    var d = st.data;
    mood('thinking');
    fetch(API + '/book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ topic: d.topic, topic_label: d.topicLabel, desk: d.desk, name: d.name, email: d.email, when: d.when || '', message: d.message, page: location.pathname }),
    }).then(function (r) { if (!r.ok) throw new Error(r.status); return r; }).then(function () {
      st.sent = true; st.step = 'done'; sset(st);
      say('Sent. The **' + DESK[d.desk].name + '** desk will reply to ' + d.email + '. If you’d like a copy in your outbox too, send it from your email.',
        [{ label: 'Also send from my email', href: mailto() }, { label: 'Close', act: 'close' }]);
    }).catch(function () {
      say('I couldn’t reach the desk from here just now. Your email app will send exactly the same request:',
        [{ label: 'Send from my email', href: mailto(), gold: true }, { label: 'Copy', act: 'copy' }, { label: 'Try again', act: 'send' }]);
    });
  }
  function onAction(e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'topic') chooseTopic(b.dataset.val);
    else if (a === 'skip') { me('Skip'); st.data.when = ''; ask('message'); }
    else if (a === 'send') send();
    else if (a === 'copy') {
      var txt = 'To: ' + DESK[st.data.desk].email + '\n' + plain();
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { b.textContent = 'Copied'; }).catch(function () {});
    }
    else if (a === 'restart') restart();
    else if (a === 'close') close();
  }
  function restart() { st = fresh(); sset(st); renderLog(); greet(); }

  /* ── open / close ── */
  function open() {
    if (!root) build();
    panel.hidden = false; opened = true;
    requestAnimationFrame(function () { panel.classList.add('is-open'); });
    document.documentElement.classList.add('bk-open');
    if (!st.log.length) greet();
    mood('listening');
    if (head && !sessionStorage.getItem('hx_bk_boot')) { try { sessionStorage.setItem('hx_bk_boot', '1'); } catch (e) {} head.classList.add('is-boot'); setTimeout(function () { head.classList.remove('is-boot'); }, 3000); }
    setTimeout(function () { var f = st.step === 'topic' ? (root.querySelector('.bk-act') || input) : input; f.focus({ preventScroll: true }); }, 900);
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('is-open'); opened = false;
    document.documentElement.classList.remove('bk-open');
    setTimeout(function () { if (!opened) panel.hidden = true; }, 300);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-book]');
    if (!t || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    if (opened) close(); else open();
  });
  if (/^#book$/.test(location.hash)) setTimeout(open, 400);
  window.__heroBook = { open: open, close: close };
})();
