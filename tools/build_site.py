#!/usr/bin/env python3
"""heroone.art page builder: one source of truth for the menu, footer and every Music page.

    python3 tools/build_site.py

Reads  tools/catalog.json   (songs, releases by year, press releases, platforms)
       tools/magazine.json  (magazine frames)
Writes /music/                       Music: catalog by year, press releases, credits, elsewhere
       /music/<slug>/                one page per song
       /music/press/                 press releases (paper system)
       /music/credits/               credits index (paper system); per-song pages: tools/build_credits.py
       /now-playing/<slug>/          shareable player URL (opens the 3nity Auracle deck)
       /gallery/                     Gallery (the pictures, laid out as a magazine)
and refreshes the shared header + footer inside index.html, philosophy/index.html and 404.html."""
import json, os, re, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = json.load(open(os.path.join(ROOT, 'tools', 'catalog.json'), encoding='utf-8'))
MAG = json.load(open(os.path.join(ROOT, 'tools', 'magazine.json'), encoding='utf-8'))
ICONS = open(os.path.join(ROOT, 'tools', '_icons.html'), encoding='utf-8').read()
SITE = 'https://heroone.art'

def esc(s): return html.escape(str(s), quote=True)
def dur(track_id):
    try:
        d = json.load(open(os.path.join(ROOT, 'assets', 'music', track_id + '.json')))['duration']
        return f'{int(d) // 60}:{int(d) % 60:02d}'
    except Exception:
        return ''
def write(rel, text):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(text)
    print('wrote', '/' + rel.replace('index.html', ''))

ARROW = ''
PLAY_I = '<svg class="play-i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"/></svg><svg class="pause-i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.6z"/></svg>'
MARK = '/assets/img/brand/heroone-wordmark.webp'
MARK_W, MARK_H = 1567, 959

# ───────────────────────── shared header / footer ─────────────────────────
def header(active=''):
    cur = lambda k: ' aria-current="page"' if k == active else ''
    return f'''<header class="site-header">
    <a class="brand-lockup" href="/" aria-label="Hero One home">
      <img src="{MARK}" width="{MARK_W}" height="{MARK_H}" alt="">
      <span>Beats &amp; Blues<br>Reality Music</span>
    </a>
    <div class="header-actions">
      <a class="button button--primary button--sm" href="/#contact" data-book>Book</a>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu"><span></span><span></span></button>
    </div>
    <nav class="site-nav" id="site-menu" aria-label="Primary">
      <div class="nav-group">
        <a class="nav-big" href="/music/"{cur('music')}>Music</a>
        <div class="nav-sub"><a href="/music/#catalog">Catalog</a><a href="/music/press/">Press releases</a><a href="/music/credits/">Credits</a></div>
      </div>
      <a class="nav-big" href="/philosophy/"{cur('philosophy')}>Philosophy</a>
      <a class="nav-big" href="/#journey"{cur('journey')}>Journey</a>
      <a class="nav-big" href="/gallery/"{cur('gallery')}>Gallery</a>
      <div class="nav-foot">
        <a class="nav-studio" href="/studio/" data-no-swap><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>Studio</a>
        <a class="nav-book" href="/#contact" data-book>Book</a>
      </div>
    </nav>
  </header>'''

