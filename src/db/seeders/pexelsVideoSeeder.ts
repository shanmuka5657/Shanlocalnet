/**
 * LocalNet Pixabay + Multi-Source Video Seeder
 * Pixabay API: free, still accepting keys at pixabay.com/accounts/api/
 * Rate limit: 100 requests/60s, 5000 results per query max
 * License: Pixabay Content License (free for commercial use, no attribution required)
 */

import { IDatabaseClient } from '../postgresPool.ts';

const CITIES = [
  { city: 'Kurnool',       state: 'Andhra Pradesh', lat: 15.8281, lon: 78.0373 },
  { city: 'Hyderabad',     state: 'Telangana',       lat: 17.3850, lon: 78.4867 },
  { city: 'Bengaluru',     state: 'Karnataka',       lat: 12.9716, lon: 77.5946 },
  { city: 'Mumbai',        state: 'Maharashtra',     lat: 19.0760, lon: 72.8777 },
  { city: 'Delhi',         state: 'Delhi',           lat: 28.6139, lon: 77.2090 },
  { city: 'Chennai',       state: 'Tamil Nadu',      lat: 13.0827, lon: 80.2707 },
  { city: 'Kolkata',       state: 'West Bengal',     lat: 22.5726, lon: 88.3639 },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh',  lat: 17.6868, lon: 83.2185 },
  { city: 'Vijayawada',    state: 'Andhra Pradesh',  lat: 16.5062, lon: 80.6480 },
  { city: 'Tirupati',      state: 'Andhra Pradesh',  lat: 13.6288, lon: 79.4192 },
  { city: 'Pune',          state: 'Maharashtra',     lat: 18.5204, lon: 73.8567 },
  { city: 'Nandyal',       state: 'Andhra Pradesh',  lat: 15.4786, lon: 78.4840 },
];

const CATEGORIES = [
  'dance', 'food', 'nature', 'city', 'fitness',
  'cooking', 'travel', 'fashion', 'music', 'people',
  'animals', 'technology', 'art', 'yoga', 'celebration',
  'lifestyle', 'culture', 'market', 'sports', 'sunset',
  'rain', 'children', 'wedding', 'restaurant', 'birds',
  'flowers', 'mountains', 'sea beach', 'night', 'village',
];

const GRADIENTS = [
  'from-amber-600 via-rose-600 to-indigo-900',
  'from-emerald-600 via-teal-600 to-cyan-900',
  'from-purple-600 via-pink-600 to-rose-900',
  'from-blue-600 via-indigo-600 to-violet-900',
  'from-orange-600 via-amber-600 to-yellow-700',
  'from-green-600 via-emerald-500 to-teal-800',
  'from-red-600 via-rose-600 to-pink-800',
  'from-sky-600 via-blue-600 to-indigo-800',
  'from-rose-600 via-orange-500 to-yellow-600',
  'from-slate-700 via-slate-600 to-zinc-800',
];

export interface SeederProgress {
  inserted: number;
  skipped: number;
  errors: number;
  currentCategory: string;
  currentPage: number;
  totalTarget: number;
  percentDone: number;
  isComplete: boolean;
  estimatedMinutesLeft: number;
  source: string;
}

let _progress: SeederProgress = {
  inserted: 0, skipped: 0, errors: 0,
  currentCategory: '', currentPage: 0,
  totalTarget: 0, percentDone: 0,
  isComplete: true, estimatedMinutesLeft: 0,
  source: ''
};
let _isRunning = false;

export function getSeedProgress(): SeederProgress { return { ..._progress }; }
export function isSeederRunning(): boolean { return _isRunning; }

// ── Main entry: auto-detect source from key format ────────────────────────
export async function seedVideos(
  db: IDatabaseClient,
  apiKey: string,
  source: 'pixabay' | 'pexels',
  targetCount: number = 10000,
  onProgress?: (p: SeederProgress) => void
): Promise<SeederProgress> {
  if (_isRunning) throw new Error('Seeder is already running.');

  if (source === 'pixabay') {
    return seedFromPixabay(db, apiKey, targetCount, onProgress);
  } else {
    return seedFromPexels(db, apiKey, targetCount, onProgress);
  }
}

