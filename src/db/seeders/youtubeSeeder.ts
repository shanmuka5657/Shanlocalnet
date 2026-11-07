/**
 * LocalNet YouTube Seeder — Downloads real Indian/Telugu content → S3 → DB
 * Uses yt-dlp for downloading (most reliable, handles all formats)
 * 
 * Install yt-dlp:  pip install yt-dlp
 * Windows path:    C:\Users\Haritha\AppData\Local\Python\pythoncore-3.15-64\Scripts\yt-dlp.exe
 */

import { IDatabaseClient } from '../postgresPool.ts';
import { spawn, execSync } from 'child_process';
import { existsSync, unlinkSync, readFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ── yt-dlp binary locations (checked in order) ───────────────────────────
const YTDLP_PATHS = [
  'yt-dlp',
  'C:\\Users\\Haritha\\AppData\\Local\\Python\\pythoncore-3.15-64\\Scripts\\yt-dlp.exe',
  'C:\\Python\\Scripts\\yt-dlp.exe',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
];

// Common Node.js locations for --js-runtimes flag
const NODE_PATHS = [
  'C:\\Program Files\\nodejs\\node.exe',
  'C:\\Program Files (x86)\\nodejs\\node.exe',
  '/usr/local/bin/node',
  '/usr/bin/node',
  'node',
];

// ── Telugu / Indian Entertainment search queries ──────────────────────────
export const TELUGU_QUERIES = [
  // Telugu dance
  'Kuchipudi dance performance Telugu',
  'Telugu folk dance village',
  'Andhra Pradesh traditional dance',
  'South India classical dance',
  'Bharatanatyam performance India',

  // Telugu / Indian festivals
  'Sankranti Telugu festival celebration',
  'Andhra Pradesh Dussehra festival',
  'India Diwali celebration',
  'India Holi festival colors',
  'Telugu Bonalu festival',

  // Telugu food & cooking
  'Hyderabad biryani cooking',
  'Andhra spicy food cooking',
  'Telugu traditional recipe',
  'South Indian street food',
  'Pesarattu upma Telugu breakfast',

  // Music & entertainment
  'Telugu folk music performance',
  'Carnatic music concert India',
  'India dhol drum performance',
  'Telugu comedian performance',
  'India village entertainment',

  // Culture & lifestyle
  'Andhra Pradesh village life',
  'Hyderabad old city street',
  'India temple ceremony ritual',
  'Telugu wedding ceremony',
  'India yoga morning',
];

// Andhra Pradesh / Telangana cities
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
];

export interface YTSeederProgress {
  downloaded: number;
  uploaded: number;
  failed: number;
  skipped: number;
  currentQuery: string;
  currentVideo: string;
  totalTarget: number;
  percentDone: number;
  isComplete: boolean;
  estimatedMinutesLeft: number;
  error?: string;
}

let _ytProgress: YTSeederProgress = {
  downloaded: 0, uploaded: 0, failed: 0, skipped: 0,
  currentQuery: '', currentVideo: '', totalTarget: 0,
  percentDone: 0, isComplete: true, estimatedMinutesLeft: 0
};
let _ytRunning = false;

export function getYTProgress(): YTSeederProgress { return { ..._ytProgress }; }
export function isYTRunning(): boolean { return _ytRunning; }

// ── Find yt-dlp binary ────────────────────────────────────────────────────
export function findYtDlp(): string | null {
  for (const p of YTDLP_PATHS) {
    try {
      execSync(`"${p}" --version`, { stdio: 'ignore' });
      return p;
    } catch {}
  }
  return null;
}

// ── Find Node.js binary for yt-dlp --js-runtimes ─────────────────────────
function findNodePath(): string | null {
  for (const p of NODE_PATHS) {
    try {
      execSync(`"${p}" --version`, { stdio: 'ignore' });
      return p;
    } catch {}
  }
  return null;
}

