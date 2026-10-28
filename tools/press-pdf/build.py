#!/usr/bin/env python3
"""Hero One · press release PDF (2 × A4). Text is Hero One's own, verbatim. Links are live."""
import json, html, os
SITE = '/home/claude/site'
OUT = os.path.dirname(os.path.abspath(__file__))
E = lambda s: html.escape(s, quote=True)
cred = json.load(open(f'{SITE}/tools/credits.json', encoding='utf-8'))

U = 'https://www.heroone.art'
REC = [
  dict(key='ldcat', id='ldcat', n='01', title='LDCAT (Love Don’t Cost a Thang)', short='LDCAT', len='2:35', cover='ldcat'),
  dict(key='highest-currency-gotta-get-it', id='highest-currency', n='02', title='Highest Currency, Gotta Get it', short='Highest Currency, Gotta Get it', len='1:45', cover='highest-currency'),
]
def grouped(key):
    out = []
    for g in cred[key]['groups']:
        by, order = {}, []
        for role, names in g['rows']:
            for x in [y.strip() for y in names.split(',') if y.strip()]:
                if x not in by: by[x] = []; order.append(x)
                if role not in by[x]: by[x].append(role)
        rows = ''.join(f'<li><b>{E(x)}</b><span>{E(", ".join(by[x]))}</span></li>' for x in order)
        out.append(f'<div class="cr"><p class="k">{E(g["name"])}</p><ul>{rows}</ul></div>')
    return ''.join(out)

FACE = f'file://{SITE}/assets/img/auracle/auracle-face-160.webp'
def listen(r):
    return (f'<a class="ln ln--play" href="{U}/now-playing/{r["key"]}/"><img src="{FACE}" alt="">Listen on heroone.art</a>'
            f'<a class="ln" href="{U}/music/credits/{r["key"]}/">Credits ↗</a>')

css = open(os.path.join(OUT, 'pr.css'), encoding='utf-8').read().replace('{SITE}', SITE)

records = ''.join(f'''<figure class="rec">
      <a class="art" href="{U}/music/{r['key']}/"><img src="file://{SITE}/assets/img/music/{r['cover']}-800.webp" alt="{E(r['short'])} cover art"></a>
      <figcaption><span class="no">{r['n']}</span><div><h2><a href="{U}/music/{r['key']}/">{E(r['title'])}</a></h2><p class="sub">Hero One</p></div></figcaption>
    </figure>''' for r in REC)

details = ''.join(f'''<section class="det">
      <header><p class="k">{r['n']}</p><h3>{E(r['title'])}</h3><p class="sub">Hero One</p></header>
      {grouped(r['key'])}
    </section>''' for r in REC)

PR = f'{U}/music/press/ldcat-highest-currency-2026/'
FACE160 = f'file://{SITE}/assets/img/auracle/auracle-face-160.webp'
def wave(id, n=64):
    pk = json.load(open(f'{SITE}/assets/music/{id}.json'))['peaks']
    step = len(pk) / n
    vals = [max(pk[int(i*step):max(int((i+1)*step), int(i*step)+1)]) for i in range(n)]
    lo, hi = min(vals), max(vals) or 1
    vals = [((v - lo) / ((hi - lo) or 1)) ** 1.6 for v in vals]
    m = 1
    w = 2.2
    bars = ''.join(f'<rect x="{i*w*1.6:.2f}" y="{(10 - max(.6, v/m*10)):.2f}" width="{w:.2f}" height="{max(1.2, v/m*20):.2f}" rx="{w/2:.2f}"/>' for i, v in enumerate(vals))
    return f'<svg class="wv" viewBox="0 0 {n*w*1.6:.1f} 20" preserveAspectRatio="none" aria-hidden="true">{bars}</svg>'
PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'
heads = ''.join(f'''<a class="trk" href="{U}/now-playing/{r['key']}/">
        <span class="tn">{r['n']}</span>
        <img class="tc" src="file://{SITE}/assets/img/music/{r['cover']}-160.webp" alt="">
        <span class="tt"><b>{E(r['title'])}</b><i>Hero One</i></span>
        {wave(r['id'])}
        <span class="td">{r['len']}</span>
        <span class="tp">{PLAY}</span>
      </a>''' for r in REC)
doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Hero One | LDCAT &amp; Highest Currency, Gotta Get it | Press Release</title>
<style>{css}</style></head><body>

<section class="page">
  <header class="mast"><a class="wm" href="{U}/">HERO ONE</a></header>
  <div class="label"><span class="red">Music / Press release</span><span>Hero One · 2026</span></div>
  <h1><span class="t">LDCAT</span><span class="amp">&amp;</span><em class="t">Highest Currency, Gotta Get it</em></h1>
  <p class="dek">Beats &amp; Blues</p>
  <div class="recs">{records}</div>
  <section class="release">
    <p class="k red">The release</p>
    <div class="body">
      <p>LDCAT was mastered in a coffee shop in downtown London, Ontario, but began in Lagos in 2023, originally as Outside. Arrangements took shape in 2025; the record was finished in 2026.</p>
      <p>Meanwhile, “Highest Currency, Gotta Get it” traces back through Massive Gang Nation, Lagos and Osogbo, Osun State. The new hook comes from that history. LDCAT leans Latin and Reggaeton; Highest Currency runs a different beat. Both work from Beats &amp; Blues.</p>
      <p>My theory, <a class="u" href="{U}/philosophy/law/"><em>Variety in Observable Consciousness</em></a>: “The observer, observation, observable, even ‘awareness’ and eventual expression all are circumscribed within TIME, choice, alteration and environment.”</p>
    </div>
  </section>
  <footer class="foot"><span>Hero One / Beats &amp; Blues</span><span></span><a href="{U}/">heroone.art ↗</a></footer>
</section>

<section class="page">
  <header class="mast"><a class="wm" href="{U}/">HERO ONE</a></header>
  <div class="label"><span class="red">Credits</span><span>Hero One · 2026</span></div>
  <div class="dets">{details}</div>

  <section class="deck">
    <a class="face" href="{U}/music/"><img src="{FACE160}" alt="3nity Auracle"></a>
    <div class="dk">
      {heads}
    </div>
  </section>

  <section class="about">
    <p class="k red">Contact</p>
    <dl class="contact">
      <div><dt>Booking</dt><dd><a href="mailto:mraltd@yahoo.com">mraltd@yahoo.com</a></dd></div>
      <div><dt>Management</dt><dd><a href="mailto:millenialrenaissance@yahoo.com">millenialrenaissance@yahoo.com</a></dd></div>
    </dl>
  </section>
  <footer class="foot"><span>Hero One / Beats &amp; Blues</span><span></span><a href="{U}/">heroone.art ↗</a></footer>
</section>
</body></html>'''
open(os.path.join(OUT, 'pr.html'), 'w', encoding='utf-8').write(doc)
print('ok')
