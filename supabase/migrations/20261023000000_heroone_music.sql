-- ═══════════════════════════════════════════════════════════════════
-- heroone.art · music streaming + first-party listening analytics
--
-- Built to live INSIDE an existing Supabase project (e.g. the one shared with
-- manuwapay / metameta3.com) without touching anything that is already there:
--   • every table lives in its own schema, `heroone` (never in `public`), and that
--     schema is not exposed to the REST API, so nothing changes for the other apps;
--   • the only doors in are five functions whose names all start with `heroone_`;
--   • the audio bucket is `heroone-streams` (private).
-- Nothing here drops, renames, alters or re-grants an existing object.
-- Safe to run more than once. Run in Supabase → SQL Editor.
--
--   heroone_log_events(jsonb)        server only (service role)  /api/collect, /api/stream
--   heroone_track(text)              server only (service role)  /api/stream
--   heroone_is_studio_admin()        signed-in users             /studio
--   heroone_studio_stats(int, text)  signed-in admins only       /studio
--
-- No raw IP addresses are stored: the server sends a salted hash that rotates daily.
-- ═══════════════════════════════════════════════════════════════════

create schema if not exists heroone;
revoke all on schema heroone from public, anon, authenticated;

-- ── Catalogue ──────────────────────────────────────────────────────
create table if not exists heroone.tracks (
  id            text primary key,                 -- slug used by the site, e.g. 'ldcat'
  title         text not null,
  artist        text not null default 'Hero One',
  storage_path  text not null,                    -- object path inside the private 'heroone-streams' bucket
  duration_s    real,
  is_live       boolean not null default true,    -- switch a song off without deleting its history
  created_at    timestamptz not null default now()
);

insert into heroone.tracks (id, title, storage_path, duration_s) values
  ('ldcat',            'LDCAT (Love Don’t Cost a Thang)', 'ldcat.mp3',            155.27),
  ('highest-currency', 'Highest Currency, Gotta Get it',  'highest-currency.mp3', 105.64)
on conflict (id) do update set title = excluded.title, storage_path = excluded.storage_path, duration_s = excluded.duration_s;

-- ── Event log (append-only) ────────────────────────────────────────
create table if not exists heroone.events (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  type          text not null check (type in (
                  'pageview',      -- a page on heroone.art was viewed
                  'stream_url',    -- server issued a signed streaming URL
                  'play',          -- playback started (one per listen)
                  'stream_30s',    -- 30 seconds listened in one listen
                  'q25','q50','q75',
                  'complete',      -- reached 90% and heard at least half
                  'pause','seek',
                  'stop'           -- listen ended / page left; carries total listened seconds
                )),
  track_id      text references heroone.tracks(id),
  listen_id     uuid,
  session_id    text,
  visitor_id    text,              -- random first-party id (absent with Global Privacy Control)
  ip_hash       text,              -- sha256(salt + day + ip); never the IP itself
  position_s    real,
  listened_s    real,
  page          text,
  referrer      text,
  referrer_host text,
  utm_source    text, utm_medium text, utm_campaign text,
  country       text, region text, city text, timezone text,
  lang          text,
  device        text, os text, browser text,
  screen        text
);
create index if not exists events_ts_idx        on heroone.events (ts desc);
create index if not exists events_type_ts_idx   on heroone.events (type, ts desc);
create index if not exists events_track_ts_idx  on heroone.events (track_id, ts desc);
create index if not exists events_listen_idx    on heroone.events (listen_id);

-- ── Who may see the studio ─────────────────────────────────────────
create table if not exists heroone.studio_admins (
  email      text primary key,
  added_at   timestamptz not null default now()
);
insert into heroone.studio_admins (email) values ('manuwaadebayo@gmail.com') on conflict do nothing;

alter table heroone.tracks        enable row level security;
alter table heroone.events        enable row level security;
alter table heroone.studio_admins enable row level security;
revoke all on all tables in schema heroone from public, anon, authenticated;

-- ── Server doors (service role only) ───────────────────────────────
create or replace function public.heroone_log_events(p_rows jsonb)
returns void
language sql volatile security definer set search_path = heroone, public
as $$
  insert into heroone.events (ts, type, track_id, listen_id, session_id, visitor_id, ip_hash, position_s, listened_s,
                              page, referrer, referrer_host, utm_source, utm_medium, utm_campaign,
                              country, region, city, timezone, lang, device, os, browser, screen)
  select coalesce(r.ts, now()), r.type, r.track_id, r.listen_id, r.session_id, r.visitor_id, r.ip_hash, r.position_s, r.listened_s,
         r.page, r.referrer, r.referrer_host, r.utm_source, r.utm_medium, r.utm_campaign,
         r.country, r.region, r.city, r.timezone, r.lang, r.device, r.os, r.browser, r.screen
  from jsonb_populate_recordset(null::heroone.events, p_rows) r
  limit 200;
$$;

create or replace function public.heroone_track(p_id text)
returns table (storage_path text, is_live boolean)
language sql stable security definer set search_path = heroone, public
as $$
  select t.storage_path, t.is_live from heroone.tracks t where t.id = p_id;
