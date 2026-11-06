/**
 * LocalNet Pexels Video Seeder
 * Seeds the database with real free short portrait videos from Pexels API.
 * Free API key: https://www.pexels.com/api/ (instant, no credit card)
 * Rate limit: 200 requests/hour, 20,000/month (free tier)
 */

import { IDatabaseClient } from '../postgresPool.ts';

// Indian city seeds for geographic distribution
const CITIES = [
  { city: 'Kurnool',       state: 'Andhra Pradesh', lat: 15.8281, lon: 78.0373 },
  { city: 'Hyderabad',     state: 'Telangana',       lat: 17.3850, lon: 78.4867 },
  { city: 'Bengaluru',     state: 'Karnataka',       lat: 12.9716, lon: 77.5946 },
  { city: 'Mumbai',        state: 'Maharashtra',     lat: 19.0760, lon: 72.8777 },
  { city: 'Delhi',         state: 'Delhi',           lat: 28.6139, lon: 77.2090 },
  { city: 'Chennai',       state: 'Tamil Nadu',      lat: 13.0827, lon: 80.2707 },
  { city: 'Kolkata',       state: 'West Bengal',     lat: 22.5726, lon: 88.3639 },
  { city: 'Pune',          state: 'Maharashtra',     lat: 18.5204, lon: 73.8567 },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh',  lat: 17.6868, lon: 83.2185 },
  { city: 'Vijayawada',    state: 'Andhra Pradesh',  lat: 16.5062, lon: 80.6480 },
  { city: 'Tirupati',      state: 'Andhra Pradesh',  lat: 13.6288, lon: 79.4192 },
  { city: 'Nandyal',       state: 'Andhra Pradesh',  lat: 15.4786, lon: 78.4840 },
];

// Diverse content categories for maximum variety
const CATEGORIES = [
  'dance', 'street food india', 'nature landscape', 'city life', 'fitness workout',
  'cooking recipe', 'travel adventure', 'fashion style', 'music performance', 'people portrait',
  'animals pets', 'technology', 'art craft', 'yoga meditation', 'celebration festival',
  'lifestyle', 'culture tradition', 'market shopping', 'comedy fun', 'sports',
  'flowers nature', 'sunset sky', 'rain monsoon', 'night city lights', 'children playing',
  'wedding ceremony', 'restaurant cafe', 'bicycle ride', 'swimming beach', 'farming village',
];

const GRADIENTS = [
  'from-amber-600 via-rose-600 to-indigo-900',
  'from-emerald-600 via-teal-600 to-cyan-900',
  'from-purple-600 via-pink-600 to-rose-900',
  'from-blue-600 via-indigo-600 to-violet-900',
  'from-orange-600 via-amber-600 to-yellow-700',
  'from-green-600 via-emerald-500 to-teal-800',
  'from-red-600 via-rose-600 to-pink-800',
  'from-slate-700 via-slate-600 to-zinc-800',
  'from-sky-600 via-blue-600 to-indigo-800',
  'from-rose-600 via-orange-500 to-yellow-600',
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
}

// Global state so it can be polled via API
let _progress: SeederProgress = {
  inserted: 0, skipped: 0, errors: 0,
  currentCategory: '', currentPage: 0,
  totalTarget: 0, percentDone: 0,
  isComplete: true, estimatedMinutesLeft: 0
};
let _isRunning = false;

export function getSeedProgress(): SeederProgress { return { ..._progress }; }
export function isSeederRunning(): boolean { return _isRunning; }