// ── Download a batch of videos for a search query ─────────────────────────
function downloadQuery(
  ytdlp: string,
  query: string,
  count: number,
  outDir: string
): Promise<{ id: string; filepath: string; title: string; duration: number; thumbnail: string }[]> {
  return new Promise((resolve) => {
    const results: any[] = [];
    let jsonBuf = '';

    const nodePath = findNodePath();
    const jsRuntimeArg = nodePath ? `node:${nodePath}` : 'node';

    const args = [
      `ytsearch${count}:${query}`,
      '--js-runtimes', jsRuntimeArg,
      '--format', 'mp4[height<=480][ext=mp4]/best[height<=480]/best[ext=mp4]/best',
      '--output', `${outDir}\\yt_%(id)s.%(ext)s`,
      '--match-filter', 'duration<=180',
      '--no-playlist',
      '--print-json',   // one JSON object per video on stdout after download
      '--no-warnings',
    ];

    console.log(`[YT Seeder] Searching: "${query}" (${count} videos) with js-runtime: ${jsRuntimeArg}`);
    const proc = spawn(`"${ytdlp}"`, args, { shell: true, windowsHide: true });

    proc.stdout?.on('data', (chunk: Buffer) => {
      jsonBuf += chunk.toString();
      // Parse complete JSON objects line by line
      const lines = jsonBuf.split('\n');
      jsonBuf = lines.pop() || ''; // keep incomplete line in buffer
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('{')) continue;
        try {
          const info = JSON.parse(trimmed);
          const id = info.id;
          const ext = info.ext || 'mp4';
          const filename = info._filename || info.filename || join(outDir, `yt_${id}.${ext}`);
          if (id && existsSync(filename)) {
            results.push({
              id,
              filepath: filename,
              title: info.fulltitle || info.title || query,
              duration: parseFloat(info.duration) || 30,
              thumbnail: info.thumbnail || ''
            });
            console.log(`[YT Seeder] ✅ Downloaded: ${info.fulltitle || id} (${info.duration}s)`);
          }
        } catch { /* incomplete JSON, wait for more chunks */ }
      }
    });

    proc.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim();
      if (line && !line.startsWith('[download]') && !line.startsWith('[youtube]') && !line.startsWith('WARNING')) {
        console.warn('[yt-dlp]', line.substring(0, 100));
      }
    });

    proc.on('close', (code) => {
      // Parse any remaining JSON in buffer
      if (jsonBuf.trim().startsWith('{')) {
        try {
          const info = JSON.parse(jsonBuf.trim());
          const id = info.id;
          const ext = info.ext || 'mp4';
          const filename = info._filename || info.filename || join(outDir, `yt_${id}.${ext}`);
          if (id && existsSync(filename)) {
            results.push({
              id,
              filepath: filename,
              title: info.fulltitle || info.title || query,
              duration: parseFloat(info.duration) || 30,
              thumbnail: info.thumbnail || ''
            });
          }
        } catch {}
      }
      console.log(`[YT Seeder] Query "${query}": ${results.length} videos downloaded (exit: ${code})`);
      resolve(results);
    });

    proc.on('error', (err: Error) => {
      console.error('[YT Seeder] Spawn error:', err.message);
      resolve(results);
    });
  });
}

