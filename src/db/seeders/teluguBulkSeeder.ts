/**
 * LocalNet — Telugu Bulk Seeder (Parallel Worker Pool)
 *
 * Downloads Telugu short videos (2–3 min) from YouTube → S3 → PostgreSQL
 * using N parallel yt-dlp workers for maximum throughput.
 *
 * Usage (via API):
 *   POST /api/admin/telugu-bulk-seed
 *   { "target": 10000, "workers": 10 }
 *
 * Architecture:
 *   queryQueue   — 260+ Telugu search queries, shuffled each run
 *   workerPool   — N async workers pulling from the queue concurrently
 *   processedIds — shared Set prevents duplicate S3 uploads across workers
 *   archive_N.txt — per-worker yt-dlp archive prevents re-downloads
 *
 * Duration filter: 90–210 s (≈1.5–3.5 min).  yt-dlp checks duration
 * from the video metadata BEFORE downloading, so nothing outside that
 * range ever touches disk.
 *
 * Speed estimate (10 workers, ~50 Mbps connection):
 *   ~20–25 s per video (download + S3 upload)
 *   10 workers × 25 s = ~1 video/2.5 s aggregate
 *   10,000 videos ÷ 1,440 per hour ≈ 7–8 hours (run overnight)
 *
 * YouTube rate-limit note:
 *   yt-dlp adds a 1–3 s sleep between downloads automatically.
 *   Running more than 15 workers risks IP throttling / CAPTCHAs.
 *   Default is 10; safe max is 15.
 */