export async function seedVideosFromPexels(
  db: IDatabaseClient,
  pexelsApiKey: string,
  targetCount: number = 10000,
  onProgress?: (p: SeederProgress) => void
): Promise<SeederProgress> {
  if (_isRunning) throw new Error('Seeder is already running.');

  _isRunning = true;
  _progress = {
    inserted: 0, skipped: 0, errors: 0,
    currentCategory: 'Starting...', currentPage: 0,
    totalTarget: targetCount, percentDone: 0,
    isComplete: false, estimatedMinutesLeft: 0,
  };

  const startTime = Date.now();
  const perPage = 80; // Pexels max per page
  const videosPerCategory = Math.ceil(targetCount / CATEGORIES.length);
  const pagesPerCategory = Math.ceil(videosPerCategory / perPage);

  const emit = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = _progress.inserted / Math.max(1, elapsed); // videos/sec
    const remaining = targetCount - _progress.inserted;
    _progress.percentDone = Math.round((_progress.inserted / targetCount) * 100);
    _progress.estimatedMinutesLeft = rate > 0 ? Math.ceil((remaining / rate) / 60) : 0;
    onProgress?.({ ..._progress });
    console.log(`[Seeder] ${_progress.inserted}/${targetCount} (${_progress.percentDone}%) | cat: ${_progress.currentCategory} p${_progress.currentPage} | skipped: ${_progress.skipped} errors: ${_progress.errors}`);
  };

  try {
    // Ensure seed creator user exists in DB
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
          const apiUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(category)}&orientation=portrait&per_page=${perPage}&page=${page}`;
          const res = await fetch(apiUrl, {
            headers: { Authorization: pexelsApiKey }
          });

          // Handle rate limiting
          if (res.status === 429) {
            console.log('[Seeder] Rate limited — waiting 65s...');
            await sleep(65000);
            page--; // Retry same page
            continue;
          }

          if (!res.ok) {
            console.error(`[Seeder] HTTP ${res.status} for "${category}" page ${page}`);
            _progress.errors++;
            continue;
          }

          const data = await res.json() as any;
          const videos: any[] = data.videos || [];
          if (!videos.length) break; // No more results for this category

          for (const video of videos) {
            if (_progress.inserted >= targetCount) break outer;

            const postId = `pexels_${video.id}`;

            // Skip already inserted (idempotent seeder)
            const exists = await db.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]);
            if (exists.rows.length > 0) { _progress.skipped++; continue; }

            // Pick best portrait MP4 file (height > width, prefer HD)
            const portraitFiles = (video.video_files || [])
              .filter((f: any) => f.height > f.width && f.file_type === 'video/mp4')
              .sort((a: any, b: any) => b.height - a.height);

            const videoFile = portraitFiles[0] || (video.video_files || [])[0];
            if (!videoFile?.link) { _progress.skipped++; continue; }

            const thumbnail = video.video_pictures?.[0]?.picture || video.image || '';
            const city = CITIES[Math.floor(Math.random() * CITIES.length)];
            const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
            const duration = Math.min(60, Math.max(3, video.duration || 15));
            const title = `${cap(category)} — ${video.user?.name || 'Creator'}`;
            const description = `${cap(category)} short. #${category.replace(/\s+/g, '')} #shorts #localnet #reels`;
            const likesCount  = Math.floor(Math.random() * 9000) + 200;
            const viewsCount  = Math.floor(Math.random() * 150000) + 2000;

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
                  $1, 'seed_pexels', 'reel', 'organic', 'ORGANIC_ENTERTAINMENT',
                  $2, $3,
                  $4, $5, $6,
                  '9:16', $7,
                  ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
                  $10, $11, 'India',
                  'worldwide',
                  $12, $13, 0, 0, 0
                ) ON CONFLICT (id) DO NOTHING;
              `, [
                postId, title, description,
                videoFile.link, thumbnail, gradient,
                duration,
                city.lon, city.lat,
                city.city, city.state,
                likesCount, viewsCount,
              ]);
              _progress.inserted++;
            } catch (dbErr: any) {
              console.warn('[Seeder] DB insert error:', dbErr.message);
              _progress.errors++;
            }
          }

          // 300ms delay per page request — well within 200 req/hr limit
          await sleep(300);

        } catch (fetchErr: any) {
          console.error(`[Seeder] Fetch error: ${fetchErr.message}`);
          _progress.errors++;
          await sleep(1000);
        }
      }
    }
  } finally {
    _progress.isComplete = true;
    _progress.percentDone = Math.round((_progress.inserted / targetCount) * 100);
    _isRunning = false;
    emit();
    console.log(`[Seeder] ✅ Complete: ${_progress.inserted} inserted, ${_progress.skipped} skipped, ${_progress.errors} errors`);
  }

  return { ..._progress };
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
