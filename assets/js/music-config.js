/* heroone.art · music + studio configuration (the only file to edit when adding songs). */
window.HERO_MUSIC = {
  api: '/api',                       // Vercel Functions on this domain: /api/stream and /api/collect
  analytics: true,                   // first-party listening + visit stats (no cookies, no third parties)

  // Supabase project (for the private /studio dashboard sign-in only).
  // Both values are public by design; the data itself is locked behind the database's row-level security.
  supabaseUrl: '',                   // e.g. 'https://abcdxyzcompany.supabase.co'
  supabaseAnonKey: '',               // Project Settings → API → anon public key

  tracks: [
    {
      id: 'ldcat',
      title: 'LDCAT',
      full: 'LDCAT (Love Don’t Cost a Thang)',
      artist: 'Hero One',
      cover: '/assets/img/music/ldcat-160.webp',
      art: '/assets/img/music/ldcat-512.webp',
      credits: '/music/ldcat/credits/',
    },
    {
      id: 'highest-currency',
      title: 'Highest Currency, Gotta Get it',
      full: 'Highest Currency, Gotta Get it',
      artist: 'Hero One',
      cover: '/assets/img/music/highest-currency-160.webp',
      art: '/assets/img/music/highest-currency-512.webp',
      credits: '/music/highest-currency-gotta-get-it/credits/',
    },
  ],
};
