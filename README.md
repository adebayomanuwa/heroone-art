# heroone-art

The official Hero One artist website, **heroone.art**: Beats & Blues Reality Music by Adebayo Michael Manuwa.

The press kit / portfolio is a separate site and repo: **portfolio.heroone.art** (`adebayomanuwa/heroone`). This site links to it from the header, hero, journey, portfolio section, contact list, closing call-to-action and footer.

It's a static site with no build step. Two small Vercel Functions in `/api` stream the songs from a private Supabase bucket and record first-party listening stats, so **host it on Vercel** (GitHub Pages can't run `/api`). Setup is in [`docs/MUSIC_AND_ANALYTICS.md`](docs/MUSIC_AND_ANALYTICS.md).

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `index.html` | Home: WebGL signal-field hero, identity bento, listen, 2024 campaign, journey timeline (2010 to 2026), philosophy band, filterable gallery with lightbox and full-res downloads, portfolio feature, registrations, contact |
| `/philosophy/` | `philosophy/index.html` | Philosophy hub |
| `/philosophy/law/` | `philosophy/law/index.html` | **Variety in Observable Consciousness**, the Law (first stated 20 October 2026) |
| `/music/` | `music/index.html` | Press release: LDCAT & Highest Currency, Gotta Get it (his design, with play buttons) + PDF |
| `/music/ldcat/credits/` | built by `tools/build_credits.py` | Full credits, LDCAT |
| `/music/highest-currency-gotta-get-it/credits/` | built by `tools/build_credits.py` | Full credits, Highest Currency, Gotta Get it |
| `/studio/` | `studio/index.html` | Private listener stats (sign-in, not indexed) |
| `/api/stream`, `/api/collect` | `api/*.js` | Signed stream links and listening events (Vercel Functions) |
| (any missing URL) | `404.html` | Not-found page (GitHub Pages / Vercel / Netlify pick it up automatically) |

## Structure

```text
index.html
404.html
philosophy/index.html
philosophy/law/index.html
assets/
  css/site.css            Design system (tokens, components, responsive)
  js/site.js              Header, menu, section highlight, spotlight cards, gallery, lightbox
  js/signal-field.js      WebGL hero background (falls back to a CSS gradient)
  fonts/                  Self-hosted woff2 (Syne, DM Sans, IBM Plex Mono, Bodoni Moda, Hanken Grotesk)
  img/gallery/            Optimised WebP: <slug>.webp (1800px) and <slug>-sm.webp (720px)
  img/brand/              Logo, label/registry logos, favicons
  img/og-image.jpg        Social share card (home)
  img/og-law.jpg          Social share card (the Law)
  originals/              Full-resolution original photos (offered as downloads in the lightbox)
  css/player.css          3nity Auracle player deck (HEAD rig, DivineTouch field)
  css/credits.css         Credits pages
  js/player.js            Site-wide player: persists across pages, signed streams, stats
  js/music-config.js      The songs (edit here to add one) + Supabase public keys for /studio
  music/<id>.json         Waveform + loudness envelope per song (no audio)
  img/music/              Cover art (160/512/800/1400 WebP, 1200 JPEG)
  img/auracle/            3nity Auracle HEAD layers
  vendor/                 supabase-js (studio sign-in only)
music/                    Press release, its PDF, credits pages, full credits PDF
studio/                   Listener dashboard
api/                      stream.js, collect.js, _lib.js (Vercel Functions)
supabase/migrations/      Database in its own `heroone` schema (safe inside the shared ManuwaPay project)
tools/                    build_credits.py + credits.json, peaks.py
docs/                     MUSIC_AND_ANALYTICS.md (setup), ASSET_PROVENANCE.md
robots.txt  sitemap.xml  site.webmanifest  vercel.json  package.json  .env.example  .gitignore
```

## Design references

- **333BI OS** (`public/home.html`): the core palette and type system (ink `#06080f`, gold `#c9a84c`, teal `#4ff0e0`; Syne / DM Sans / IBM Plex Mono).
- **333Bi Tech** (latest implementation): glass header, signal-field shader, ticker, bento spotlight cards, segmented filters, doctrine grid, closing glow, footer grid.
- **3nity Auracle** (333Bi Tech `AuracleHead.tsx`, `DivineField.tsx`): the player's HEAD rig and DivineTouch field. The HEAD boots once per session, its eyes and visor follow the record's loudness, the headset pulses on transients and severity tints only the visor.
- The press release and credits keep Hero One's paper / ink / oxblood editorial system (Bodoni Moda + Hanken Grotesk).
- The Law page keeps its own editorial design (Bodoni Moda + Hanken Grotesk, light/dark aware, print-ready) and is linked into the site through a breadcrumb and footer links.

## Editing

- **Text:** edit `index.html` directly. Every section is plainly marked (`id="identity"`, `id="listen"`, `id="journey"`, …).
- **Add a gallery image:** export `<slug>.webp` (about 1800px) and `<slug>-sm.webp` (about 720px) into `assets/img/gallery/`, put the original at `assets/originals/hero-one-<slug>.jpg`, then copy one `<button class="shot" …>` block inside `.gallery` and change its `data-*` attributes. Use one of these categories: `portrait`, `studio`, `stage`, `campaign`, `legacy`. Update the count on the matching filter button.
- **Songs:** `assets/js/music-config.js`, then follow *Adding a song later* in `docs/MUSIC_AND_ANALYTICS.md`.
- **Credits:** edit `tools/credits.json` and run `python3 tools/build_credits.py`.
- **Player look:** `assets/css/player.css` (tokens at the top).

## Deploy

1. Replace the contents of the `heroone-art` repo with this folder and push.
2. Import the repo in Vercel (Framework: Other, no build command) and point `heroone.art` + `www.heroone.art` at it.
3. Follow `docs/MUSIC_AND_ANALYTICS.md` once: Supabase project, migration, upload the two MP3s to the private `heroone-streams` bucket, Vercel environment variables, studio keys.

MP3s are git-ignored on purpose: the masters live only in the private bucket.

Root image cleanup: 17 duplicate photos were removed after SHA-256 verification against `assets/originals/`. The five original brand and registry images are preserved under `assets/originals/brand/`; the site uses the web versions in `assets/img/brand/`.