$$;

revoke all on function public.heroone_log_events(jsonb) from public, anon, authenticated;
revoke all on function public.heroone_track(text)       from public, anon, authenticated;
grant execute on function public.heroone_log_events(jsonb) to service_role;
grant execute on function public.heroone_track(text)       to service_role;

-- ── Studio doors (signed-in; stats only for heroone.studio_admins) ──
create or replace function public.heroone_is_studio_admin()
returns boolean
language sql stable security definer set search_path = heroone, public
as $$
  select exists (
    select 1 from heroone.studio_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.heroone_studio_stats(p_days int default 30, p_track text default null)
returns jsonb
language plpgsql stable security definer set search_path = heroone, public
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 3650)));
  result jsonb;
begin
  if not public.heroone_is_studio_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  with ev as (
    select * from heroone.events
    where ts >= since and (p_track is null or track_id = p_track or type = 'pageview')
  ),
  listens as (                     -- one row per listen
    select listen_id, min(track_id) as track_id,
           bool_or(type = 'stream_30s') as streamed,
           bool_or(type = 'complete')   as completed,
           max(coalesce(listened_s, 0)) as listened_s,
           min(coalesce(visitor_id, ip_hash)) as who,
           min(country) as country, min(city) as city,
           min(coalesce(nullif(utm_source, ''), nullif(referrer_host, ''), 'direct')) as source,
           min(device) as device, min(ts) as started
    from ev where listen_id is not null and type <> 'pageview'
    group by listen_id
    having bool_or(type = 'play')
  )
  select jsonb_build_object(
    'range_days', p_days,
    'generated_at', now(),
    'totals', jsonb_build_object(
      'pageviews',       (select count(*) from ev where type = 'pageview'),
      'visitors',        (select count(distinct coalesce(visitor_id, ip_hash)) from ev where type = 'pageview'),
      'plays',           (select count(*) from listens),
      'streams_30s',     (select count(*) from listens where streamed),
      'completions',     (select count(*) from listens where completed),
      'listeners',       (select count(distinct who) from listens),
      'listening_hours', (select round((coalesce(sum(listened_s), 0) / 3600.0)::numeric, 1) from listens)
    ),
    'tracks', coalesce((
      select jsonb_agg(t order by t->>'plays' desc) from (
        select jsonb_build_object(
          'id', tr.id, 'title', tr.title,
          'plays',        count(l.listen_id),
          'streams_30s',  count(l.listen_id) filter (where l.streamed),
          'completions',  count(l.listen_id) filter (where l.completed),
          'listeners',    count(distinct l.who),
          'avg_listen_s', round(coalesce(avg(l.listened_s), 0)::numeric, 0)
        ) as t
        from heroone.tracks tr left join listens l on l.track_id = tr.id
        group by tr.id, tr.title
      ) x), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'plays', coalesce(p.n, 0), 'streams', coalesce(p.s, 0), 'views', coalesce(v.n, 0)) order by d)
      from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') d
      left join (select date_trunc('day', started) dd, count(*) n, count(*) filter (where streamed) s from listens group by 1) p on p.dd = d
      left join (select date_trunc('day', ts) dd, count(*) n from ev where type = 'pageview' group by 1) v on v.dd = d
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'plays', n, 'streams', s) order by n desc)
      from (select source, count(*) n, count(*) filter (where streamed) s from listens group by source order by 2 desc limit 15) z
    ), '[]'::jsonb),
    'visit_sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', src, 'views', n) order by n desc)
      from (select coalesce(nullif(utm_source, ''), nullif(referrer_host, ''), 'direct') src, count(*) n
            from ev where type = 'pageview' group by 1 order by 2 desc limit 15) z
    ), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'city', city, 'plays', n, 'listeners', w) order by n desc)
      from (select coalesce(country, '??') country, coalesce(city, '') city, count(*) n, count(distinct who) w
            from listens group by 1, 2 order by 3 desc limit 25) z
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('device', device, 'plays', n) order by n desc)
      from (select coalesce(device, 'unknown') device, count(*) n from listens group by 1) z
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('page', page, 'views', n) order by n desc)
      from (select page, count(*) n from ev where type = 'pageview' group by 1 order by 2 desc limit 15) z
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r order by r->>'started' desc) from (
        select jsonb_build_object('started', started, 'track_id', track_id, 'country', country, 'city', city,
                                  'source', source, 'listened_s', round(listened_s::numeric, 0), 'completed', completed) r
        from listens order by started desc limit 30) q
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.heroone_studio_stats(int, text) from public, anon;
grant execute on function public.heroone_studio_stats(int, text) to authenticated;
revoke all on function public.heroone_is_studio_admin() from public, anon;
grant execute on function public.heroone_is_studio_admin() to authenticated;

-- ── Private audio bucket (served only through signed URLs) ─────────
insert into storage.buckets (id, name, public)
values ('heroone-streams', 'heroone-streams', false)
on conflict (id) do nothing;