// ── Main seeder entry point ───────────────────────────────────────────────
export async function seedFromYouTube(
  db: IDatabaseClient,
  s3Config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  },
  targetCount: number = 100,
  onProgress?: (p: YTSeederProgress) => void
): Promise<YTSeederProgress> {
  if (_ytRunning) throw new Error('YouTube seeder is already running.');

  const ytdlp = findYtDlp();
  if (!ytdlp) {
    throw new Error(
      'yt-dlp not found. Install it: pip install yt-dlp\n' +
      'Then add it to PATH or restart the server.'
    );
  }

  console.log(`[YT Seeder] Using yt-dlp: ${ytdlp}`);

  _ytRunning = true;
  _ytProgress = {
    downloaded: 0, uploaded: 0, failed: 0, skipped: 0,
    currentQuery: 'Initialising...', currentVideo: '',
    totalTarget: targetCount, percentDone: 0,
    isComplete: false, estimatedMinutesLeft: 0
  };

  const startTime = Date.now();
  const outDir = join(tmpdir(), 'localnet_yt');
  mkdirSync(outDir, { recursive: true });

  const s3 = new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey
    }
  });

  const emit = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = _ytProgress.uploaded / Math.max(1, elapsed);
    const remaining = targetCount - _ytProgress.uploaded;
    _ytProgress.percentDone = Math.round((_ytProgress.uploaded / targetCount) * 100);
    _ytProgress.estimatedMinutesLeft = rate > 0 ? Math.ceil((remaining / rate) / 60) : 0;
    onProgress?.({ ..._ytProgress });
    console.log(
      `[YT Seeder] ⬆ ${_ytProgress.uploaded}/${targetCount} | ` +
      `⬇ ${_ytProgress.downloaded} | ✗ ${_ytProgress.failed} | ` +
      `${_ytProgress.percentDone}%`
    );
  };

  try {
    // Ensure seed user exists
    await db.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ('seed_youtube', 'seed_youtube@localnet.in', 'creator', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `);

    const videosPerQuery = Math.max(2, Math.ceil(targetCount / TELUGU_QUERIES.length));

    outer:
    for (const query of TELUGU_QUERIES) {
      if (_ytProgress.uploaded >= targetCount) break;

      _ytProgress.currentQuery = query;
      emit();

      const videos = await downloadQuery(ytdlp, query, videosPerQuery, outDir);
      _ytProgress.downloaded += videos.length;

      for (const video of videos) {
        if (_ytProgress.uploaded >= targetCount) break outer;

        _ytProgress.currentVideo = video.title.slice(0, 60);
        emit();

        const postId = `yt_${video.id}`;

        try {
          // Skip if already in DB
          const exists = await db.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]);
          if (exists.rows.length > 0) { _ytProgress.skipped++; unlinkSafe(video.filepath); continue; }

          // Read downloaded file
          const videoBuffer = readFileSync(video.filepath);
          const ext = video.filepath.endsWith('.webm') ? 'webm' : 'mp4';
          const mime = ext === 'webm' ? 'video/webm' : 'video/mp4';

          // Upload to S3
          const s3Key = `videos_original/${postId}_${Date.now()}.${ext}`;
          await s3.send(new PutObjectCommand({
            Bucket: s3Config.bucket,
            Key: s3Key,
            Body: videoBuffer,
            ContentType: mime,
            Metadata: {
              'source': 'youtube',
              'original-id': video.id,
              'query': query,
            }
          }));

          const publicUrl = `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${s3Key}`;
          unlinkSafe(video.filepath);

          const city = CITIES[Math.floor(Math.random() * CITIES.length)];
          const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
          const likesCount = Math.floor(Math.random() * 12000) + 500;
          const viewsCount = Math.floor(Math.random() * 200000) + 5000;

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
              $1, 'seed_youtube', 'reel', 'organic', 'ORGANIC_ENTERTAINMENT',
              $2, $3,
              $4, $5, $6,
              '9:16', $7,
              ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
              $10, $11, 'India',
              'worldwide',
              $12, $13, 0, 0, 0
            ) ON CONFLICT (id) DO NOTHING;
          `, [
            postId,
            video.title.slice(0, 255),
            `${video.title} #telugu #india #andhra #shorts #localnet #viral`,
            publicUrl,
            video.thumbnail || '',
            gradient,
            Math.min(180, Math.max(3, video.duration)),
            city.lon, city.lat,
            city.city, city.state,
            likesCount, viewsCount,
          ]);

          _ytProgress.uploaded++;

        } catch (err: any) {
          console.error(`[YT Seeder] Failed for ${video.id}:`, err.message);
          _ytProgress.failed++;
          unlinkSafe(video.filepath);
        }
      }
    }
  } catch (err: any) {
    _ytProgress.error = err.message;
    console.error('[YT Seeder] Fatal error:', err.message);
  } finally {
    _ytProgress.isComplete = true;
    _ytRunning = false;
    emit();
    console.log(`[YT Seeder] ✅ Complete: uploaded=${_ytProgress.uploaded} failed=${_ytProgress.failed}`);
  }

  return { ..._ytProgress };
}

function unlinkSafe(filepath: string) {
  try { unlinkSync(filepath); } catch {}
}
