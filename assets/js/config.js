/*
 * Loom Lah website settings.
 * While supabaseUrl or supabaseKey is empty the site runs in DEMO MODE:
 * sample products, a pretend checkout and sample Seconds listings, so you
 * can try everything before the backend is set up.
 *
 * The values below are safe to publish: the public ("anon"/"publishable")
 * key can only read what the database security rules allow.
 * Never put your HitPay API key or Supabase service key in this file.
 */
window.LOOMLAH_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseKey: '',      // Supabase > Project Settings > API Keys > anon / publishable key
  gaMeasurementId: 'G-QMEV2GBNY7',  // Google Analytics 4, e.g. 'G-ABC123XYZ' (leave empty to turn off)
  instagram: 'loomlah'
};
