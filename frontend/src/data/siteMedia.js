// Where the website's videos live (16 Oct 2026). They used to sit in public/,
// which put ~52 MB into every Vercel deployment and pushed the project past
// its deployment storage limit. They are now in file storage (Backblaze),
// served by the API with byte ranges so they stream and play on iPhones.
// Copied by backend/scripts/upload-site-videos.js. Poster images stay in
// public/ (small, and needed for the first paint).
//
// Always the production API: staging has no file storage of its own, and these
// are public, read-only files.
export const SITE_MEDIA = "https://api.arthaleads.com/api/media/arthaleads/site";
