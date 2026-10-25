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
      slug: 'ldcat',
      page: '/music/ldcat/',
      credits: '/music/credits/ldcat/',
      press: '/music/press/ldcat-highest-currency-2026/',
      lyrics: '/lyrics/Hero One - LDCAT.txt',
    },
    {
      id: 'highest-currency',
      title: 'Highest Currency, Gotta Get it',
      full: 'Highest Currency, Gotta Get it',
      artist: 'Hero One',
      cover: '/assets/img/music/highest-currency-160.webp',
      art: '/assets/img/music/highest-currency-512.webp',
      slug: 'highest-currency-gotta-get-it',
      page: '/music/highest-currency-gotta-get-it/',
      credits: '/music/credits/highest-currency-gotta-get-it/',
      press: '/music/press/ldcat-highest-currency-2026/',
      lyrics: '/lyrics/Hero One - Highest Currency, Gotta Get it.txt',
    },
  ],
};
