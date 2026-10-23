# Music, streaming and listener stats

How heroone.art streams LDCAT and Highest Currency, Gotta Get it, and how you see who's listening.

## How it works

```text
Listener's browser                      Vercel (heroone.art)                Supabase (yours)
──────────────────                      ────────────────────                ────────────────
press Play  ──── GET /api/stream ─────▶ checks origin + bots
                                        looks up the track ───────────────▶ heroone_track()
                                        signs a 1-hour link ──────────────▶ private bucket: heroone-streams
                                        logs "stream_url" ────────────────▶ heroone_log_events()
            ◀──── { url, expires_in } ──
<audio> plays the signed link ──────────────────────────────────────────▶ (link dies after an hour)
listening ─────── POST /api/collect ──▶ adds city/country (Vercel edge),
  play · 30 s stream · 25/50/75 %       device, salted daily IP hash ─────▶ heroone_log_events()
  finish · pause · seek · stop
/studio/ ── magic-link sign-in ───────────────────────────────────────────▶ heroone_studio_stats() (admins only)
```

- **The songs are never public.** They sit in a private Supabase bucket. Each play gets its own signed link that expires (1 hour by default), so there's no permanent URL to share or scrape.
- **Your data is first-party.** No Google Analytics and no third-party trackers. Every event goes into your own Postgres table, and you can export it any time.
- **Location** comes from Vercel's edge headers (country, region, city). No IP lookups, and raw IPs are never stored. A salted hash that changes daily counts unique listeners.
- **What counts as a stream:** 30 seconds listened (the industry standard). "Finished" means the listener reached 90% and heard at least half of the song.
- **Your own plays don't count.** Opening `/studio/` once excludes that browser. You can switch it back on the studio page.
- **Honest limit:** anything a browser can play, a determined person can record. The signed links, the missing download button, and the origin and bot checks stop casual copying and make every play attributable. They can't make audio impossible to capture.

## Shared Supabase project (ManuwaPay / metameta3.com)

heroone.art lives inside your existing Supabase project, so you don't need a new one. It stays out of everything that's already there:

- **Its own schema.** Every heroone table sits in a separate schema called `heroone`, not in `public`. That schema isn't exposed to the API, so ManuwaPay and metameta3 can't see it, and it can't see them.
- **No name collisions.** Every function starts with `heroone_`, and the audio bucket is `heroone-streams`.
- **Nothing existing is touched.** The migration never drops, renames, alters or re-grants an object that's already there. It was tested against a project that already had its own `events` and `tracks` tables and a `streams` bucket, and all three were left untouched.

One honest trade-off: the service role key is the master key for the **whole** project, ManuwaPay included. It only ever lives in Vercel's server environment, never in a page or in GitHub. Treat the heroone.art Vercel project with the same care as ManuwaPay's.

## One-time setup (about 20 minutes)

1. **Run the migration.** In the ManuwaPay project, open SQL Editor → New query, paste the whole of `supabase/migrations/20261023000000_heroone_music.sql` and run it. It's safe to run again.
2. **Upload the masters.** Go to Storage → `heroone-streams` and upload:
   - `LDCAT.mp3`, renamed to **`ldcat.mp3`**
   - `Highest Currency Gotta Get it.mp3`, renamed to **`highest-currency.mp3`**

   Leave the bucket private.
3. **Host on Vercel.** Import `adebayomanuwa/heroone-art` (Framework preset: *Other*, no build command) and add `heroone.art` and `www.heroone.art` under Domains.
4. **Add the environment variables** in Vercel → Settings → Environment Variables:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | the same Project URL ManuwaPay uses |
   | `SUPABASE_SERVICE_ROLE_KEY` | the same `service_role` key (server only) |
   | `IP_SALT` | a **new** long random string, just for heroone.art |

   Then redeploy.
5. **Turn on the studio sign-in.**
   - In `assets/js/music-config.js`, set `supabaseUrl` and `supabaseAnonKey`: the same project URL and its public anon key.
   - In Supabase → Authentication → URL Configuration, **add** `https://heroone.art/studio/` to the Redirect URLs. Leave the existing Site URL as it is, because ManuwaPay depends on it.
   - Your email signs in with the account you already have in that project.
   - The magic-link email uses the project's existing email template, so it may carry ManuwaPay or metameta3 wording.
6. **Check it works.** Open heroone.art in a private window and play a song for 30 seconds. Then open `/studio/` in your normal browser and sign in.

## Tracking where listeners come from

Tag every link you post. The studio has a link builder, and the tags follow the visitor for the whole visit.

```text
https://heroone.art/music/?utm_source=instagram&utm_medium=story&utm_campaign=ldcat
https://heroone.art/?utm_source=tiktok&utm_medium=bio
```

Untagged visits fall back to the referring site (for example `open.spotify.com` or `x.com`), or "Direct" when there's no referrer.

## The studio (`/studio/`)

- Range: 7 days, 30 days, 90 days or 1 year, and a per-song filter.
- Tiles: plays, streams (30s+), unique listeners, % finished, hours listened, site visitors.
- Charts: plays and streams per day, and site visits per day. Each has a table view.
- Lists: songs, sources, cities and countries, devices, visit sources, top pages, and the last 30 listens.
- Without keys it shows a sample-data preview, so you can see the layout before setup.

## Booking requests (3nity Auracle chat)

The **Book** button on every page opens a 3nity Auracle chat. It asks what the request is about, who's asking, the reply email, when and where, and the details. Then it shows the request before sending.

- Performance, features, production and sync go to **Booking** (mraltd@yahoo.com). Press and management go to **Management** (millenialrenaissance@yahoo.com).
- **Send to the desk** saves the request privately in `heroone.bookings`. It appears in `/studio/` under *Booking requests*, with a reply link.
- Every request can also be sent as a ready-made email to the same desk ("Open in my email"). If saving ever fails, that becomes the main button, so a request is never lost.
- The same migration file creates the table and its two functions (`heroone_log_booking`, `heroone_studio_bookings`).

## Adding a song later

1. Upload `<id>.mp3` to the `heroone-streams` bucket.
2. Run in SQL: `insert into heroone.tracks (id, title, storage_path) values ('<id>', '<Title>', '<id>.mp3');`
3. Add the track to `assets/js/music-config.js` (id, slug, title, cover, art, page, credits, press) and to `tools/catalog.json` → `songs`.
4. Make covers in `assets/img/music/` (`<id>-160/512/800/1400.webp`, `<id>-1200.jpg`).
5. Generate `assets/music/<id>.json` (waveform and envelope) with `python3 tools/peaks.py <id> path/to/song.mp3`. This needs ffmpeg and numpy.
6. For credits: add the song to `tools/credits.json`. Then run `python3 tools/build_site.py && python3 tools/build_credits.py` to build its song page, its `/now-playing/` URL and its credits page.

To take a song down without redeploying: `update heroone.tracks set is_live = false where id = '<id>';`

## Privacy

There are no cookies. A random visitor id lives in localStorage and is skipped when the browser sends Global Privacy Control. IPs are hashed with a salt that rotates daily and are never stored raw. Bots are filtered out. All tables are closed to the public by row-level security: only the server writes, and only emails in `heroone.studio_admins` can read the stats.