// ── Pixabay Seeder ─────────────────────────────────────────────────────────
async function seedFromPixabay(
  db: IDatabaseClient,
  apiKey: string,
  targetCount: number,
  onProgress?: (p: SeederProgress) => void
): Promise<SeederProgress> {
  _isRunning = true;
  _progress = { inserted: 0, skipped: 0, errors: 0, currentCategory: 'Starting...', currentPage: 0, totalTarget: targetCount, percentDone: 0, isComplete: false, estimatedMinutesLeft: 0, source: 'pixabay' };

  const startTime = Date.now();
  const perPage = 200; // Pixabay max per page
  const videosPerCategory = Math.ceil(targetCount / CATEGORIES.length);
  const pagesPerCategory = Math.ceil(videosPerCategory / perPage);

  const emit = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = _progress.inserted / Math.max(1, elapsed);
    const remaining = targetCount - _progress.inserted;
    _progress.percentDone = Math.round((_progress.inserted / targetCount) * 100);
    _progress.estimatedMinutesLeft = rate > 0 ? Math.ceil((remaining / rate) / 60) : 0;
    onProgress?.({ ..._progress });
    console.log(`[Pixabay Seeder] ${_progress.inserted}/${targetCount} (${_progress.percentDone}%) | ${_progress.currentCategory} p${_progress.currentPage}`);
  };

  try {
    await db.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ('seed_pixabay', 'seed_pixabay@localnet.in', 'creator', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `);

    outer:
    for (const category of CATEGORIES) {
      _progress.currentCategory = category;

      for (let page = 1; page <= pagesPerCategory; page++) {
        _progress.currentPage = page;
        emit();

        try {
          const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(category)}&per_page=${perPage}&page=${page}&video_type=all&safesearch=true`;
          const res = await fetch(url);

          if (res.status === 429) {
            console.log('[Pixabay Seeder] Rate limited, waiting 65s...');
            await sleep(65000);
            page--; continue;
          }

          if (!res.ok) { _progress.errors++; continue; }

          const data = await res.json() as any;
          const hits: any[] = data.hits || [];
          if (!hits.length) break;

          for (const hit of hits) {
            if (_progress.inserted >= targetCount) break outer;

            const postId = `pixabay_${hit.id}`;
            const exists = await db.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]);
            if (exists.rows.length > 0) { _progress.skipped++; continue; }

            // Pick best available video URL — prefer large (HD), fallback to medium
            const videoUrl = hit.videos?.large?.url || hit.videos?.medium?.url || hit.videos?.small?.url;
            if (!videoUrl) { _progress.skipped++; continue; }

            const thumbnail = hit.userImageURL || '';
            const city = CITIES[Math.floor(Math.random() * CITIES.length)];
            const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
            const duration = Math.min(60, Math.max(3, hit.duration || 15));
            const title = `${cap(category)} — ${hit.user || 'Creator'}`;
            const description = `${cap(category)} video. #${category.replace(/\s+/g, '')} #shorts #localnet #reels`;
            const likesCount = Math.floor(Math.random() * 9000) + 100;
            const viewsCount = Math.floor(Math.random() * 120000) + 1000;

            try {
              await db.query(`
                INSERT INTO posts (
                  id, creator_id, content_type, classification, engine,
                  title, description,
                  media_url, media_thumbnail, media_gradient,
                  aspect_ratio, video_duration_seconds,
                  publishing_point, publishing_city, publishing_state, publishing_country,
                  audience_scope,
                  likes_count, views_count, comments_count, shares_count, saves_count
                ) VALUES (
                  $1, 'seed_pixabay', 'reel', 'organic', 'ORGANIC_ENTERTAINMENT',
                  $2, $3, $4, $5, $6, '9:16', $7,
                  ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
                  $10, $11, 'India', 'worldwide',
                  $12, $13, 0, 0, 0
                ) ON CONFLICT (id) DO NOTHING;
              `, [postId, title, description, videoUrl, thumbnail, gradient, duration, city.lon, city.lat, city.city, city.state, likesCount, viewsCount]);
              _progress.inserted++;
            } catch (dbErr: any) {
              console.warn('[Pixabay Seeder] DB error:', dbErr.message);
              _progress.errors++;
            }
          }

          // Respect 100 req/60s limit → ~650ms delay between requests
          await sleep(650);

        } catch (fetchErr: any) {
          console.error(`[Pixabay Seeder] Fetch error: ${fetchErr.message}`);
          _progress.errors++;
          await sleep(2000);
        }
      }
    }
  } finally {
    _progress.isComplete = true;
    _progress.percentDone = Math.round((_progress.inserted / targetCount) * 100);
    _isRunning = false;
    emit();
    console.log(`[Pixabay Seeder] ✅ Done: ${_progress.inserted} inserted, ${_progress.skipped} skipped, ${_progress.errors} errors`);
  }

  return { ..._progress };
}

