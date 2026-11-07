/**
 * LocalNet YouTube Stream Seeder
 * Seeds video METADATA only (title, thumbnail, duration) — no file download.
 * Videos stream on-demand via /api/proxy-stream?id=VIDEO_ID which uses
 * yt-dlp to fetch a fresh signed YouTube CDN URL at play time.
 *
 * Advantages over the download seeder:
 *  - Instant seeding (no download / S3 upload wait)
 *  - Zero storage cost
 *  - Infinite content — not limited by disk/S3
 *  - Always fresh (yt-dlp fetches a new URL each time the video is played)
 */

import { IDatabaseClient } from '../postgresPool.ts';
import { spawn, execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Reuse yt-dlp binary locations from the download seeder
const YTDLP_PATHS = [
  'yt-dlp',
  'C:\\Users\\Haritha\\AppData\\Local\\Python\\pythoncore-3.15-64\\Scripts\\yt-dlp.exe',
  'C:\\Python\\Scripts\\yt-dlp.exe',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
];

const NODE_PATHS = [
  'C:\\Program Files\\nodejs\\node.exe',
  '/usr/local/bin/node',
  '/usr/bin/node',
  'node',
];

export function findYtDlpStream(): string | null {
  for (const p of YTDLP_PATHS) {
    try { execSync(`"${p}" --version`, { stdio: 'ignore' }); return p; } catch {}
  }
  return null;
}

export function findNodeStream(): string | null {
  for (const p of NODE_PATHS) {
    try { execSync(`"${p}" --version`, { stdio: 'ignore' }); return p; } catch {}
  }
  return null;
}

// ── Default Telugu/Indian categories ─────────────────────────────────────
export const STREAM_DEFAULT_QUERIES = [
  'Kuchipudi dance performance Telugu',
  'Telugu folk dance village',
  'Andhra Pradesh traditional dance',
  'South India classical dance',
  'Bharatanatyam performance India',
  'Sankranti Telugu festival celebration',
  'Andhra Pradesh Dussehra festival',
  'India Diwali celebration',
  'India Holi festival colors',
  'Telugu Bonalu festival',
  'Hyderabad biryani cooking',
  'Andhra spicy food cooking',
  'Telugu traditional recipe',
  'South Indian street food',
  'Telugu folk music performance',
  'Carnatic music concert India',
  'Andhra Pradesh village life',
  'India temple ceremony ritual',
  'Telugu wedding ceremony',
  'India yoga morning',
];

const CITIES = [
  { city: 'Kurnool',       state: 'Andhra Pradesh', lat: 15.8281, lon: 78.0373 },
  { city: 'Hyderabad',     state: 'Telangana',       lat: 17.3850, lon: 78.4867 },
  { city: 'Vijayawada',    state: 'Andhra Pradesh',  lat: 16.5062, lon: 80.6480 },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh',  lat: 17.6868, lon: 83.2185 },
  { city: 'Tirupati',      state: 'Andhra Pradesh',  lat: 13.6288, lon: 79.4192 },
  { city: 'Guntur',        state: 'Andhra Pradesh',  lat: 16.3067, lon: 80.4365 },
  { city: 'Warangal',      state: 'Telangana',       lat: 17.9784, lon: 79.5941 },
  { city: 'Nandyal',       state: 'Andhra Pradesh',  lat: 15.4786, lon: 78.4840 },
];

const GRADIENTS = [
  'from-amber-600 via-rose-600 to-indigo-900',
  'from-emerald-600 via-teal-600 to-cyan-900',
  'from-purple-600 via-pink-600 to-rose-900',
  'from-orange-600 via-amber-600 to-yellow-700',
  'from-green-600 via-emerald-500 to-teal-800',
  'from-red-600 via-rose-600 to-pink-800',
  'from-sky-600 via-blue-600 to-indigo-800',
];

export interface StreamSeederProgress {
  inserted: number;
  skipped: number;
  errors: number;
  currentQuery: string;
  totalTarget: number;
  percentDone: number;
  isComplete: boolean;
  source: 'stream';
}

let _streamProgress: StreamSeederProgress = {
  inserted: 0, skipped: 0, errors: 0, currentQuery: '',
  totalTarget: 0, percentDone: 0, isComplete: true, source: 'stream'
};
let _streamRunning = false;

export function getStreamProgress(): StreamSeederProgress { return { ..._streamProgress }; }
export function isStreamRunning(): boolean { return _streamRunning; }

// ── Fetch metadata for N videos matching a query (no download) ────────────
function fetchMetadata(
  ytdlp: string,
  query: string,
  count: number,
  nodePath: string | null
): Promise<{ id: string; title: string; duration: number; thumbnail: string; channel: string }[]> {
  return new Promise((resolve) => {
    const jsRuntimeArg = nodePath ? `node:${nodePath}` : 'node';
    let stdoutBuf = '';

    const args = [
      `ytsearch${count}:${query}`,
      '--js-runtimes', jsRuntimeArg,
      '--remote-components', 'ejs:github',
      '--skip-download',   // ← KEY: never download anything
      '--print-json',
      '--no-warnings',
      '--quiet',
    ];

    const proc = spawn(ytdlp, args, { shell: false, windowsHide: true });

    proc.stdout?.on('data', (chunk: Buffer) => { stdoutBuf += chunk.toString(); });

    proc.on('close', () => {
      const results: any[] = [];
      const lines = stdoutBuf.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('{')) continue;
        try {
          const info = JSON.parse(t);
          if (info.id) {
            results.push({
              id: info.id,
              title: info.fulltitle || info.title || query,
              duration: Math.round(info.duration || 30),
              thumbnail: info.thumbnail || '',
              channel: info.uploader || info.channel || ''
            });
          }
        } catch {}
      }
      console.log(`[StreamSeeder] "${query}": ${results.length} metadata entries (exit: 0)`);
      resolve(results);
    });

    proc.on('error', () => resolve([]));
  });
}