import { IDatabaseClient } from '../postgresPool.ts';
import { spawn, execSync } from 'child_process';
import {
  unlinkSync, readFileSync, mkdirSync, readdirSync,
  existsSync, appendFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ── yt-dlp / Node paths ──────────────────────────────────────────────────────
const YTDLP_PATHS = [
  'yt-dlp',
  'C:\\Users\\Haritha\\AppData\\Local\\Python\\pythoncore-3.15-64\\Scripts\\yt-dlp.exe',
  'C:\\Python\\Scripts\\yt-dlp.exe',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
];
const NODE_PATHS = [
  'C:\\Program Files\\nodejs\\node.exe',
  'C:\\Program Files (x86)\\nodejs\\node.exe',
  '/usr/local/bin/node',
  '/usr/bin/node',
  'node',
];

function findYtDlp(): string | null {
  for (const p of YTDLP_PATHS) {
    try { execSync(`"${p}" --version`, { stdio: 'ignore' }); return p; }
    catch { /* try next */ }
  }
  return null;
}
function findNodePath(): string | null {
  for (const p of NODE_PATHS) {
    try { execSync(`"${p}" --version`, { stdio: 'ignore' }); return p; }
    catch { /* try next */ }
  }
  return null;
}

// ── Geo metadata (Telugu states) ─────────────────────────────────────────────
const CITIES = [
  { city: 'Kurnool',       state: 'Andhra Pradesh', lat: 15.8281, lon: 78.0373 },
  { city: 'Hyderabad',     state: 'Telangana',       lat: 17.3850, lon: 78.4867 },
  { city: 'Vijayawada',    state: 'Andhra Pradesh',  lat: 16.5062, lon: 80.6480 },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh',  lat: 17.6868, lon: 83.2185 },
  { city: 'Tirupati',      state: 'Andhra Pradesh',  lat: 13.6288, lon: 79.4192 },
  { city: 'Guntur',        state: 'Andhra Pradesh',  lat: 16.3067, lon: 80.4365 },
  { city: 'Warangal',      state: 'Telangana',       lat: 17.9784, lon: 79.5941 },
  { city: 'Nandyal',       state: 'Andhra Pradesh',  lat: 15.4786, lon: 78.4840 },
  { city: 'Rajahmundry',   state: 'Andhra Pradesh',  lat: 17.0050, lon: 81.7799 },
  { city: 'Nellore',       state: 'Andhra Pradesh',  lat: 14.4426, lon: 79.9865 },
];

const GRADIENTS = [
  'from-amber-600 via-rose-600 to-indigo-900',
  'from-emerald-600 via-teal-600 to-cyan-900',
  'from-purple-600 via-pink-600 to-rose-900',
  'from-orange-600 via-amber-600 to-yellow-700',
  'from-blue-600 via-indigo-600 to-purple-900',
  'from-red-600 via-orange-600 to-yellow-700',
  'from-teal-600 via-cyan-600 to-blue-900',
  'from-pink-600 via-rose-600 to-red-900',
];

// ── 260+ Telugu search queries ───────────────────────────────────────────────
// These cover: movie songs, trailers, actor collections, comedy shows,
// short films, devotional, cooking, culture, festivals, tourism, tech,
// sports, year-variant queries.  Shuffled at runtime for variety.

export const TELUGU_BULK_QUERIES: string[] = [
  // ─ Movie Trailers (trailers are typically 2–3 min — best yield) ──────────
  'RRR official Telugu trailer',
  'Pushpa Telugu official trailer',
  'Baahubali Telugu trailer',
  'Ala Vaikunthapurramuloo trailer Telugu',
  'Arjun Reddy Telugu official trailer',
  'Geetha Govindam trailer Telugu',
  'Fidaa Telugu official trailer',
  'Uppena Telugu official trailer',
  'Bheeshma Telugu trailer',
  'Taxiwaala Telugu trailer',
  'Agent Sai Srinivasa Telugu trailer',
  'World Famous Lover Telugu trailer',
  'Disco Raja Telugu trailer',
  'V Telugu movie trailer',
  'Most Eligible Bachelor Telugu trailer',
  'Ante Sundaraniki Telugu trailer',
  'Sriram Shankar Telugu trailer',
  'Kanche Telugu movie trailer',
  'Rangasthalam Telugu trailer',
  'Khaidi No 150 Telugu trailer',
  'DJ Duvvada Jagannadham trailer',
  'Oopiri Telugu movie trailer',
  'Aravinda Sametha trailer Telugu',
  'Vinaya Vidheya Rama trailer Telugu',
  'Sye Raa Narasimha Reddy trailer',
  'Saaho Telugu trailer',
  'Srimanthudu Telugu trailer',
  'Bharat Ane Nenu trailer Telugu',
  'Maharshi Telugu trailer',
  'Spyder Telugu trailer',
  'Sarkar Telugu trailer',
  'Nannaku Prematho trailer Telugu',
  'S/O Satyamurthy trailer Telugu',
  'A Aa Telugu movie trailer',
  'Pelli Choopulu Telugu trailer',
  'Babu Bangaram Telugu trailer',
  'Janatha Garage trailer Telugu',
  'Julayi Telugu movie trailer',
  'Dookudu Telugu trailer',
  'Sye Telugu movie trailer',
  'Magadheera Telugu trailer',
  'Pokiri Telugu trailer',
  'Athadu Telugu movie trailer',
  'Okkadu Telugu movie trailer',
  'Khaleja Telugu trailer',
  'Sainikudu Telugu trailer',
  'Bommarillu Telugu trailer',
  'Happy Days Telugu trailer',
  'Josh Telugu movie trailer',
  'Lucky Telugu movie trailer',

  // ─ Actor Song Collections ────────────────────────────────────────────────
  'Mahesh Babu hit Telugu songs',
  'Prabhas blockbuster Telugu songs',
  'Jr NTR Telugu songs collection',
  'Ram Charan Telugu hit songs',
  'Allu Arjun Telugu songs collection',
  'Vijay Deverakonda Telugu songs',
  'Nani Telugu songs hits',
  'Ravi Teja Telugu songs jukebox',
  'Pawan Kalyan old Telugu songs',
  'Venkatesh Telugu songs collection',
  'Nagarjuna Telugu romantic songs',
  'Chiranjeevi Telugu hit songs',
  'Balakrishna Telugu songs hits',
  'Sai Tej Telugu songs',
  'Sharwanand Telugu songs collection',
  'Adivi Sesh Telugu songs',
  'Nithin Telugu songs collection',
  'Sushanth Telugu songs',
  'Varun Tej Telugu songs',
  'Harish Shankar movies Telugu songs',

  // ─ Actress Song Collections ──────────────────────────────────────────────
  'Samantha Telugu songs',
  'Rashmika Mandanna Telugu songs',
  'Pooja Hegde Telugu songs',
  'Keerthy Suresh Telugu songs',
  'Anupama Parameswaran Telugu songs',
  'Sai Pallavi Telugu songs',
  'Rashi Khanna Telugu songs',

  // ─ Movie Songs by Film ───────────────────────────────────────────────────
  'RRR Telugu songs video',
  'Baahubali 2 Telugu songs',
  'Pushpa songs Telugu video',
  'Geetha Govindam songs video Telugu',
  'Fidaa songs Telugu video',
  'Uppena song video Telugu',
  'Rangasthalam songs Telugu',
  'Arjun Reddy songs Telugu',
  'Srimanthudu songs Telugu',
  'Julayi songs Telugu video',
  'Dookudu songs Telugu',
  'Race Gurram songs Telugu',
  'Attarintiki Daredi songs Telugu',
  'Brindavanam songs Telugu',
  'Khaleja songs Telugu',
  'DJ Duvvada Jagannadham songs',
  'Sarrainodu songs Telugu',
  'Temper songs Telugu',
  'Sye Raa songs Telugu',
  'Aravinda Sametha songs Telugu',

  // ─ Genre — Songs ─────────────────────────────────────────────────────────
  'Telugu romantic songs video 2024',
  'Telugu sad songs collection video',
  'Telugu melody songs hits',
  'Telugu love songs HD video',
  'Telugu mass songs video',
  'Telugu folk songs village performance',
  'Telugu item songs collection',
  'Telugu private albums songs',
  'Telugu wedding songs collection',
  'Telugu mother sentiment songs',
  'Telugu friendship songs video',
  'Telugu motivational songs',
  'Telugu devotion video songs',

  // ─ Comedy Shows & Clips ──────────────────────────────────────────────────
  'Jabardasth comedy show Telugu clip',
  'Extra Jabardasth comedy Telugu',
  'Adhirindi comedy Telugu show',
  'Sudigali Sudheer comedy performance',
  'Hyper Aadi comedy Telugu',
  'Rocket Raghava comedy Telugu',
  'Bithiri Sathi comedy Telugu',
  'Auto Ramprasad comedy Telugu',
  'Shakalaka Shankar comedy Telugu',
  'Chammak Chandra comedy Telugu',
  'Getup Srinu comedy Telugu',
  'Telugu comedy scenes 2024',
  'Telugu comedy scenes 2023',
  'Telugu comedy scenes 2022',
  'Telugu stand-up comedy',
  'Telugu mimicry performance',
  'Telugu comedy drama stage',
  'Jabardasth best performances',
  'ETV Telugu comedy show',
  'Zee Telugu comedy show',

  // ─ Short Films ───────────────────────────────────────────────────────────
  'Telugu short film romance 2024',
  'Telugu short film comedy 2024',
  'Telugu short film emotional 2024',
  'Telugu short film 2023 love',
  'Telugu short film 2023 comedy',
  'Telugu short film horror Telugu',
  'Telugu short film action thriller',
  'Telugu short film social message',
  'Telugu short film award winning',
  'Telugu short film suspense',
  'Telugu short film true story',
  'Telugu mini web series episode',
  'Telugu psychological short film',
  'Telugu crime short film',
  'Telugu village short film',
  'Telugu short film new release 2024',

  // ─ Devotional / Bhakti ───────────────────────────────────────────────────
  'Venkateswara Swamy songs Telugu video',
  'Ayyappa devotional songs Telugu video',
  'Durga Devi songs Telugu',
  'Sai Baba Telugu devotional songs video',
  'Hanuman songs Telugu bhakti',
  'Ganesh songs Telugu devotional',
  'Annamacharya keertanalu video',
  'Bhadrachala Ramadas keertanalu',
  'Telugu Vishnu bhakti songs',
  'Shiva songs Telugu bhakti video',
  'Lalitha sahasranamam Telugu',
  'Subrahmanya Swamy songs Telugu',
  'Bonalu folk songs Telangana',
  'Varalakshmi songs Telugu',
  'Saraswati Devi songs Telugu',

  // ─ Cooking & Food ────────────────────────────────────────────────────────
  'Hyderabadi biryani recipe video Telugu',
  'Andhra chicken curry recipe Telugu',
  'Gongura chutney recipe Telugu',
  'Pesarattu recipe Telugu',
  'Pulihora recipe video Telugu',
  'Andhra prawn curry recipe',
  'Haleem recipe Hyderabad Telugu',
  'Telugu sweet recipe video',
  'Bobbatlu recipe Telugu',
  'Village cooking Telugu style video',
  'Andhra fish curry recipe Telugu',
  'Gulab jamun Telugu recipe video',
  'Andhra spicy food street',
  'South Indian breakfast recipes Telugu',
  'Telugu cooking shorts video',

  // ─ Festivals & Culture ───────────────────────────────────────────────────
  'Ugadi festival Telugu celebration',
  'Sankranti Telugu festival kite',
  'Bonalu festival Hyderabad celebration',
  'Bathukamma festival Telangana',
  'Dasara celebrations Andhra Pradesh',
  'Vinayaka Chaturthi Telugu celebration',
  'Karthika Deepam Telugu festival',
  'Kuchipudi dance performance Telugu',
  'Andhra Pradesh folk dance performance',
  'Telugu traditional art Kalamkari',
  'Lambadi dance Telangana tribal',
  'Perini dance Telangana performance',
  'Burra Katha performance Telugu',
  'Telugu village Sankranti celebration',
  'Diwali celebration Hyderabad Telugu',

  // ─ Tourism & Travel ──────────────────────────────────────────────────────
  'Tirupati Venkateswara darshan video',
  'Srisailam temple tour Telugu',
  'Amaravati Andhra Pradesh temple',
  'Bhadrachalam temple visit Telugu',
  'Araku valley Visakhapatnam tour vlog',
  'Horsley Hills Andhra tourism',
  'Hyderabad Charminar visit vlog',
  'Golconda fort Hyderabad tour',
  'Vizag beach Rishikonda tourism Telugu',
  'Gandikota canyon Andhra Pradesh tour',
  'Nagarjuna Sagar dam Telugu tour',
  'Lepakshi temple Andhra Pradesh visit',
  'Hampi Karnataka Telugu vlog',
  'Belum caves Andhra Pradesh tour',

  // ─ Year-Variant Queries (ensures coverage of recent content) ─────────────
  'Telugu hit songs 2020',
  'Telugu hit songs 2021',
  'Telugu hit songs 2022',
  'Telugu hit songs 2023',
  'Telugu hit songs 2024',
  'Telugu movie songs 2020',
  'Telugu movie songs 2021',
  'Telugu movie songs 2022',
  'Telugu movie songs 2023',
  'Telugu movie songs 2024',
  'Telugu comedy 2021',
  'Telugu comedy 2022',
  'Telugu comedy 2023',
  'Telugu comedy 2024',
  'Telugu short film 2021',
  'Telugu short film 2022',
  'new Telugu songs March 2024',
  'new Telugu songs April 2024',
  'Tollywood 2023 video songs',
  'Tollywood 2024 video songs',
  'Telugu songs latest 2024 HD',
  'Telugu lyrical video 2024',
  'Telugu lyrical video 2023',

  // ─ Technology & Lifestyle ────────────────────────────────────────────────
  'Tech tips Telugu channel 2024',
  'Mobile review Telugu video',
  'Best phones Telugu review',
  'YouTube tips Telugu video',
  'Online earning Telugu tutorial short',
  'Digital marketing Telugu shorts',
  'Yoga tutorial Telugu beginners',
  'Weight loss tips Telugu video',
  'Home remedies Telugu health video',
  'Cricket tips Telugu video',
  'IPL highlights Telugu coverage',
  'Pro Kabaddi Telugu commentary clip',

  // ─ Popular Music Channels (yt-dlp handles channel search queries) ────────
  'Mango Music Telugu new song',
  'Aditya Music Telugu latest song',
  'Lahari Music Telugu video',
  'Anand Audio Telugu latest',
  'Sony Music South Telugu video',
  'Zee Music South Telugu video',
  'T-Series Telugu latest song',
  'Sri Balaji Video Telugu song',
  'Gold Disc Telugu songs',
  'Saregama Telugu classic songs',

  // ─ Trending / Viral Telugu content ──────────────────────────────────────
  'viral Telugu video 2024',
  'trending Telugu video short',
  'Telugu Instagram reel',
  'Telugu YouTube shorts',
  'Bigg Boss Telugu highlights clip',
  'Bigg Boss Telugu task clip 2024',
  'Telugu dance challenge viral',
  'Telugu folk song viral',
  'Telugu dialogue promo',
  'Telugu reality show clip',
  'Telugu prank video 2024',
  'Telugu couple goals video',
  'Telugu village life vlog',
  'Telugu student life video',
  'Telugu engineering student vlog',
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkerStatus {
  id: number;
  query: string;
  downloaded: number;
  uploaded: number;
  failed: number;
  status: 'idle' | 'searching' | 'uploading' | 'done';
}

export interface BulkSeederProgress {
  totalUploaded: number;
  totalFailed: number;
  totalSkipped: number;
  target: number;
  percentDone: number;
  workers: WorkerStatus[];
  isRunning: boolean;
  isComplete: boolean;
  startTime: number;
  elapsedMinutes: number;
  estimatedMinutesLeft: number;
  queriesProcessed: number;
  queriesTotal: number;
  cycleCount: number;
}

// ── Shared state ─────────────────────────────────────────────────────────────

let _progress: BulkSeederProgress = {
  totalUploaded: 0, totalFailed: 0, totalSkipped: 0,
  target: 0, percentDone: 0, workers: [],
  isRunning: false, isComplete: false,
  startTime: 0, elapsedMinutes: 0, estimatedMinutesLeft: 0,
  queriesProcessed: 0, queriesTotal: 0, cycleCount: 0,
};
let _stopRequested = false;

export function getBulkProgress(): BulkSeederProgress {
  return { ..._progress, workers: _progress.workers.map(w => ({ ...w })) };
}
export function isBulkRunning(): boolean { return _progress.isRunning; }
export function stopBulkSeed(): void {
  _stopRequested = true;
  console.log('[BulkSeed] Stop requested — workers will finish current video then exit.');
}

// ── Core download function ───────────────────────────────────────────────────
// Runs yt-dlp for one query; returns video files found in the worker dir.

interface VideoFile {
  id: string;
  filepath: string;
  title: string;
  duration: number;
  thumbnail: string;
}

function downloadQuery(
  ytdlp: string,
  query: string,
  searchCount: number,
  outDir: string,
  archivePath: string,
  minDuration: number,
  maxDuration: number,
): Promise<VideoFile[]> {
  return new Promise(resolve => {
    const nodePath = findNodePath();
    const jsRuntime = nodePath ? `node:${nodePath}` : 'node';

    // Snapshot existing files before this download batch
    let existingFiles: Set<string>;
    try {
      existingFiles = new Set(readdirSync(outDir).map(f => join(outDir, f)));
    } catch {
      existingFiles = new Set();
    }

    const args = [
      `ytsearch${searchCount}:${query}`,
      // yt-dlp JavaScript runtime (needed for some video hosts)
      '--js-runtimes', jsRuntime,
      '--remote-components', 'ejs:github',
      // Prefer 720p MP4; fall back gracefully
      '--format', 'mp4[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best',
      '--output', join(outDir, 'yt_%(id)s.%(ext)s'),
      '--max-filesize', '150M',
      '--no-playlist',
      // Per-worker archive — prevents this worker re-downloading its own history
      '--download-archive', archivePath,
      '--write-info-json',
      '--no-warnings',
      '--quiet',
      // DURATION FILTER — core feature: skip videos outside 2–3 min range
      '--match-filter', `duration>=${minDuration} & duration<=${maxDuration}`,
      // Polite sleep between individual video downloads (avoids rate limiting)
      '--sleep-interval', '1',
      '--max-sleep-interval', '3',
      '--socket-timeout', '30',
    ];

    const proc = spawn(ytdlp, args, { shell: false, windowsHide: true });

    proc.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim();
      // Suppress normal progress noise; only log real warnings
      if (line && !line.includes('[download]') && !line.includes('[youtube]') &&
          !line.includes('[info]') && !line.includes('Skipping') &&
          !line.includes('has already been recorded')) {
        console.warn(`[yt-dlp] ${line.substring(0, 120)}`);
      }
    });

    proc.on('close', () => {
      const results: VideoFile[] = [];
      try {
        const allFiles = readdirSync(outDir) as string[];
        const newVideoFiles = allFiles.filter(f =>
          (f.endsWith('.mp4') || f.endsWith('.webm')) &&
          !existingFiles.has(join(outDir, f))
        );

        for (const filename of newVideoFiles) {
          const filepath = join(outDir, filename);
          const idMatch = filename.match(/^yt_([^.]+)\.(mp4|webm)$/);
          if (!idMatch) continue;

          const id = idMatch[1];
          const infoPath = join(outDir, `yt_${id}.info.json`);
          let title = query, duration = 120, thumbnail = '';

          if (existsSync(infoPath)) {
            try {
              const info = JSON.parse(readFileSync(infoPath, 'utf8'));
              title     = info.fulltitle || info.title || query;
              duration  = parseFloat(info.duration) || 120;
              thumbnail = info.thumbnail || '';
            } catch { /* use defaults */ }
            try { unlinkSync(infoPath); } catch { /* ignore */ }
          }

          results.push({ id, filepath, title, duration, thumbnail });
        }
      } catch (err: any) {
        console.error('[BulkSeed] Dir scan error:', err.message);
      }

      resolve(results);
    });

    proc.on('error', err => {
      console.error('[BulkSeed] spawn error:', err.message);
      resolve([]);
    });
  });
}