FOOTER = f'''<footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="{MARK}" width="{MARK_W}" height="{MARK_H}" alt="Hero One">
        <p>Beats &amp; Blues Reality Music by Adebayo Michael Manuwa. Part of the <a href="https://333bi.tech" target="_blank" rel="noopener" style="color:var(--gold-bright)">333BI</a> ecosystem.</p>
      </div>
      <nav aria-label="Site">
        <h2 class="kicker">Site</h2>
        <a href="/music/">Music</a>
        <a href="/music/press/">Press releases</a>
        <a href="/music/credits/">Credits</a>
        <a href="/philosophy/">Philosophy</a>
        <a href="/philosophy/law/">The Law</a>
        <a href="/#journey">Journey</a>
        <a href="/gallery/">Gallery</a>
      </nav>
      <nav aria-label="Listen">
        <h2 class="kicker">Listen</h2>
        <a href="https://open.spotify.com/artist/2tr20IvKIxa9P9I3ucID2g" target="_blank" rel="noopener">Spotify</a>
        <a href="https://music.apple.com/ng/artist/hero-one/1520370143" target="_blank" rel="noopener">Apple Music</a>
        <a href="https://soundcloud.com/heroone" target="_blank" rel="noopener">SoundCloud</a>
        <a href="https://www.youtube.com/@hero-one" target="_blank" rel="noopener">YouTube</a>
      </nav>
      <nav aria-label="Hero One elsewhere">
        <h2 class="kicker">Elsewhere</h2>
        <a href="/#contact" data-book>Book</a>
        <a href="https://portfolio.heroone.art" target="_blank" rel="noopener">Portfolio &amp; press kit</a>
        <a href="https://metameta3.com" target="_blank" rel="noopener">metameta3.com</a>
        <a href="https://333bi.tech" target="_blank" rel="noopener">333bi.tech</a>
        <a href="/studio/" data-no-swap>Studio</a>
      </nav>
    </div>
    <div class="footer-base mono">
      <span>© 2010–<span data-current-year>2026</span> Millenial Renaissance Art Limited &amp; Opulence Grandeur Sound</span>
      <span>Heal · Reflect · Rise</span>
    </div>
  </footer>'''

PERSIST_HEAD = '''  <link rel="stylesheet" href="/assets/css/player.css" data-hx-persist>
  <link rel="stylesheet" href="/assets/css/book.css" data-hx-persist>'''
PERSIST_TAIL = '''  <script src="/assets/js/music-config.js" data-hx-persist></script>
  <script src="/assets/js/player.js" data-hx-persist></script>
  <script src="/assets/js/book.js" data-hx-persist></script>'''

