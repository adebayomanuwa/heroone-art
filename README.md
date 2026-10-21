# heroone-art

The official Hero One artist website, **heroone.art**: Beats & Blues Reality Music by Adebayo Michael Manuwa.

The press kit / portfolio is a separate site and repo: **portfolio.heroone.art** (`adebayomanuwa/heroone`). This site links to it from the header, hero, journey, portfolio section, contact list, closing call-to-action and footer.

It's a plain static site with no build step and no dependencies. You can drop it into the repo root and it runs on GitHub Pages, Vercel, Netlify or any static host.

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `index.html` | Home: WebGL signal-field hero, identity bento, listen, 2024 campaign, journey timeline (2010 to 2026), philosophy band, filterable gallery with lightbox and full-res downloads, portfolio feature, registrations, contact |
| `/philosophy/` | `philosophy/index.html` | Philosophy hub |
| `/philosophy/law/` | `philosophy/law/index.html` | **Variety in Observable Consciousness**, the Law (first stated 20 October 2026) |
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
docs/ASSET_PROVENANCE.md  Where every asset came from + hashes
robots.txt  sitemap.xml  site.webmanifest  vercel.json  .nojekyll
```

## Design references

- **333BI OS** (`public/home.html`): the core palette and type system (ink `#06080f`, gold `#c9a84c`, teal `#4ff0e0`; Syne / DM Sans / IBM Plex Mono).
- **333Bi Tech** (latest implementation): glass header, signal-field shader, ticker, bento spotlight cards, segmented filters, doctrine grid, closing glow, footer grid.
- The Law page keeps its own editorial design (Bodoni Moda + Hanken Grotesk, light/dark aware, print-ready) and is linked into the site through a breadcrumb and footer links.

## Editing

- **Text:** edit `index.html` directly. Every section is plainly marked (`id="identity"`, `id="listen"`, `id="journey"`, …).
- **Add a gallery image:** export `<slug>.webp` (about 1800px) and `<slug>-sm.webp` (about 720px) into `assets/img/gallery/`, put the original at `assets/originals/hero-one-<slug>.jpg`, then copy one `<button class="shot" …>` block inside `.gallery` and change its `data-*` attributes. Use one of these categories: `portrait`, `studio`, `stage`, `campaign`, `legacy`. Update the count on the matching filter button.
- **Streaming numbers** (hero stats, portfolio section): search `319K+`, `151,108`, `109,410` and `59,268` in `index.html`.

## Deploy

Replace the contents of the `heroone-art` repo with this folder and push.

- **GitHub Pages:** if the custom domain is set in repo settings, Pages keeps it. If you use a `CNAME` file, add one containing `heroone.art`.
- **Vercel:** `vercel.json` adds security and long-cache headers, and no build settings are needed (Framework: Other).

The previous site's loose image files (`Hero One March 2024.jpg` and the rest) were renamed and moved into `assets/`. If anything outside this site hot-links the old file names, add a redirect or keep a copy at the old path.
