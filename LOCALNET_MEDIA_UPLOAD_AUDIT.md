# LOCALNET — MEDIA UPLOAD & CONTENT PUBLISHING FORENSIC AUDIT
## Comprehensive Investigation of the Frontend Experience, Backend Pipeline, Storage Architecture & Database Fidelity

**Audit Date:** November 3, 2026  
**Auditor:** Principal Full-Stack Architect & Independent Technical Auditor  
**Project:** LocalNet (`Shanlocalnet-main`)  
**Core Question Investigated:** *How can a real user upload a video, image or post when the application does not visibly provide a complete upload option?*  
**Executive Finding:** **Real user media upload is completely absent from LocalNet.** There is no file input, no drag-and-drop zone, no multipart upload middleware, no S3 object storage integration, and the `media_assets` database table is entirely bypassed. Content publishing is a **frontend simulation** that pairs user text with hardcoded static sample video files (`/videos/reel_dance.mp4`) or external Unsplash stock photo URLs.

---

## 1. Executive Summary: Core Questions A through M

| Audit Question | Forensic Answer | Evidence | Status |
|:---|:---|:---|:---:|
| **A. Is there a visible upload button?** | **NO.** While there is a "+ Create" button in the bottom navigation and top header that opens `CreateModal`, inside `CreateModal` there is **no file upload button, no browse button, and no file input**. | [`CreateModal.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx) | **NOT IMPLEMENTED** |
| **B. Can users actually select images?** | **NO.** There is no `<input type="file" accept="image/*">`. Selecting "Photo Post" only changes an enum state; upon submission, the backend hardcodes an Unsplash photo URL. | [`CreateModal.tsx:92`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx#L92) | **NOT IMPLEMENTED** |
| **C. Can users actually select videos?** | **NO.** There is no video file picker. Selecting "Vertical Reel" forces the hardcoded URL `/videos/reel_dance.mp4`. | [`CreateModal.tsx:92`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx#L92) | **NOT IMPLEMENTED** |
| **D. Can users publish text-only posts?** | **PARTIALLY (WITH DEFECT).** Users can type title and caption, but the database schema mandates `media_url TEXT NOT NULL`. The backend forces a stock Unsplash image URL onto text posts. | [`server.ts:263`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/server.ts#L263), [`0002 migration:143`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/db/migrations/0002_corrected_postgis_schema.sql#L143) | **MOCKED** |
| **E. Can users publish image posts?** | **MOCKED.** A post record is created in PostgreSQL with user-entered title and caption, but the media URL is a static external Unsplash link. | [`server.ts:263`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/server.ts#L263) | **MOCKED** |
| **F. Can users publish video posts?** | **MOCKED.** A post record is created in PostgreSQL, but the video points to a bundled local static asset (`/videos/reel_dance.mp4`). | [`server.ts:263`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/server.ts#L263) | **MOCKED** |
| **G. Where are uploaded files stored?** | **NOWHERE.** No binary files are received by the server. Only static mock URL strings are stored in PostgreSQL column `posts.media_url`. | [`postsRepository.ts:42`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/db/repositories/postsRepository.ts#L42) | **NOT IMPLEMENTED** |
| **H. Is AWS S3 connected?** | **NO.** AWS SDK (`@aws-sdk/client-s3`) is not installed. No S3 client, bucket config, presigned URL generator, or CloudFront distribution exists. | [`package.json`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/package.json) | **NOT IMPLEMENTED** |
| **I. Is `media_assets` table used?** | **NO.** The table exists in PostgreSQL, but contains **0 rows**. `postsRepository.createPost()` never inserts into `media_assets` and leaves `media_asset_id` NULL. | [`postsRepository.ts:33-48`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/db/repositories/postsRepository.ts#L33-L48) | **NOT IMPLEMENTED** |
| **J. Are videos playable in the feed?** | **YES (STATIC BUNDLED SAMPLES ONLY).** The HTML5 `<video>` player in `HomeFeed.tsx` and `ReelsView.tsx` plays the 4 static MP4 files bundled in `public/videos/`. | [`public/videos/`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/public/videos/) | **PARTIAL** |
| **K. What is missing?** | File inputs, drag-and-drop, media preview, upload progress, multipart backend parser/S3 presigned URLs, S3 storage adapter, magic byte verification, `MediaAssetsRepository`, and relational FK linking. | Complete audit trail | **NOT IMPLEMENTED** |
| **L. What files must be implemented?** | `src/components/MediaUploader.tsx`, `src/services/storageService.ts`, `src/db/repositories/mediaAssetsRepository.ts`, upload routes in `server.ts`. | Listed in §9 | **ACTION REQUIRED** |
| **M. What prevents real users from publishing?** | Complete absence of client-side file reading, absence of backend upload endpoints, absence of cloud object storage, and disconnection of database `media_assets` table. | Complete audit trail | **BLOCKED** |

---

## 2. Forensic Breakdown: Frontend Experience

An exhaustive inspection of all 18 React component files in `src/components/` revealed the following:

### 2.1 The Create Modal ([`src/components/CreateModal.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx))
When the user clicks the elevated `+` button in [`BottomNavBar.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/BottomNavBar.tsx#L60) or [`TopNavigation.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/TopNavigation.tsx#L187), the `CreateModal` dialog opens.
- **Available Controls:**
  - Content Type Selector buttons (`reel`, `photo`, `text`).
  - Content Engine Classification (`organic` vs `commercial`).
  - Post Title input (`<input type="text">`).
  - Description / Caption textarea (`<textarea>`).
  - Tags input (`<input type="text">`).
  - Audience Distribution Scope selector (`1km`, `5km`, `10km`, `20km`, `40km`, `100km`, `200km`, `500km`, `country`, `worldwide`).
- **Completely Missing Controls:**
  - `<input type="file">` $\to$ **0 occurrences**.
  - Drag-and-drop zone $\to$ **0 occurrences**.
  - Local media preview (`<img src={blobUrl}>` or `<video src={blobUrl}>`) $\to$ **0 occurrences**.
  - Remove / Replace media button $\to$ **0 occurrences**.
  - Multi-image selector $\to$ **0 occurrences**.
- **The Payload Construction (Line 85–114):**
  ```ts
  const response = await fetch('/api/posts/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description,
      contentType,
      // FAKE MOCK MEDIA URL HARDCODED HERE:
      mediaUrl: contentType === 'reel' 
        ? '/videos/reel_dance.mp4' 
        : 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
      classification: isCommercialMode ? 'sponsored_creator' : 'organic',
      ...
    })
  });
  ```
  The user is given no choice of media. The application unilaterally attaches either `/videos/reel_dance.mp4` or an Unsplash photo.

### 2.2 Feed & Video Playback ([`src/components/HomeFeed.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/HomeFeed.tsx) & [`src/components/ReelsView.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/ReelsView.tsx))
- **Video Playback Implementation:**
  [`HomeFeed.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/HomeFeed.tsx#L363-L375) and [`ReelsView.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/ReelsView.tsx#L294-L304) implement standard HTML5 `<video>` tags with `playsInline`, `muted`, `loop`, play/pause toggles, and touch swipe navigation.
- **Physical Video Files Present:**
  The `public/videos/` directory contains 4 static video files:
  1. `reel_dance.mp4` (5,998,057 bytes / ~5.7 MB) — Telugu folk dance clip
  2. `reel_music.mp4` (26,280,063 bytes / ~25.0 MB) — Music performance clip
  3. `reel_tech.mp4` (7,768 bytes / ~7.6 KB) — Short loop
  4. `test.mp4` (59,806 bytes / ~58 KB) — Diagnostic test clip
- **Fallback Simulation Box:**
  If a post's `mediaUrl` fails to load or does not include `/videos/`, lines 409-416 of `HomeFeed.tsx` display a decorative CSS gradient box (`from-amber-600 via-rose-700 to-indigo-950`) with an animated pulsing play button that simulates video presence.

### 2.3 Other Component Interfaces
- **[`ProfileView.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/ProfileView.tsx#L89-L94):** User avatar is hardcoded to `https://images.unsplash.com/photo-1534528741775-53994a69daeb...`. There is no avatar upload or crop tool.
- **[`BusinessAdHub.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/BusinessAdHub.tsx):** Businesses can create advertising campaigns, but there is no creative banner or video ad upload. Ad creatives default to static CSS gradients.
- **[`MarketplaceView.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/MarketplaceView.tsx):** Browsing-only. There is no listing creation modal or product photo uploader.
- **[`LocalHubView.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/LocalHubView.tsx):** Users can join communities and apply for jobs, but cannot post community media or attachments.

---

## 3. Forensic Breakdown: Media Upload Backend

### 3.1 Middleware & Body Parsers
Inspection of [`server.ts`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/server.ts) shows:
```ts
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
```
- **`multipart/form-data` parser:** NONE.
- **`multer`:** NOT INSTALLED in `package.json`, NOT IMPORTED in `server.ts`.
- **`formidable` / `busboy`:** NOT INSTALLED, NOT IMPORTED.
- Express rejects any `multipart/form-data` request with an empty body (`req.body = {}`).

### 3.2 Upload Endpoints
A full endpoint scan of `server.ts` found:
- `POST /api/upload` $\to$ **DOES NOT EXIST**.
- `POST /api/media/*` $\to$ **DOES NOT EXIST**.
- `POST /api/assets/*` $\to$ **DOES NOT EXIST**.
- `POST /api/s3/*` $\to$ **DOES NOT EXIST**.
- `POST /api/presign-upload` $\to$ **DOES NOT EXIST**.

The **only** content creation route in `server.ts` is [`POST /api/posts/create`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/server.ts#L200-L298), which expects a JSON body:
```ts
const currentUser = await usersRepo.getProfile('current_user_1');
const postToCreate: Partial<Post> = {
  creatorId: currentUser?.id || 'current_user_1',
  ...
  mediaUrl: mediaUrl || (contentType === 'reel' ? '/videos/reel_dance.mp4' : 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80'),
  ...
};
const savedPost = await postsRepo.createPost(postToCreate);
```
If the client provides no `mediaUrl`, the backend substitutes the same hardcoded Unsplash link or `/videos/reel_dance.mp4`.

---

## 4. Forensic Breakdown: Database Integration & `media_assets` Table

### 4.1 Schema Definition
Migration `0002_corrected_postgis_schema.sql` (lines 43–62) and Drizzle ORM schema [`src/db/schema/platform.ts`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/db/schema/platform.ts#L31-L48) declare a production-grade `media_assets` table:
```sql
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket_category VARCHAR(32) NOT NULL CHECK (
    bucket_category IN ('avatars', 'posts_images', 'videos_original', 'videos_processed', 'business_media', 'temp_uploads')
  ),
  s3_key TEXT NOT NULL UNIQUE,
  cloudfront_url TEXT,
  mime_type VARCHAR(64) NOT NULL,
  magic_bytes_verified BOOLEAN NOT NULL DEFAULT FALSE,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800), -- Max 50 MB
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  processing_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processing', 'ready', 'failed')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Furthermore:
- `user_profiles.avatar_asset_id` has `REFERENCES media_assets(id) ON DELETE SET NULL`.
- `posts.media_asset_id` has `REFERENCES media_assets(id) ON DELETE SET NULL`.

### 4.2 The Disconnection in Implementation
Despite this schema existing in PostgreSQL:
1. **Missing Repository:** There is NO `mediaAssetsRepository.ts` in `src/db/repositories/`.
2. **Missing from `createPost()`:** In [`src/db/repositories/postsRepository.ts`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/db/repositories/postsRepository.ts#L33-L48), `createPost()` inserts into `posts` without including `media_asset_id` in the SQL `INSERT` statement:
   ```sql
   INSERT INTO posts (
     id, creator_id, content_type, classification, engine,
     title, description, media_url, media_thumbnail, media_gradient,
     ...
   )
   ```
3. **Missing from Types:** [`src/types/index.ts`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/types/index.ts#L110-L130) does not declare a `mediaAssetId?: string` property on the TypeScript `Post` interface.
4. **Table State:** The `media_assets` table has **exactly 0 rows** in the database.

---

## 5. Forensic Breakdown: Storage Architecture & AWS S3

### 5.1 AWS S3 Status: **COMPLETELY ABSENT**
- No `@aws-sdk/client-s3` package installed.
- No `@aws-sdk/s3-request-presigner` installed.
- No S3 bucket name, AWS region, AWS Access Key ID, or Secret Access Key configured in `.env.example` or environment configuration.
- No CloudFront distribution domain configured.

### 5.2 Required Architecture for Real Media Uploads
To transform LocalNet from a mock simulation into a real production application, the following architecture must be implemented:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UPLOAD ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

1. User selects file on device (<input type="file" accept="image/*,video/*">)
   │
   ▼
2. Client inspects file size & magic bytes locally
   │
   ▼
3. Client requests upload authorization:
   POST /api/media/presign-upload { filename, mimeType, sizeBytes, category }
   │
   ▼
4. Express Backend authenticates user & validates constraints:
   - Size limit: Images <= 10 MB, Videos <= 50 MB
   - MIME types: image/jpeg, image/png, image/webp, video/mp4, video/webm
   - Generates unique S3 key: `uploads/${userId}/${uuid}.${ext}`
   - Calls `@aws-sdk/s3-request-presigner` (S3 PUT Presigned URL, 15 min expiry)
   - Creates `media_assets` record in PostgreSQL with `processing_status = 'pending'`
   │
   ▼
5. Backend returns: { uploadUrl, assetId, s3Key, cloudfrontUrl }
   │
   ▼
6. Browser uploads directly to Private S3 Bucket via HTTP PUT (with progress bar):
   PUT https://localnet-media.s3.amazonaws.com/uploads/...
   │
   ▼
7. Browser confirms upload completion:
   POST /api/media/confirm { assetId }
   │
   ▼
8. Backend verifies S3 object exists (HeadObjectCommand):
   - Updates `media_assets.processing_status = 'ready'`
   - Updates `magic_bytes_verified = true`
   │
   ▼
9. Browser publishes post with verified asset:
   POST /api/posts/create { title, description, mediaAssetId, scope, radiusKm }
   │
   ▼
10. `postsRepository.createPost()`:
    - Sets `posts.media_asset_id = mediaAssetId`
    - Sets `posts.media_url = cloudfrontUrl`
    - Atomic PostgreSQL commit
```

---

## 6. End-to-End Media & Publishing Feature Status Matrix

| Capability | Component / File Path | Current Status | Forensic Evidence |
|:---|:---|:---:|:---|
| **Visible "+ Create" button** | [`BottomNavBar.tsx:59`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/BottomNavBar.tsx#L59), [`TopNavigation.tsx:187`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/TopNavigation.tsx#L187) | **COMPLETE** | Opens `CreateModal` correctly on mobile and desktop |
| **Open create-post interface** | [`CreateModal.tsx:25`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx#L25) | **COMPLETE** | Modal renders with all geographic and classification options |
| **Select photo from device** | [`CreateModal.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx) | **NOT IMPLEMENTED** | No `<input type="file">` exists |
| **Select video from device** | [`CreateModal.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx) | **NOT IMPLEMENTED** | No video picker exists |
| **Select multiple images** | [`CreateModal.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx) | **NOT IMPLEMENTED** | Multi-photo post type (`multi_photo`) exists in enum, but 0 UI support |
| **Preview selected media** | [`CreateModal.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx) | **NOT IMPLEMENTED** | No media preview element or `URL.createObjectURL` |
| **Remove / replace media** | [`CreateModal.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx) | **NOT IMPLEMENTED** | No media clear/replace controls |
| **Enter title & caption** | [`CreateModal.tsx:273-300`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx#L273-L300) | **COMPLETE** | Text input and textarea work and validate required state |
| **Add hashtags** | [`CreateModal.tsx:302-313`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx#L302-L313) | **COMPLETE** | Comma-separated tag input is parsed and passed to backend |
| **Add location & radius** | [`CreateModal.tsx:332-407`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx#L332-L407) | **COMPLETE** | Location context attaches GPS coords; scope enforces 40 km commercial cap |
| **Publish post to backend** | [`CreateModal.tsx:85-114`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx#L85-L114), [`server.ts:200`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/server.ts#L200) | **PARTIAL** | API creates post in PostgreSQL, but uses fake mock media URLs |
| **View post in feed** | [`HomeFeed.tsx:359-433`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/HomeFeed.tsx#L359-L433) | **COMPLETE** | Published posts appear in feed based on location and scope |
| **Play published video** | [`HomeFeed.tsx:363-408`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/HomeFeed.tsx#L363-L408), [`ReelsView.tsx:294`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/ReelsView.tsx#L294) | **PARTIAL** | Plays bundled static MP4s (`/videos/reel_dance.mp4`); cannot play user videos |
| **Multipart upload backend** | [`server.ts`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/server.ts) | **NOT IMPLEMENTED** | No `multer`, `busboy`, or multipart handler |
| **File validation (Magic bytes)**| [`0002 migration:52`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/db/migrations/0002_corrected_postgis_schema.sql#L52) | **NOT IMPLEMENTED** | DB column exists; zero backend or frontend validation logic |
| **Image processing / thumbnails**| None | **NOT IMPLEMENTED** | No image resizing (`sharp` not installed), no thumbnail generator |
| **Video duration / transcoding** | None | **NOT IMPLEMENTED** | No `ffmpeg`, no metadata extraction |
| **Object storage (AWS S3)** | None | **NOT IMPLEMENTED** | AWS SDK not installed; no S3 bucket integration |
| **`media_assets` DB integration**| [`postsRepository.ts:33`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/db/repositories/postsRepository.ts#L33) | **NOT IMPLEMENTED** | 0 rows in table; `posts.media_asset_id` left NULL |
| **Profile avatar upload** | [`ProfileView.tsx:89`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/ProfileView.tsx#L89) | **MOCKED** | Hardcoded Unsplash URL |
| **Marketplace photo upload** | [`MarketplaceView.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/MarketplaceView.tsx) | **NOT IMPLEMENTED** | No listing creation UI exists |
| **Business ad creative upload** | [`BusinessAdHub.tsx:68-81`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/BusinessAdHub.tsx#L68-L81) | **MOCKED** | Campaigns have text/budget only; creative is a hardcoded CSS gradient |

---

## 7. Concrete Evidence from Source Code

### 7.1 Hardcoded Media URL in Post Creation
From [`src/components/CreateModal.tsx`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/components/CreateModal.tsx#L85-L95):
```ts
const response = await fetch('/api/posts/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title,
    description,
    contentType,
    mediaUrl: contentType === 'reel' ? '/videos/reel_dance.mp4' : 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
    classification: isCommercialMode ? 'sponsored_creator' : 'organic',
    ...
```

### 7.2 Backend Default Fallback
From [`server.ts`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/server.ts#L259-L266):
```ts
const postToCreate: Partial<Post> = {
  creatorId: currentUser?.id || 'current_user_1',
  creatorName: currentUser?.name || 'LocalNet Creator',
  creatorHandle: currentUser?.handle || '@localnet',
  creatorAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  creatorVerified: true,
  contentType: contentType || 'photo',
  classification: isCommercial ? 'sponsored_creator' : 'organic',
  title,
  description,
  mediaUrl: mediaUrl || (contentType === 'reel' ? '/videos/reel_dance.mp4' : 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80'),
  ...
```

### 7.3 Database Repository Omitting `media_asset_id`
From [`src/db/repositories/postsRepository.ts`](file:///c:/Users/Haritha/Desktop/Shanlocalnet-main/Shanlocalnet-main/src/db/repositories/postsRepository.ts#L33-L48):
```ts
const res = await this.client.query(`
  INSERT INTO posts (
    id, creator_id, content_type, classification, engine,
    title, description, media_url, media_thumbnail, media_gradient,
    aspect_ratio, video_duration_seconds, tags,
    publishing_point, publishing_city, publishing_state, publishing_country, publishing_country_code,
    origin_verified, audience_scope, max_radius_meters, target_country,
    commercial_metadata, moderation_status, published_at, updated_at
  )
  VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12, $13,
    ST_SetSRID(ST_MakePoint($14, $15), 4326)::geography, $16, $17, $18, 'IN',
    $19, $20, $21, $22,
    $23, 'approved', NOW(), NOW()
  )
  ...
```
`media_asset_id` is completely omitted from the query parameters.

---

## 8. Root Cause Analysis: What Prevents Real Users from Publishing Content Today?

1. **Frontend Has No Media Intake:** The UI gives users no way to open their device gallery or file manager. The form only collects text strings.
2. **Backend Has No Ingestion Pipeline:** The Express server only registers `express.json()`. It cannot receive binary streams, file buffers, or multipart payloads.
3. **No Storage Service:** There is no S3 bucket, local uploads directory, or object storage provider configured to persist binary media assets.
4. **Relational Disconnect:** The `media_assets` table created in migration `0002` was never wired into the application repository layer. `posts` and `user_profiles` treat `media_url` as an unvalidated raw string.

---

## 9. Comprehensive Implementation Roadmap & Recommendations

To deliver a **real social publishing system** instead of a frontend demonstration with fake media URLs, the following components must be built:

### Phase A: Architecture Decision (Dual Storage Mode)
- **Local Development / Docker Mode:** Local filesystem storage adapter saving to `./uploads/` with static file serving (`/uploads/:filename`) so developers can test without requiring an active AWS account.
- **Production / Cloud Mode:** AWS S3 Private Bucket + CloudFront CDN with presigned S3 PUT upload URLs.

### Phase B: Frontend Components to Implement
1. **`src/components/MediaUploader.tsx`:**
   - Hidden `<input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp,video/mp4,video/webm">`.
   - Drag-and-drop target zone with visual states.
   - Client-side size validation (images $\le 10$ MB, videos $\le 50$ MB).
   - Local instant preview via `URL.createObjectURL(file)`.
   - Video duration/dimensions detection using HTML5 `<video>` element metadata.
   - Upload progress bar (0% to 100%).
   - "Replace Media" and "Remove Media" buttons.
2. **Refactor `src/components/CreateModal.tsx`:**
   - Integrate `MediaUploader`.
   - Prevent publishing until media upload is verified and returns a valid `assetId`.
   - Send `mediaAssetId` and real `mediaUrl` to `/api/posts/create`.

### Phase C: Backend Pipeline to Implement
1. **Dependencies:**
   - `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (for S3 presigned uploads).
   - `npm install multer` (for local development fallback file uploads).
2. **Storage Adapter Service (`src/services/storageService.ts`):**
   - Abstraction supporting both `LocalStorageAdapter` and `S3StorageAdapter`.
   - Presigned URL generation for client direct PUT to S3.
   - Fallback `multipart/form-data` handler for local dev.
   - MIME type and file extension validation.
3. **Media Assets Repository (`src/db/repositories/mediaAssetsRepository.ts`):**
   - `createPendingAsset({ ownerUserId, bucketCategory, mimeType, sizeBytes, s3Key, url })`.
   - `confirmAssetReady(assetId)`.
   - `getAssetById(assetId)`.
4. **API Endpoints in `server.ts`:**
   - `POST /api/media/presign-upload` $\to$ Returns presigned PUT URL and creates `media_assets` row.
   - `POST /api/media/upload` $\to$ Local dev multipart upload fallback via multer.
   - `POST /api/media/confirm` $\to$ Verifies file presence in storage and transitions status to `'ready'`.

### Phase D: Relational Database & Post Creation Linking
1. Update `src/types/index.ts` to include `mediaAssetId?: string` on `Post`.
2. Update `postsRepository.createPost()`:
   - Accept `mediaAssetId`.
   - Insert `media_asset_id` into the `posts` table foreign key column.
   - Set `posts.media_url` to the verified asset URL.

---

## 10. Final Sign-Off & Next Steps

This audit conclusively proves that **media upload is not implemented** in LocalNet today. Content publishing currently relies on hardcoded fake media URLs.

**Awaiting User Approval:**  
Per instructions, **no code has been modified**. Review this audit report and approve the implementation roadmap above to proceed with building the real media upload pipeline.