def page(path, title, desc, body, *, active='', image='/assets/img/og-image.jpg', theme='dark', css=('/assets/css/site.css',),
         chrome=True, field=False, body_attr='', ld=None, robots=''):
    url = SITE + path
    links = '\n'.join(f'  <link rel="stylesheet" href="{c}">' for c in css)
    ldj = f'\n  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>' if ld else ''
    scripts = ('  <script src="/assets/js/signal-field.js" defer></script>\n' if field else '') + ('  <script src="/assets/js/site.js" defer></script>\n' if chrome else '')
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="{'#06080f' if theme == 'dark' else '#f6f5f2'}">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}">{robots}
  <link rel="canonical" href="{url}">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/brand/favicon-32.png?v=clean">
  <link rel="apple-touch-icon" href="/assets/img/brand/apple-touch-icon.png?v=clean">
  <meta property="og:site_name" content="Hero One">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:image" content="{SITE}{image}">
  <meta name="twitter:card" content="summary_large_image">
{links}
  <meta name="hx-player" content="{theme}">
{PERSIST_HEAD}{ldj}
</head>
<body{body_attr}>
  {ICONS}
  <a class="skip-link" href="#main">Skip to content</a>
  {header(active) if chrome else ''}
  <main id="main">
{body}
  </main>
  {FOOTER if chrome else ''}
{scripts}{PERSIST_TAIL}
</body>
</html>
'''

SONGS = CAT['songs']
BY_SLUG = {s['slug']: s for s in SONGS}
PRESS = {p['slug']: p for p in CAT['press']}

def play_btn(s, cls='m-play', label=True):
    lab = '<span data-play-label>Play</span>' if label else ''
    return f'<button class="{cls}" type="button" data-play="{s["id"]}" aria-pressed="false" aria-label="Play {esc(s["title"])}">{PLAY_I}{lab}</button>'

def lyric_html(s):
    rel = s.get('lyrics')
    if not rel: return ''
    raw = open(os.path.join(ROOT, rel), encoding='utf-8').read().replace('\r\n', '\n').replace('\r', '\n')
    stanzas, cur = [], []
    for line in raw.split('\n'):
        if line.strip(): cur.append(line.strip())
        elif cur: stanzas.append(cur); cur = []
    if cur: stanzas.append(cur)
    sheet = ''.join('<p>' + '<br>'.join(esc(line) for line in stanza) + '</p>' for stanza in stanzas)
    return f'''    <section class="section song-lyrics" aria-labelledby="lyrics-title">
      <div class="song-lyrics__head">
        <h2 id="lyrics-title">Lyrics</h2>
      </div>
      <div class="song-lyrics__sheet">{sheet}</div>
      <p class="song-lyrics__go"><button class="button button--ghost" type="button" data-lyrics="{s["id"]}">Open in the player</button></p>
    </section>'''

def lyric_btn(s):
    if not s.get('lyrics'): return ''
    return f'<button class="button button--ghost" type="button" data-lyrics="{s["id"]}">Lyrics</button>'

def song_card(s):
    c = s['cover']
    return f'''<article class="m-song">
          <div class="m-song__media"><a class="m-song__art" href="/music/{s['slug']}/"><img src="{c}-512.webp" srcset="{c}-512.webp 512w, {c}-800.webp 800w" sizes="(max-width: 720px) 80vw, 300px" width="512" height="512" alt="{esc(s['title'])} cover art" loading="lazy"></a>
          {play_btn(s, 'm-song__play', False)}</div>
          <div class="m-song__meta">
            <h3><a href="/music/{s['slug']}/">{esc(s['title'])}</a></h3>
            {f'<p class="m-song__sub">{esc(s["subtitle"])}</p>' if s['subtitle'] else ''}
            <p class="m-song__links mono"><span>{dur(s['id'])}</span><a href="/music/credits/{s['slug']}/">Credits</a><a href="/now-playing/{s['slug']}/">Now playing</a></p>
          </div>
        </article>'''

# ───────────────────────── /music/ ─────────────────────────
def build_music():
    years = sorted({s['year'] for s in SONGS} | {r['year'] for r in CAT['releases']}, reverse=True)
    rows = []
    for y in years:
        songs = [s for s in SONGS if s['year'] == y]
        rels = [r for r in CAT['releases'] if r['year'] == y]
        items = ''
        if songs:
            items += '<div class="m-songs">' + ''.join(song_card(s) for s in songs) + '</div>'
        if rels:
            items += '<ul class="m-rel">' + ''.join(
                f'<li><a href="{esc(r["link"])}" target="_blank" rel="noopener"><span class="m-rel__t">{esc(r["title"])}</span><span class="m-rel__k mono">{esc(r["kind"])}</span>{ARROW}</a></li>' for r in rels) + '</ul>'
        rows.append(f'<section class="m-year reveal" aria-labelledby="y{y}"><h3 class="m-year__n" id="y{y}">{y}</h3><div class="m-year__body">{items}</div></section>')
    press = ''.join(f'''<a class="m-press reveal" href="/music/press/{p['slug']}/">
          <span class="m-press__eyebrow">Press release · {p['year']}</span>
          <strong>{esc(p['title'])}</strong>
          <span class="m-press__lede">{esc(p['lede'])}</span>
          <span class="m-press__go">Read {ARROW}</span>
        </a>''' for p in CAT['press'])
    credits = ''.join(f'<li><a href="/music/credits/{s["slug"]}/"><img src="{s["cover"]}-160.webp" alt="" width="56" height="56" loading="lazy"><span><strong>{esc(s["title"])}</strong></span>{ARROW}</a></li>' for s in SONGS)
    plats = ''.join(f'<a class="platform" href="{u}" target="_blank" rel="noopener"><span><svg class="brand" aria-hidden="true"><use href="#{i}"/></svg>{esc(n)}</span></a>' for n, u, i in CAT['platforms'])
    body = f'''    <section class="page-hero page-hero--music" aria-labelledby="ph-title">
      <div class="signal-field" data-signal-field aria-hidden="true"><canvas></canvas></div>
      <div class="hero-grain" aria-hidden="true"></div>
      <div class="page-hero__inner">
        <span class="eyebrow"><span class="pulse-dot"></span> Music</span>
        <h1 id="ph-title">Music</h1>
        <nav class="m-tabs" aria-label="Music sections">
          <a href="#catalog">Catalog</a><a href="/music/press/">Press releases</a><a href="/music/credits/">Credits</a><a href="#elsewhere">Elsewhere</a>
        </nav>
      </div>
    </section>

    <section class="section m-section" id="catalog" aria-labelledby="catalog-title">
      <div class="m-head"><h2 id="catalog-title">Catalog</h2></div>
      {''.join(rows)}
    </section>

    <section class="section m-section" id="press" aria-labelledby="press-title">
      <div class="m-head"><h2 id="press-title">Press releases</h2><a class="mono" href="/music/press/">All press releases {ARROW}</a></div>
      {press}
    </section>

    <section class="section m-section" id="credits" aria-labelledby="credits-title">
      <div class="m-head"><h2 id="credits-title">Credits</h2><a class="mono" href="/music/credits/Hero-One-Full-Credits-2026.pdf" data-no-swap>Full credits PDF {ARROW}</a></div>
      <ul class="m-credits">{credits}</ul>
    </section>

    <section class="section m-section" id="elsewhere" aria-labelledby="else-title">
      <div class="m-head"><h2 id="else-title">Elsewhere</h2></div>
      <div class="platforms m-platforms">{plats}</div>
    </section>'''
    write('music/index.html', page('/music/', 'Music · Hero One', 'Hero One’s music by year: songs streaming on heroone.art, press releases and full credits.', body, active='music', field=True,
          image='/assets/img/music/ldcat-1200.jpg'))

# ───────────────────────── /music/<slug>/ ─────────────────────────
def build_song(s):
    others = [o for o in SONGS if o['slug'] != s['slug']]
    p = PRESS.get(s['press'])
    c = s['cover']
    ld = {'@context': 'https://schema.org', '@type': 'MusicRecording', 'name': s['title'] + (f' ({s["subtitle"]})' if s['subtitle'] else ''),
          'url': f'{SITE}/music/{s["slug"]}/', 'image': f'{SITE}{c}-1200.jpg', 'byArtist': {'@type': 'MusicGroup', 'name': 'Hero One', 'url': SITE + '/'}}
    body = f'''    <section class="song-hero" aria-labelledby="song-title">
      <div class="song-hero__amb" aria-hidden="true"><img src="{c}-512.webp" alt=""></div>
      <div class="song-hero__inner">
        <figure class="song-hero__art">
          <img src="{c}-800.webp" srcset="{c}-800.webp 800w, {c}-1400.webp 1400w" sizes="(max-width: 900px) 86vw, 520px" width="800" height="800" alt="{esc(s['title'])} cover art" fetchpriority="high">
          {play_btn(s, 'song-hero__play', False)}
        </figure>
        <div class="song-hero__copy">
          <nav class="crumbs mono" aria-label="Breadcrumb"><a href="/music/">Music</a><span>/</span><a href="/music/#catalog">{s['year']}</a></nav>
          <h1 id="song-title"{' class="is-long"' if len(s['title']) > 14 else ''}>{esc(s['title'])}</h1>
          {f'<p class="song-hero__sub">{esc(s["subtitle"])}</p>' if s['subtitle'] else ''}
          <p class="song-hero__by">Hero One <span class="mono">· {dur(s['id'])}</span></p>
          <div class="song-hero__actions">
            {play_btn(s, 'button button--primary song-play')}
            {lyric_btn(s)}
            <a class="button button--ghost" href="/now-playing/{s['slug']}/">Now playing {ARROW}</a>
          </div>
          <ul class="song-links">
            <li><a href="/music/credits/{s['slug']}/"><span>Credits</span>{ARROW}</a></li>
            {f'<li><a href="/music/press/{p["slug"]}/"><span>Press release</span>{ARROW}</a></li>' if p else ''}
          </ul>
        </div>
      </div>
    </section>

    <section class="section song-story" aria-label="From the press release">
      <figure class="song-quote reveal">
        <blockquote>{esc(s['story'])}</blockquote>
        <figcaption class="mono">Hero One · {f'<a href="/music/press/{p["slug"]}/">Press release, {p["year"]}</a>' if p else ''}</figcaption>
      </figure>
    </section>

    {lyric_html(s)}

    <section class="section m-section" aria-labelledby="also-title">
      <div class="m-head"><h2 id="also-title">Also</h2><a class="mono" href="/music/">All music {ARROW}</a></div>
      <div class="m-songs">{''.join(song_card(o) for o in others)}</div>
    </section>'''
    write(f'music/{s["slug"]}/index.html', page(f'/music/{s["slug"]}/', f'{s["title"]} · Hero One', f'{s["title"]} by Hero One. Stream it on heroone.art.', body, active='music',
          image=f'{c}-1200.jpg', ld=ld))

# ───────────────────────── /now-playing/<slug>/ ─────────────────────────
def build_now_playing(s):
    c = s['cover']
    body = f'''    <section class="np-page" aria-labelledby="np-title">
      <div class="np-page__amb" aria-hidden="true"><img src="{c}-512.webp" alt=""></div>
      <div class="np-page__card">
        <img src="{c}-512.webp" width="512" height="512" alt="{esc(s['title'])} cover art">
        <p class="mono">Now playing on heroone.art</p>
        <h1 id="np-title">{esc(s['title'])}</h1>
        <p class="np-page__by">Hero One</p>
        <div class="np-page__actions">{play_btn(s, 'button button--primary song-play')}{lyric_btn(s)}<a class="button button--ghost" href="/music/{s['slug']}/">The song</a></div>
      </div>
    </section>'''
    write(f'now-playing/{s["slug"]}/index.html', page(f'/now-playing/{s["slug"]}/', f'Now playing: {s["title"]} · Hero One', f'Listen to {s["title"]} by Hero One on heroone.art.', body,
          image=f'{c}-1200.jpg', body_attr=f' data-now-playing="{s["id"]}" data-song-page="/music/{s["slug"]}/"', chrome=False))

# ───────────────────────── paper pages (press + credits indexes) ─────────────────────────
def paper(path, title, desc, inner, crumbs):
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}">
  <link rel="canonical" href="{SITE}{path}">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/brand/favicon-32.png?v=clean">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:image" content="{SITE}/assets/img/music/ldcat-1200.jpg">
  <link rel="stylesheet" href="/assets/css/credits.css">
  <meta name="hx-player" content="light">
{PERSIST_HEAD}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <div class="page">
  <header class="masthead"><div class="frame masthead-inner">
    <a class="wordmark" href="/" aria-label="Hero One, home">HERO ONE</a>
    <nav class="nav" aria-label="Music">
      <a href="/music/">Music</a>
      <a href="/music/press/"{' aria-current="page"' if 'press' in path else ''}>Press releases</a>
      <a href="/music/credits/"{' aria-current="page"' if 'credits' in path else ''}>Credits</a>
      <a class="hide-sm" href="/#contact" data-book>Book</a>
    </nav>
  </div></header>
  <main id="main" class="frame">
    <header class="index-hero">
      <div class="eyebrow"><span>{crumbs}</span><span>Hero One</span></div>
      <h1>{esc(title.split(' · ')[0])}</h1>
    </header>
{inner}
    <footer class="colophon">
      <span class="eyebrow">Hero One / Beats &amp; Blues</span>
      <nav aria-label="More"><a href="/music/">Music</a><a href="/">heroone.art ↗</a></nav>
    </footer>
  </main>
  </div>
{PERSIST_TAIL}
</body>
</html>
'''

