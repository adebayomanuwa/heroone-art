# heroone-art · repository tree (2026 roll out)

Drop this whole folder into the `adebayomanuwa/heroone-art` repository root (replacing the old files), commit and push. Then import the repo in Vercel and follow `docs/MUSIC_AND_ANALYTICS.md`.

MP3s are deliberately not in this tree, and `.gitignore` keeps them out. The masters go only into the private Supabase bucket `heroone-streams` (inside the shared ManuwaPay / metameta3 project).

```text
heroone-art/
├── api/
│   ├── _lib.js
│   ├── collect.js
│   └── stream.js
├── assets/
│   ├── css/
│   │   ├── credits.css
│   │   ├── player.css
│   │   └── site.css
│   ├── fonts/
│   │   ├── bodoni-moda-italic.woff2
│   │   ├── bodoni-moda-normal.woff2
│   │   ├── dm-sans-latin-wght-italic.woff2
│   │   ├── dm-sans-latin-wght.woff2
│   │   ├── hanken-grotesk-italic.woff2
│   │   ├── hanken-grotesk-normal.woff2
│   │   ├── ibm-plex-mono-latin-400.woff2
│   │   ├── ibm-plex-mono-latin-500.woff2
│   │   └── syne-latin-wght.woff2
│   ├── img/
│   │   ├── auracle/
│   │   │   ├── auracle-face-160.webp
│   │   │   ├── auracle-head-clean-512.webp
│   │   │   └── auracle-head-visor-tight-512.webp
│   │   ├── brand/
│   │   │   ├── apple-touch-icon.png
│   │   │   ├── bmi.webp
│   │   │   ├── favicon-32.png
│   │   │   ├── heroone-logo-480.png
│   │   │   ├── heroone-logo.webp
│   │   │   ├── icon-192.png
│   │   │   ├── icon-512.png
│   │   │   ├── mral.webp
│   │   │   ├── ogs.webp
│   │   │   └── soundexchange.webp
│   │   ├── gallery/
│   │   │   ├── bbjn-studio-2014-a-sm.webp
│   │   │   ├── bbjn-studio-2014-a.webp
│   │   │   ├── bbjn-studio-2014-b-sm.webp
│   │   │   ├── bbjn-studio-2014-b.webp
│   │   │   ├── dec-2023-a-sm.webp
│   │   │   ├── dec-2023-a.webp
│   │   │   ├── dec-2023-sm.webp
│   │   │   ├── dec-2023.webp
│   │   │   ├── first-award-2011-sm.webp
│   │   │   ├── first-award-2011.webp
│   │   │   ├── freshers-nite-2011-sm.webp
│   │   │   ├── freshers-nite-2011.webp
│   │   │   ├── march-2024-b-sm.webp
│   │   │   ├── march-2024-b.webp
│   │   │   ├── march-2024-sm.webp
│   │   │   ├── march-2024.webp
│   │   │   ├── mgn-studio-2015-sm.webp
│   │   │   ├── mgn-studio-2015.webp
│   │   │   ├── mgn-workaholix-2016-sm.webp
│   │   │   ├── mgn-workaholix-2016.webp
│   │   │   ├── performing-2011-sm.webp
│   │   │   ├── performing-2011.webp
│   │   │   ├── portrait-2023-b-sm.webp
│   │   │   ├── portrait-2023-b.webp
│   │   │   ├── portrait-2023-c-sm.webp
│   │   │   ├── portrait-2023-c.webp
│   │   │   ├── portrait-2023-sm.webp
│   │   │   ├── portrait-2023.webp
│   │   │   ├── vip-vibes-a-sm.webp
│   │   │   ├── vip-vibes-a.webp
│   │   │   ├── vip-vibes-b-sm.webp
│   │   │   ├── vip-vibes-b.webp
│   │   │   ├── vip-vibes-poster-sm.webp
│   │   │   └── vip-vibes-poster.webp
│   │   ├── music/
│   │   │   ├── highest-currency-1200.jpg
│   │   │   ├── highest-currency-1400.webp
│   │   │   ├── highest-currency-160.webp
│   │   │   ├── highest-currency-512.webp
│   │   │   ├── highest-currency-800.webp
│   │   │   ├── ldcat-1200.jpg
│   │   │   ├── ldcat-1400.webp
│   │   │   ├── ldcat-160.webp
│   │   │   ├── ldcat-512.webp
│   │   │   └── ldcat-800.webp
│   │   ├── og-image.jpg
│   │   └── og-law.jpg
│   ├── js/
│   │   ├── music-config.js
│   │   ├── player.js
│   │   ├── signal-field.js
│   │   └── site.js
│   ├── music/
│   │   ├── highest-currency.json
│   │   └── ldcat.json
│   ├── originals/
│   │   ├── brand/
│   │   │   ├── bmi-icon.webp
│   │   │   ├── heroone-logo.png
│   │   │   ├── mral-logo.png
│   │   │   ├── ogs-logo.png
│   │   │   └── soundexchange-logo.png
│   │   ├── hero-one-bbjn-studio-2014-a.jpg
│   │   ├── hero-one-bbjn-studio-2014-b.jpg
│   │   ├── hero-one-dec-2023-a.jpg
│   │   ├── hero-one-dec-2023.jpg
│   │   ├── hero-one-first-award-2011.jpg
│   │   ├── hero-one-freshers-nite-2011.jpg
│   │   ├── hero-one-march-2024-b.jpg
│   │   ├── hero-one-march-2024.jpg
│   │   ├── hero-one-mgn-studio-2015.jpg
│   │   ├── hero-one-mgn-workaholix-2016.jpg
│   │   ├── hero-one-performing-2011.jpg
│   │   ├── hero-one-portrait-2023-b.jpg
│   │   ├── hero-one-portrait-2023-c.jpg
│   │   ├── hero-one-portrait-2023.jpg
│   │   ├── hero-one-vip-vibes-a.jpg
│   │   ├── hero-one-vip-vibes-b.jpg
│   │   └── hero-one-vip-vibes-poster.jpg
│   └── vendor/
│       ├── 591.supabase.js
│       ├── supabase-js-2.45.4.umd.js
│       └── supabase-js.LICENSE
├── docs/
│   ├── ASSET_PROVENANCE.md
│   └── MUSIC_AND_ANALYTICS.md
├── music/
│   ├── credits/
│   │   └── Hero-One-Full-Credits-2026.pdf
│   ├── highest-currency-gotta-get-it/
│   │   └── credits/
│   │       └── index.html
│   ├── ldcat/
│   │   └── credits/
│   │       └── index.html
│   ├── Hero-One-Press-Release-2026.pdf
│   └── index.html
├── philosophy/
│   ├── law/
│   │   └── index.html
│   └── index.html
├── studio/
│   └── index.html
├── supabase/
│   └── migrations/
│       └── 20261023000000_heroone_music.sql
├── tools/
│   ├── build_credits.py
│   ├── credits.json
│   └── peaks.py
├── .env.example
├── .gitignore
├── .nojekyll
├── 404.html
├── index.html
├── package.json
├── README.md
├── robots.txt
├── site.webmanifest
├── sitemap.xml
├── TREE.md
└── vercel.json
```

## What's new in this tree

- `music/`: the press release (your design), its PDF, the two credits pages and the full credits PDF.
- `assets/js/player.js` + `assets/css/player.css`: the site-wide 3nity Auracle player (HEAD rig, DivineTouch field, waveform scrubber). It keeps playing as visitors move between pages.
- `api/`: signed streaming links and first-party listening events (Vercel Functions).
- `studio/`: your private listener dashboard.
- `supabase/migrations/`: the database, in its own `heroone` schema so it sits safely inside the shared ManuwaPay project.
- `tools/`: rebuild the credits pages or a waveform after a change.

## Suggested commit

In GitHub Desktop, on branch `reorganize-content`: Summary `Music: press release, credits, 3nity Auracle player, streaming + listener stats` → **Commit** → **Push origin** → **Preview / Create Pull Request** → merge into `main` (Vercel deploys `main` to heroone.art).