// ── S3 upload helper ─────────────────────────────────────────────────────────

async function uploadVideo(
  s3: S3Client,
  bucket: string,
  region: string,
  filepath: string,
  postId: string,
): Promise<string> {
  const ext  = filepath.endsWith('.webm') ? 'webm' : 'mp4';
  const mime = ext === 'webm' ? 'video/webm' : 'video/mp4';
  const s3Key = `videos_original/${postId}_${Date.now()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: readFileSync(filepath),
    ContentType: mime,
      CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { source: 'telugu-bulk-seed' },
  }));

  return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
}

// ── Main parallel seeder entry point ─────────────────────────────────────────

export async function seedTeluguBulk(
  db: IDatabaseClient,
  s3Config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  },
  target = 10000,
  concurrency = 10,
  onProgress?: (p: BulkSeederProgress) => void,
): Promise<BulkSeederProgress> {

  if (_progress.isRunning) {
    throw new Error('Telugu bulk seeder is already running. Call stopBulkSeed() first.');
  }

  const ytdlp = findYtDlp();
  if (!ytdlp) {
    throw new Error(
      'yt-dlp not found.\n' +
      'Install: pip install yt-dlp\n' +
      'Expected path: C:\\Users\\Haritha\\AppData\\Local\\Python\\pythoncore-3.15-64\\Scripts\\yt-dlp.exe'
    );
  }

  console.log(`[BulkSeed] 🚀 Starting: target=${target} workers=${concurrency} yt-dlp=${ytdlp}`);

  _stopRequested = false;
  _progress = {
    totalUploaded: 0, totalFailed: 0, totalSkipped: 0,
    target, percentDone: 0,
    workers: Array.from({ length: concurrency }, (_, i) => ({
      id: i, query: '', downloaded: 0, uploaded: 0, failed: 0, status: 'idle',
    })),
    isRunning: true, isComplete: false,
    startTime: Date.now(), elapsedMinutes: 0, estimatedMinutesLeft: 0,
    queriesProcessed: 0, queriesTotal: TELUGU_BULK_QUERIES.length,
    cycleCount: 1,
  };

  const s3 = new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
    },
  });

  const baseDir = join(tmpdir(), 'localnet_telugu_bulk');
  mkdirSync(baseDir, { recursive: true });

  // ── Shared in-memory ID set: prevents any two workers uploading the same video
  const processedIds = new Set<string>();

  // ── Shared archive file for all workers (prevents re-downloading same YouTube ID)
  const sharedArchivePath = join(baseDir, 'archive_shared.txt');
  try { appendFileSync(sharedArchivePath, ''); } catch { }

  // ── Shared archive file for all workers (prevents ALL workers re-downloading same YouTube ID)
  const sharedArchivePath = join(baseDir, 'archive_shared.txt');
  try {
    appendFileSync(sharedArchivePath, ''); // Create/truncate archive file once at start
  } catch (e: any) {
    console.warn('[BulkSeed] Could not create archive file:', e.message);
  }

  // ── Resume: load already-seeded IDs from DB so restarts skip them
  try {
    await safeQuery(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ('seed_telugu', 'seed_telugu@localnet.in', 'creator', FALSE)
      ON CONFLICT (id) DO NOTHING
    `);
    const existing = await safeQuery(
      `SELECT id FROM posts WHERE creator_id IN ('seed_youtube', 'seed_telugu')`
    );
    existing.rows.forEach((r: any) => processedIds.add(r.id));
    console.log(`[BulkSeed] Loaded ${processedIds.size} existing IDs — they will be skipped`);
  } catch (e: any) {
    console.warn('[BulkSeed] Could not pre-load IDs:', e.message);
  }

  // ── Emit progress ─────────────────────────────────────────────────────────
  const emit = () => {
    const elapsedSec = (Date.now() - _progress.startTime) / 1000;
    const rate = _progress.totalUploaded / Math.max(1, elapsedSec); // videos/sec
    _progress.percentDone        = Math.min(100, Math.round((_progress.totalUploaded / target) * 100));
    _progress.elapsedMinutes     = Math.floor(elapsedSec / 60);
    _progress.estimatedMinutesLeft = rate > 0
      ? Math.ceil(((target - _progress.totalUploaded) / rate) / 60)
      : 999;
    onProgress?.({ ..._progress, workers: _progress.workers.map(w => ({ ...w })) });
  };

  // ── DB query wrapper with reconnection on ECONNRESET ─────────────────────
  const safeQuery = async (text: string, params?: any[]) => {
    try {
      return await db.query(text, params);
    } catch (e: any) {
      if (e.code === 'ECONNRESET' || e.code === 'EPIPE') {
        console.warn('[BulkSeed] DB connection lost, reconnecting...');
        // Try one more time
        try {
          await new Promise(r => setTimeout(r, 2000));
          return await db.query(text, params);
        } catch (e2: any) {
          console.error('[BulkSeed] Reconnect failed:', e2.message);
          throw e2;
        }
      }
      throw e;
    }
  };

  // ── Shared query queue (refilled on cycle completion) ─────────────────────
  const buildQueue = (): string[] => {
    const q = [...TELUGU_BULK_QUERIES];
    // Fisher-Yates shuffle for variety across workers
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q;
  };

  const queryQueue: string[] = buildQueue();

  // ── Duration filter settings ──────────────────────────────────────────────
  const MIN_DURATION = 90;   // 1.5 min
  const MAX_DURATION = 210;  // 3.5 min
  const SEARCH_COUNT = 60;   // search 60 results per query; duration filter picks ~15 of them

  // ── Worker function ───────────────────────────────────────────────────────
  const runWorker = async (workerId: number): Promise<void> => {
    const workerDir  = join(baseDir, `w${workerId}`);
    // SINGLE shared archive for all workers — prevents ANY worker re-downloading同一个 video
    const archivePath = join(baseDir, `archive_shared.txt`);
    mkdirSync(workerDir, { recursive: true });

    while (!_stopRequested && _progress.totalUploaded < target) {
      // Pull next query (queue may be exhausted; refill for another cycle)
      if (queryQueue.length === 0) {
        _progress.cycleCount++;
        const recycled = buildQueue();
        queryQueue.push(...recycled);
        console.log(`[Worker${workerId}] 🔄 Starting cycle ${_progress.cycleCount} (${recycled.length} queries)`);
      }

      const query = queryQueue.shift();
      if (!query) break;

      _progress.workers[workerId].query  = query;
      _progress.workers[workerId].status = 'searching';
      _progress.queriesProcessed++;
      emit();

      // ── Download ─────────────────────────────────────────────────────────
      const videos = await downloadQuery(
        ytdlp, query, SEARCH_COUNT, workerDir, archivePath,
        MIN_DURATION, MAX_DURATION,
      );

      _progress.workers[workerId].downloaded += videos.length;
      _progress.workers[workerId].status = 'uploading';
      emit();

      // ── Upload each video to S3 + insert into DB ──────────────────────────
      for (const video of videos) {
        if (_stopRequested || _progress.totalUploaded >= target) {
          unlinkSafe(video.filepath);
          continue;
        }

        const postId = `yt_${video.id}`;

        // Fast in-memory dedup check (prevents race between workers)
        if (processedIds.has(postId)) {
          _progress.totalSkipped++;
          unlinkSafe(video.filepath);
          continue;
        }
        processedIds.add(postId);

        try {
          // DB dedup check (handles restarts without in-memory state)
          const exists = await safeQuery('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]);
          if (exists.rows.length > 0) {
            _progress.totalSkipped++;
            unlinkSafe(video.filepath);
            continue;
          }

          // Upload to S3
          const publicUrl = await uploadVideo(
            s3, s3Config.bucket, s3Config.region, video.filepath, postId,
          );
          unlinkSafe(video.filepath);

          // Pick a random Telugu city and gradient for the post
          const city     = CITIES[Math.floor(Math.random() * CITIES.length)];
          const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
          const likes    = Math.floor(Math.random() * 20000) + 500;
          const views    = Math.floor(Math.random() * 500000) + 5000;

          await safeQuery(`
            INSERT INTO posts (
              id, creator_id, content_type, classification, engine,
              title, description,
              media_url, media_thumbnail, media_gradient,
              aspect_ratio, video_duration_seconds,
              publishing_point, publishing_city, publishing_state, publishing_country,
              audience_scope,
              likes_count, views_count, comments_count, shares_count, saves_count
            ) VALUES (
              $1, 'seed_telugu', 'reel', 'organic', 'ORGANIC_ENTERTAINMENT',
              $2, $3,
              $4, $5, $6,
              '9:16', $7,
              ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
              $10, $11, 'India',
              'worldwide',
              $12, $13, 0, 0, 0
            ) ON CONFLICT (id) DO NOTHING
          `, [
            postId,
            video.title.slice(0, 255),
            `${video.title} #telugu #andhra #telangana #shorts #localnet`,
            publicUrl,
            video.thumbnail || '',
            gradient,
            Math.min(MAX_DURATION, Math.max(MIN_DURATION, video.duration)),
            city.lon, city.lat,
            city.city, city.state,
            likes, views,
          ]);

          _progress.totalUploaded++;
          _progress.workers[workerId].uploaded++;

          const pct = Math.round((_progress.totalUploaded / target) * 100);
          console.log(
            `[W${workerId}] ✅ ${_progress.totalUploaded}/${target} (${pct}%) — ${video.title.slice(0, 55)}`
          );
          emit();

        } catch (err: any) {
          console.error(`[W${workerId}] ❌ ${postId}: ${err.message}`);
          _progress.totalFailed++;
          _progress.workers[workerId].failed++;
          unlinkSafe(video.filepath);
          emit();
        }
      }

      _progress.workers[workerId].status = 'idle';
      emit();
    }

    _progress.workers[workerId].status = 'done';
    emit();
    console.log(`[W${workerId}] 🏁 Done — uploaded ${_progress.workers[workerId].uploaded} videos`);
  };

  // ── Launch all workers concurrently ──────────────────────────────────────
  try {
    await Promise.all(
      Array.from({ length: concurrency }, (_, i) => runWorker(i))
    );
  } catch (err: any) {
    console.error('[BulkSeed] Fatal error:', err.message);
  } finally {
    _progress.isRunning  = false;
    _progress.isComplete = true;
    emit();
    console.log(
      `[BulkSeed] ✅ Complete — uploaded=${_progress.totalUploaded}` +
      ` failed=${_progress.totalFailed} skipped=${_progress.totalSkipped}` +
      ` time=${_progress.elapsedMinutes}m`
    );
  }

  return getBulkProgress();
}

// ── Utility ───────────────────────────────────────────────────────────────────
function unlinkSafe(fp: string) {
  try { unlinkSync(fp); } catch { /* ignore */ }
}