def build_press_index():
    items = ''.join(f'''<li class="index-row">
        <a href="/music/press/{p['slug']}/">
          <span class="index-row__y">{p['year']}</span>
          <span class="index-row__t"><strong>{esc(p['title'])}</strong><em>{esc(p['lede'])}</em></span>
          <span class="index-row__go">Read →</span>
        </a>
        <a class="index-row__pdf" href="{p['pdf']}" data-no-swap>PDF ↓</a>
      </li>''' for p in CAT['press'])
    write('music/press/index.html', paper('/music/press/', 'Press releases · Hero One', 'Press releases from Hero One.', f'<ul class="index-list">{items}</ul>', 'Music / Press releases'))

def build_credits_index():
    items = ''.join(f'''<li class="index-row">
        <a href="/music/credits/{s['slug']}/">
          <img src="{s['cover']}-160.webp" alt="" width="64" height="64" loading="lazy">
          <span class="index-row__t"><strong>{esc(s['title'])}</strong></span>
          <span class="index-row__go">Credits →</span>
        </a>
      </li>''' for s in SONGS)
    pdf = '<p class="index-note"><a href="/music/credits/Hero-One-Full-Credits-2026.pdf" data-no-swap>Full credits, both records (PDF) ↓</a></p>'
    write('music/credits/index.html', paper('/music/credits/', 'Credits · Hero One', 'Full credits for Hero One’s records.', f'<ul class="index-list">{items}</ul>{pdf}', 'Music / Credits'))

