#!/usr/bin/env python3
"""Builds /music/<slug>/credits/index.html from tools/credits.json (the credits Hero One published).
Run from the repo root:  python3 tools/build_credits.py
Edit tools/credits.json to change a credit, then re-run. Text is used exactly as written there."""
import json, html, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT, 'tools', 'credits.json'), encoding='utf-8'))

def esc(s): return html.escape(s, quote=True)
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
def fmt(sec): sec = int(sec); return f'{sec // 60}:{sec % 60:02d}'
def iso(sec): sec = int(round(sec)); return f'PT{sec // 60}M{sec % 60}S'
def roman(n): return ['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1]

PLAY = '<svg class="play-i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg><svg class="pause-i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>'

def page(key, rec, other_key, other, n, total):
    groups = rec['groups']
    people, order = {}, []
    for g in groups:
        for role, names in g['rows']:
            for name in [x.strip() for x in names.split(',') if x.strip()]:
                if name not in people: people[name] = []; order.append(name)
                if role not in people[name]: people[name].append(role)
    roles_total = sum(len(g['rows']) for g in groups)
    meta = json.load(open(os.path.join(ROOT, 'assets', 'music', rec['track'] + '.json')))
    title, sub = rec['title'], rec.get('subtitle', '')
    url = f'https://heroone.art/music/{key}/credits/'
    img = f'/assets/img/music/{rec["track"]}'
    long = len(title) > 14

    def names_html(names):
        return ''.join(f'<span><a href="#p-{slug(x.strip())}">{esc(x.strip())}</a></span>' for x in names.split(',') if x.strip())

    blocks = []
    for i, g in enumerate(groups, 1):
        rows = ''.join(f'<div class="credit"><dt>{esc(r)}</dt><dd>{names_html(v)}</dd></div>' for r, v in g['rows'])
        blocks.append(f'<section class="block" id="{slug(g["name"])}" aria-labelledby="h-{slug(g["name"])}"><div class="block-head"><h2 id="h-{slug(g["name"])}"><i>{roman(i)}.</i>{esc(g["name"])}</h2></div><dl class="credits">{rows}</dl></section>')
    ranked = order   # order of appearance in the credits, never ranked
    ppl = ''.join(f'<li class="person" id="p-{slug(x)}"><h3>{esc(x)}</h3><p>{esc(", ".join(people[x]))}</p></li>' for x in ranked)
    k = len(groups) + 1
    blocks.append(f'<section class="block" id="contributors" aria-labelledby="h-contributors"><div class="block-head"><h2 id="h-contributors"><i>{roman(k)}.</i>Contributors</h2></div><ul class="people">{ppl}</ul></section>')
    rail = ''.join(f'<li><a href="#{slug(g["name"])}">{esc(g["name"])}</a></li>' for g in groups) + '<li><a href="#contributors">Contributors</a></li>'

    ld = {
        '@context': 'https://schema.org', '@type': 'MusicRecording', 'name': title + (f' ({sub})' if sub else ''), 'url': url,
        'duration': iso(meta['duration']), 'image': f'https://heroone.art{img}-1200.jpg',
        'byArtist': {'@type': 'MusicGroup', 'name': 'Hero One', 'url': 'https://heroone.art/'},
        'contributor': [{'@type': 'Role', 'roleName': r, 'contributor': {'@type': 'Person', 'name': x.strip()}} for g in groups for r, v in g['rows'] for x in v.split(',') if x.strip()],
    }
    other_img = f'/assets/img/music/{other["track"]}-160.webp'
    desc = rec['description']
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="author" content="Hero One">
  <meta name="description" content="{esc(desc)}">
  <meta name="hx-player" content="light">
  <title>{esc(title)} | Credits | Hero One</title>
  <link rel="canonical" href="{url}">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/brand/favicon-32.png">
  <link rel="apple-touch-icon" href="/assets/img/brand/apple-touch-icon.png">
  <meta property="og:type" content="music.song">
  <meta property="og:site_name" content="Hero One">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{esc(title)} · Full credits · Hero One">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:image" content="https://heroone.art{img}-1200.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preload" href="/assets/fonts/bodoni-moda-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/css/credits.css">
  <link rel="stylesheet" href="/assets/css/player.css" data-hx-persist>
  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
  <a class="skip" href="#main">Skip to credits</a>
  <div class="page">
  <header class="masthead"><div class="frame masthead-inner">
    <a class="wordmark" href="/" aria-label="Hero One, home">HERO ONE</a>
    <nav class="nav" aria-label="Credits">
      <a href="/music/">Press release</a>
      <a class="hide-sm" href="/music/{other_key}/credits/">{esc(other['title'])}</a>
      <a href="/music/credits/Hero-One-Full-Credits-2026.pdf" data-no-swap>PDF <span aria-hidden="true">↓</span></a>
      <button type="button" class="hide-sm" onclick="window.print()">Print <span aria-hidden="true">↗</span></button>
    </nav>
  </div></header>

  <main id="main" class="frame">
    <header class="hero">
      <figure class="sleeve">
        <img src="{img}-800.webp" srcset="{img}-800.webp 800w, {img}-1400.webp 1400w" sizes="(max-width: 960px) 90vw, 470px" width="800" height="800" alt="{esc(title)} cover art" fetchpriority="high">
        <button class="sleeve-play" type="button" data-play="{rec['track']}" aria-pressed="false" aria-label="Play {esc(title)}">{PLAY}</button>
      </figure>
      <div class="hero-copy">
        <div class="eyebrow"><span>Full credits</span><span>Beats &amp; Blues · 2026</span></div>
        <h1{' class="is-long"' if long else ''}>{esc(title)}</h1>
        {f'<p class="subtitle">{esc(sub)}</p>' if sub else ''}
        <p class="by">Hero One <span class="len">· {fmt(meta['duration'])}</span></p>
        <hr class="rule">
        <div class="actions">
          <button class="btn btn--solid" type="button" data-play="{rec['track']}" aria-pressed="false"><span class="dot" aria-hidden="true">{PLAY.replace('class="play-i"', 'class="play-i"')}</span><span data-play-label>Play</span></button>
          <a class="btn btn--plain" href="/music/">Read the press release</a>
        </div>
      </div>
    </header>

    <div class="notes">
      <aside class="rail" aria-label="On this page">
        <ol>{rail}</ol>
        <a class="other" href="/music/{other_key}/credits/"><img src="{other_img}" alt="" width="56" height="56" loading="lazy"><span>Also on heroone.art<strong>{esc(other['title'])}</strong></span></a>
      </aside>
      <div>{''.join(blocks)}</div>
    </div>

    <footer class="colophon">
      <span class="eyebrow">Hero One / Beats &amp; Blues</span>
      <nav aria-label="More"><a href="/music/credits/Hero-One-Full-Credits-2026.pdf" data-no-swap>Full credits, both records (PDF)</a><a href="/">heroone.art ↗</a></nav>
    </footer>
  </main>
  </div>
  <script src="/assets/js/music-config.js" data-hx-persist></script>
  <script src="/assets/js/player.js" data-hx-persist></script>
</body>
</html>
'''

keys = list(DATA)
for i, key in enumerate(keys):
    other_key = keys[(i + 1) % len(keys)]
    out = os.path.join(ROOT, 'music', key, 'credits')
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(page(key, DATA[key], other_key, DATA[other_key], i + 1, len(keys)))
    print('built', f'/music/{key}/credits/')