// ── Main entry ────────────────────────────────────────────────────────────
export async function seedStreamMetadata(
  db: IDatabaseClient,
  targetCount: number = 100,
  customQueries?: string[],
  onProgress?: (p: StreamSeederProgress) => void
): Promise<StreamSeederProgress> {
  if (_streamRunning) throw new Error('Stream seeder already running.');

  const ytdlp = findYtDlpStream();
  if (!ytdlp) throw new Error('yt-dlp not found. Run: pip install yt-dlp');

  const nodePath = findNodeStream();

  _streamRunning = true;
  _streamProgress = {
    inserted: 0, skipped: 0, errors: 0, currentQuery: 'Starting...',
    totalTarget: targetCount, percentDone: 0, isComplete: false, source: 'stream'
  };

  const emit = () => {
    _streamProgress.percentDone = Math.round((_streamProgress.inserted / targetCount) * 100);
    onProgress?.({ ..._streamProgress });
    console.log(`[StreamSeeder] ⬆ ${_streamProgress.inserted}/${targetCount} | "${_streamProgress.currentQuery}"`);
  };

  const isCustom = customQueries && customQueries.length > 0;
  const queriesToRun = isCustom ? customQueries! : STREAM_DEFAULT_QUERIES;
  const perQuery = Math.max(8, Math.ceil(targetCount / queriesToRun.length));

  try {
    // Ensure creator user exists
    await db.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ('seed_stream', 'seed_stream@localnet.in', 'creator', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `);

    outer:
    for (const query of queriesToRun) {
      if (_streamProgress.inserted >= targetCount) break;
      _streamProgress.currentQuery = query;
      emit();

      const videos = await fetchMetadata(ytdlp, query, perQuery, nodePath);

      for (const v of videos) {
        if (_streamProgress.inserted >= targetCount) break outer;

        const postId = `yt_${v.id}`;

        // Skip if already in DB
        const exists = await db.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]);
        if (exists.rows.length > 0) { _streamProgress.skipped++; continue; }

        // The video URL points to our streaming proxy — no S3 needed
        const proxyUrl = `/api/proxy-stream?id=${v.id}`;
        const city = CITIES[Math.floor(Math.random() * CITIES.length)];
        const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

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
              $1, 'seed_stream', 'reel', 'organic', 'ORGANIC_ENTERTAINMENT',
              $2, $3,
              $4, $5, $6,
              '9:16', $7,
              ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
              $10, $11, 'India', 'worldwide',
              $12, $13, 0, 0, 0
            ) ON CONFLICT (id) DO NOTHING;
          `, [
            postId,
            v.title.slice(0, 255),
            `${v.title} #telugu #india #andhra #localnet #shorts`,
            proxyUrl,                              // ← proxy URL, not S3
            v.thumbnail,
            gradient,
            Math.min(600, Math.max(3, v.duration)),
            city.lon, city.lat, city.city, city.state,
            Math.floor(Math.random() * 9000) + 200,
            Math.floor(Math.random() * 120000) + 1000,
          ]);
          _streamProgress.inserted++;
          emit();
        } catch (err: any) {
          console.warn('[StreamSeeder] DB error:', err.message?.substring(0, 80));
          _streamProgress.errors++;
        }
      }

      // Small delay between queries to avoid rate limiting
      await new Promise(r => setTimeout(r, 400));
    }
  } catch (err: any) {
    console.error('[StreamSeeder] Fatal:', err.message);
  } finally {
    _streamProgress.isComplete = true;
    _streamRunning = false;
    emit();
    console.log(`[StreamSeeder] ✅ Done: ${_streamProgress.inserted} inserted, ${_streamProgress.skipped} skipped`);
  }

  return { ..._streamProgress };
}