# ───────────────────────── /magazine/ ─────────────────────────
def build_magazine():
    """Gallery: the pictures as a magazine you flip. Pages are plain <section>s (readable without JS);
    assets/js/magazine.js binds them into leaves and turns them in 3D (drag, swipe, keys, click)."""
    frames = MAG
    cover = next(f for f in frames if f['title'] == 'March 2024 Portrait')
    chapters = [('2024', 'Opulence'), ('2023', 'Portraits'), ('2016', 'Workaholix'), ('2015', 'Second studio'), ('2014', 'BBJN sessions'), ('2011', 'First stages')]
    by = {}
    for f in frames: by.setdefault(f['year'], []).append(f)
    pages, toc, thumbs = [], [], []
    def img(f, eager=False):
        lazy = '' if eager else ' loading="lazy"'
        return f'<img src="{f["thumb"]}" srcset="{f["thumb"]} 720w, {f["full"]} 1800w" sizes="(max-width: 900px) 92vw, 46vw" width="{f["w"]}" height="{f["h"]}" alt="{esc(f["title"])}"{lazy} decoding="async" draggable="false">'
    def zoom(f): return f'data-full="{f["full"]}" data-original="{f.get("original") or f["full"]}" data-title="{esc(f["title"])}" data-year="{f["year"]}"'
    # cover
    lines = ''.join(f'<li>{esc(l)}<span>{y}</span></li>' for y, l in chapters if by.get(y))
    pages.append(('Cover', '2026', f'''<section class="fb-page pg-cover" data-label="Cover">
        <button type="button" class="pg-zoom pg-cover__img" {zoom(cover)} aria-label="Open {esc(cover['title'])}">{img(cover, True)}</button>
        <p class="pg-cover__kicker">Hero One · Gallery · Edition 2026</p>
        <h1 class="pg-cover__title">HERO<br>ONE</h1>
        <ul class="pg-cover__lines">{lines}</ul>
      </section>'''))
    pages.append(('Contents', '', 'CONTENTS'))   # filled once page numbers are known
    for y, label in chapters:
        fs = by.get(y, [])
        if not fs: continue
        toc.append((label, y, len(pages)))
        names = ''.join(f'<li>{esc(f["title"])}</li>' for f in fs)
        pages.append((label, y, f'''<section class="fb-page pg-open" data-label="{esc(label)}">
        <p class="pg-folio">{y}</p>
        <h2 class="pg-open__title">{esc(label)}</h2>
        <ul class="pg-open__list">{names}</ul>
      </section>'''))
        for f in fs:
            land = f['w'] > f['h']
            thumbs.append((f, len(pages)))
            pages.append((label, y, f'''<section class="fb-page pg-frame{' pg-frame--land' if land else ''}" data-label="{esc(label)}">
        <button type="button" class="pg-zoom" {zoom(f)} aria-label="Open {esc(f['title'])}">{img(f)}</button>
        <p class="pg-cap"><span>{esc(f['title'])}</span><span class="pg-folio">{f['year']}</span></p>
      </section>'''))
    pages.append(('Back cover', '', f'''<section class="fb-page pg-back" data-label="Back cover">
        <img src="{MARK}" width="{MARK_W}" height="{MARK_H}" alt="Hero One">
        <p>Beats &amp; Blues Reality Music</p>
        <p class="pg-folio">heroone.art</p>
      </section>'''))
    if len(pages) % 2: pages.insert(-1, ('', '', '<section class="fb-page pg-blank" data-label="" aria-hidden="true"></section>'))
    contents = ''.join(f'<li><button type="button" data-goto="{i}"><span>{esc(l)}</span><span class="pg-folio">{y}</span></button></li>' for l, y, i in toc)
    pages[1] = ('Contents', '', f'''<section class="fb-page pg-contents" data-label="Contents">
        <p class="pg-folio">Contents</p>
        <ol class="pg-contents__list">{contents}</ol>
        <p class="pg-contents__hint">Drag a page corner, swipe, or use the arrow keys.</p>
      </section>''')
    strip = ''.join(f'<button type="button" class="fb-thumb" data-goto="{i}" aria-label="{esc(f["title"])}"><img src="{f["thumb"]}" alt="" loading="lazy" width="{f["w"]}" height="{f["h"]}" draggable="false"></button>' for f, i in thumbs)
    body = f'''    <section class="fb" aria-label="Hero One gallery, a magazine you can flip">
      <div class="fb-stage">
        <div class="fb-book" tabindex="0" aria-roledescription="magazine" aria-label="Gallery magazine. Use the left and right arrow keys to turn pages.">
{''.join(html for _, _, html in pages)}
        </div>
      </div>
      <div class="fb-bar">
        <button class="fb-btn fb-prev" type="button" aria-label="Previous page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
        <p class="fb-where" aria-live="polite"><span class="fb-where__l">Cover</span><span class="fb-where__y"></span></p>
        <button class="fb-btn fb-next" type="button" aria-label="Next page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
      </div>
      <div class="fb-progress" aria-hidden="true"><i></i></div>
      <nav class="fb-strip" aria-label="Every frame">{strip}</nav>
    </section>

    <dialog class="mz-box" id="mz-box" aria-label="Photograph">
      <button class="mz-box__x" type="button" aria-label="Close">×</button>
      <img alt="">
      <footer><span class="mz-box__t"></span><span class="mono mz-box__y"></span><a class="mz-box__dl mono" href="#" download>Download full resolution ↓</a></footer>
    </dialog>
    <script src="/assets/js/magazine.js" defer></script>'''
    write('gallery/index.html', page('/gallery/', 'Gallery · Hero One', 'Hero One’s gallery as a magazine you flip: portraits, stages and studios, 2011 to 2026.', body, active='gallery', theme='dark',
          css=('/assets/css/site.css', '/assets/css/magazine.css'), body_attr=' class="is-magazine"', image='/assets/img/og-image.jpg'))

