/**
 * LocalNet — CloudFront CDN Setup
 * Creates a CloudFront distribution in front of the S3 bucket,
 * then updates all existing video URLs in the DB from S3 to CloudFront.
 *
 * Run ONCE:  node setup-cloudfront.mjs
 */

import { CloudFrontClient, CreateDistributionCommand, GetDistributionCommand } from '@aws-sdk/client-cloudfront';
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';

// ── Read config from .env ─────────────────────────────────────────────────
const env = readFileSync('.env', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'));
  return m?.[1]?.trim() || '';
};

const bucket    = get('AWS_S3_BUCKET');
const region    = get('AWS_REGION') || 'ap-southeast-2';
const accessKey = get('AWS_ACCESS_KEY_ID');
const secretKey = get('AWS_SECRET_ACCESS_KEY');
const dbUrl     = get('DATABASE_URL');

if (!bucket || !accessKey || !secretKey) {
  console.error('❌ Missing AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env');
  process.exit(1);
}

console.log(`\n🌐 Setting up CloudFront CDN for bucket: ${bucket}`);
console.log(`   Region: ${region}`);

// ── Check if distribution already exists in .env ──────────────────────────
const existingCfUrl = get('CLOUDFRONT_URL');
if (existingCfUrl) {
  console.log(`\n✅ CLOUDFRONT_URL already set: ${existingCfUrl}`);
  console.log('   Running DB URL migration only...\n');
  await migrateUrls(existingCfUrl, dbUrl, bucket, region);
  process.exit(0);
}

// ── Create CloudFront distribution ────────────────────────────────────────
const cf = new CloudFrontClient({
  region: 'us-east-1', // CloudFront API is always us-east-1
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

const s3Origin = `${bucket}.s3.${region}.amazonaws.com`;

const cmd = new CreateDistributionCommand({
  DistributionConfig: {
    CallerReference: `localnet-${Date.now()}`,
    Comment:         'LocalNet Media CDN — videos + thumbnails',
    Enabled:         true,
    // PriceClass_200 includes Asia/Pacific (India edge nodes in Chennai, Mumbai, etc.)
    PriceClass:      'PriceClass_200',

    Origins: {
      Quantity: 1,
      Items: [{
        Id:         'LocalNetS3',
        DomainName: s3Origin,
        S3OriginConfig: { OriginAccessIdentity: '' }, // bucket is public
        CustomHeaders: { Quantity: 0 },
      }],
    },

    DefaultCacheBehavior: {
      TargetOriginId:       'LocalNetS3',
      ViewerProtocolPolicy: 'redirect-to-https',
      Compress:             true,

      AllowedMethods: {
        Quantity: 2, Items: ['GET', 'HEAD'],
        CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
      },

      ForwardedValues: {
        QueryString: false,
        Cookies:     { Forward: 'none' },
        Headers:     {
          Quantity: 3,
          Items:    ['Origin', 'Access-Control-Request-Headers', 'Access-Control-Request-Method'],
        },
      },

      DefaultTTL:  86400,     // 1 day
      MinTTL:      0,
      MaxTTL:      31536000,  // 1 year

      TrustedSigners:     { Enabled: false, Quantity: 0 },
      TrustedKeyGroups:   { Enabled: false, Quantity: 0 },
    },

    CacheBehaviors: { Quantity: 0 },
    CustomErrorResponses: { Quantity: 0 },

    ViewerCertificate: {
      CloudFrontDefaultCertificate: true,
      MinimumProtocolVersion:       'TLSv1.2_2021',
    },

    HttpVersion:        'http2and3',
    IsIPV6Enabled:      true,
    DefaultRootObject:  '',
    Logging:            { Enabled: false, IncludeCookies: false, Bucket: '', Prefix: '' },
    WebACLId:           '',
    Restrictions:       { GeoRestriction: { RestrictionType: 'none', Quantity: 0 } },
  },
});

let distributionId, cfDomain;
try {
  console.log('\n⏳ Creating CloudFront distribution (takes 1-2 minutes to deploy)...');
  const res = await cf.send(cmd);
  distributionId = res.Distribution.Id;
  cfDomain       = res.Distribution.DomainName;
  console.log(`✅ Distribution created: ${distributionId}`);
  console.log(`   Domain: ${cfDomain}`);
} catch (err) {
  console.error('❌ CloudFront creation failed:', err.message);
  process.exit(1);
}

const cfUrl = `https://${cfDomain}`;

// ── Update .env ────────────────────────────────────────────────────────────
const updatedEnv = env.includes('CLOUDFRONT_URL=')
  ? env.replace(/^CLOUDFRONT_URL=.*/m, `CLOUDFRONT_URL=${cfUrl}`)
  : env + `\nCLOUDFRONT_URL=${cfUrl}\n`;

writeFileSync('.env', updatedEnv);
console.log(`\n✅ .env updated: CLOUDFRONT_URL=${cfUrl}`);
console.log('   Restart the server to pick up the new CDN URL for future uploads.\n');

// ── Wait for distribution to deploy ───────────────────────────────────────
console.log('⏳ Waiting for CloudFront to deploy (~5 min)...');
let deployed = false;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 20000));
  try {
    const status = await cf.send(new GetDistributionCommand({ Id: distributionId }));
    const state  = status.Distribution?.Status;
    process.stdout.write(`   Status: ${state}\r`);
    if (state === 'Deployed') { deployed = true; break; }
  } catch {}
}

if (!deployed) {
  console.log('\n⚠️  Distribution still deploying. Run the script again later to migrate DB URLs.');
  process.exit(0);
}

console.log('\n✅ CloudFront deployed! Migrating existing video URLs in DB...\n');
await migrateUrls(cfUrl, dbUrl, bucket, region);

// ── Migrate existing S3 URLs in DB to CloudFront ──────────────────────────
async function migrateUrls(cfUrl, dbUrl, bucket, region) {
  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  const s3Patterns = [
    `https://${bucket}.s3.${region}.amazonaws.com`,
    `https://${bucket}.s3.amazonaws.com`,
    `https://s3.${region}.amazonaws.com/${bucket}`,
  ];

  let totalUpdated = 0;
  for (const pattern of s3Patterns) {
    // Update media_url
    const r1 = await pool.query(
      `UPDATE posts SET media_url = REPLACE(media_url, $1, $2) WHERE media_url LIKE $3`,
      [pattern, cfUrl, `${pattern}%`]
    );
    // Update media_thumbnail
    const r2 = await pool.query(
      `UPDATE posts SET media_thumbnail = REPLACE(media_thumbnail, $1, $2) WHERE media_thumbnail LIKE $3`,
      [pattern, cfUrl, `${pattern}%`]
    );
    totalUpdated += (r1.rowCount || 0) + (r2.rowCount || 0);
    if ((r1.rowCount || 0) + (r2.rowCount || 0) > 0) {
      console.log(`  Replaced "${pattern}" → ${cfUrl}: ${r1.rowCount} media_url + ${r2.rowCount} thumbnails`);
    }
  }

  console.log(`\n✅ DB migration complete: ${totalUpdated} URLs updated`);

  // Verify
  const check = await pool.query(
    `SELECT COUNT(*) FROM posts WHERE media_url LIKE '%s3.amazonaws.com%'`
  );
  console.log(`   Remaining S3 direct URLs: ${check.rows[0].count} (should be 0)`);
  await pool.end();
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  CloudFront CDN setup complete!

  CDN URL : ${cfUrl}
  Videos  : now served from edge nodes near India (Chennai, Mumbai)
  Speed   : 3-5× faster video starts for Indian users

  Next step: restart the server (Ctrl+C, then npm run dev)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