// ── Pexels Seeder (kept for when they re-open key issuance) ───────────────
async function seedFromPexels(
  db: IDatabaseClient,
  apiKey: string,
  targetCount: number,
  onProgress?: (p: SeederProgress) => void
): Promise<SeederProgress> {
  _isRunning = true;
  _progress = { inserted: 0, skipped: 0, errors: 0, currentCategory: 'Starting...', currentPage: 0, totalTarget: targetCount, percentDone: 0, isComplete: false, estimatedMinutesLeft: 0, source: 'pexels' };

  const startTime = Date.now();
  const perPage = 80;
  const videosPerCategory = Math.ceil(targetCount / CATEGORIES.length);
  const pagesPerCategory = Math.ceil(videosPerCategory / perPage);

  const emit = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = _progress.inserted / Math.max(1, elapsed);
    _progress.percentDone = Math.round((_progress.inserted / targetCount) * 100);
    _progress.estimatedMinutesLeft = rate > 0 ? Math.ceil(((targetCount - _progress.inserted) / rate) / 60) : 0;
    onProgress?.({ ..._progress });
  };

  try {
    await db.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ('seed_pexels', 'seed_pexels@localnet.in', 'creator', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `);

    outer:
    for (const category of CATEGORIES) {
      _progress.currentCategory = category;
      for (let page = 1; page <= pagesPerCategory; page++) {
        _progress.currentPage = page;
        emit();
        try {
          const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(category)}&orientation=portrait&per_page=${perPage}&page=${page}`;
          const res = await fetch(url, { headers: { Authorization: apiKey } });
          if (res.status === 429) { await sleep(65000); page--; continue; }
          if (!res.ok) { _progress.errors++; continue; }
          const data = await res.json() as any;
          const videos: any[] = data.videos || [];
          if (!videos.length) break;
          for (const video of videos) {
            if (_progress.inserted >= targetCount) break outer;
            const postId = `pexels_${video.id}`;
            const exists = await db.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]);
            if (exists.rows.length > 0) { _progress.skipped++; continue; }
            const portraitFiles = (video.video_files || []).filter((f: any) => f.height > f.width && f.file_type === 'video/mp4').sort((a: any, b: any) => b.height - a.height);
            const videoFile = portraitFiles[0] || (video.video_files || [])[0];
            if (!videoFile?.link) { _progress.skipped++; continue; }
            const thumbnail = video.video_pictures?.[0]?.picture || '';
            const city = CITIES[Math.floor(Math.random() * CITIES.length)];
            const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
            try {
              await db.query(`
                INSERT INTO posts (id, creator_id, content_type, classification, engine, title, description, media_url, media_thumbnail, media_gradient, aspect_ratio, video_duration_seconds, publishing_point, publishing_city, publishing_state, publishing_country, audience_scope, likes_count, views_count, comments_count, shares_count, saves_count)
                VALUES ($1, 'seed_pexels', 'reel', 'organic', 'ORGANIC_ENTERTAINMENT', $2, $3, $4, $5, $6, '9:16', $7, ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography, $10, $11, 'India', 'worldwide', $12, $13, 0, 0, 0)
                ON CONFLICT (id) DO NOTHING;
              `, [postId, `${cap(category)} — ${video.user?.name || 'Creator'}`, `${cap(category)} #shorts #localnet`, videoFile.link, thumbnail, GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)], Math.min(60, video.duration || 15), city.lon, city.lat, city.city, city.state, Math.floor(Math.random() * 9000) + 100, Math.floor(Math.random() * 120000) + 1000]);
              _progress.inserted++;
            } catch { _progress.errors++; }
          }
          await sleep(300);
        } catch (err: any) { _progress.errors++; await sleep(1000); }
      }
    }
  } finally {
    _progress.isComplete = true;
    _isRunning = false;
    emit();
  }
  return { ..._progress };
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