# ───────────────────────── shared chrome inside hand-made pages ─────────────────────────
def refresh_chrome(rel, active=''):
    p = os.path.join(ROOT, rel); s = open(p, encoding='utf-8').read()
    s = re.sub(r'<header class="site-header">.*?</header>', header(active).replace('\\', '\\\\'), s, count=1, flags=re.S)
    s = re.sub(r'<footer class="site-footer">.*?</footer>', FOOTER.replace('\\', '\\\\'), s, count=1, flags=re.S)
    if 'book.css' not in s:
        s = re.sub(r'(<link rel="stylesheet" href="/assets/css/player.css(?:\?v=[0-9a-f]+)?" data-hx-persist>)', r'\1\n  <link rel="stylesheet" href="/assets/css/book.css" data-hx-persist>', s)
        s = s.replace('<link rel="stylesheet" href="/assets/css/player.css" data-hx-persist>', '<link rel="stylesheet" href="/assets/css/player.css" data-hx-persist>\n  <link rel="stylesheet" href="/assets/css/book.css" data-hx-persist>')
    if 'book.js' not in s:
        s = s.replace('<script src="/assets/js/player.js" data-hx-persist></script>', '<script src="/assets/js/player.js" data-hx-persist></script>\n  <script src="/assets/js/book.js" data-hx-persist></script>')
    open(p, 'w', encoding='utf-8').write(s)
    print('chrome', '/' + rel)

def stamp_assets():
    """Version every /assets/css|js reference with a content hash (?v=…), so a new deploy can
    never be shown with an old cached stylesheet or script."""
    import hashlib, glob
    cache = {}
    def ver(path):
        if path not in cache:
            f = os.path.join(ROOT, path.lstrip('/'))
            cache[path] = hashlib.sha256(open(f, 'rb').read()).hexdigest()[:10] if os.path.exists(f) else None
        return cache[path]
    def sub(m):
        v = ver(m.group(1))
        return m.group(1) + (f'?v={v}' if v else '')
    for f in glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True):
        if os.sep + 'tools' + os.sep in f: continue
        t = open(f, encoding='utf-8').read()
        n = re.sub(r'(/assets/(?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?', sub, t)
        if n != t: open(f, 'w', encoding='utf-8').write(n)

if __name__ == '__main__':
    build_music()
    for s in SONGS:
        build_song(s); build_now_playing(s)
    build_press_index(); build_credits_index(); build_magazine()
    refresh_chrome('index.html'); refresh_chrome('philosophy/index.html', 'philosophy'); refresh_chrome('404.html')
    stamp_assets()
