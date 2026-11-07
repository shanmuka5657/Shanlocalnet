import { IDatabaseClient } from '../postgresPool.ts';
import { Post, EligibilityResult, ViewerLocation, AudienceScope } from '../../types/index.ts';
import { calculateHaversineDistance, evaluateOrganicEligibility } from '../../lib/geo.ts';

const isUuid = (val: any): boolean =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const VALID_SCOPES = ['5km', '10km', '25km', '40km', 'city', 'state', 'country', 'worldwide'];

function normalizeDbScope(scope?: string): string {
  if (!scope) return 'worldwide';
  if (VALID_SCOPES.includes(scope)) return scope;
  if (scope === '30km') return '40km';
  if (scope === '15km' || scope === '20km') return '25km';
  return 'worldwide';
}

export class PostsRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  public async createPost(post: Partial<Post>): Promise<Post> {
    const id = post.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const creatorId = post.creatorId || 'current_user_1';
    const lon = post.publishingLocation?.longitude || 78.0373;
    const lat = post.publishingLocation?.latitude || 15.8281;
    const city = post.publishingLocation?.cityName || 'Kurnool';
    const state = post.publishingLocation?.state || 'Andhra Pradesh';
    const country = post.publishingLocation?.country || 'India';
    const classification = post.classification || 'organic';
    let scope = normalizeDbScope(post.audienceDistribution?.scope);
    const engine = post.audienceDistribution?.engine || (classification === 'organic' ? 'ORGANIC_ENTERTAINMENT' : 'COMMERCIAL_ADVERTISEMENT');
    let maxRadiusMeters: number | null = null;
    if (classification === 'organic') {
      if (['city', 'state', 'country', 'worldwide'].includes(scope)) {
        maxRadiusMeters = null;
      } else {
        const km = post.audienceDistribution?.maxRadiusKm || 10;
        if (km <= 5) { scope = '5km'; maxRadiusMeters = 5000; }
        else if (km <= 10) { scope = '10km'; maxRadiusMeters = 10000; }
        else if (km <= 25) { scope = '25km'; maxRadiusMeters = 25000; }
        else { scope = '40km'; maxRadiusMeters = 40000; }
      }
    } else {
      const km = post.audienceDistribution?.maxRadiusKm || 40;
      if (km <= 5) { scope = '5km'; maxRadiusMeters = 5000; }
      else if (km <= 10) { scope = '10km'; maxRadiusMeters = 10000; }
      else if (km <= 25) { scope = '25km'; maxRadiusMeters = 25000; }
      else { scope = '40km'; maxRadiusMeters = 40000; }
    }
    let safeMediaAssetId: string | null = null;
    if (isUuid(post.mediaAssetId)) {
      try {
        const assetCheck = await this.client.query(
          'SELECT id FROM media_assets WHERE id = $1 LIMIT 1;',
          [post.mediaAssetId]
        );
        if (assetCheck.rows && assetCheck.rows.length > 0) {
          safeMediaAssetId = post.mediaAssetId;
        }
      } catch (e) {
        console.warn('[PostsRepo] Could not verify mediaAssetId foreign key, setting to null:', e);
        safeMediaAssetId = null;
      }
    }

    // Ensure creator user exists
    await this.client.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ($1, $2, 'creator', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `, [creatorId, `${creatorId}@localnet.in`]);

    const res = await this.client.query(`
      INSERT INTO posts (
        id, creator_id, content_type, classification, engine,
        title, description, media_asset_id, media_url, media_thumbnail, media_gradient,
        aspect_ratio, video_duration_seconds, tags,
        publishing_point, publishing_city, publishing_state, publishing_country, publishing_country_code,
        origin_verified, audience_scope, max_radius_meters, target_country,
        commercial_metadata, moderation_status, published_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        ST_SetSRID(ST_MakePoint($15, $16), 4326)::geography, $17, $18, $19, 'IN',
        $20, $21, $22, $23,
        $24, 'approved', NOW(), NOW()
      )
      RETURNING
        id, creator_id, content_type, classification, engine,
        title, description, media_asset_id, media_url, media_thumbnail, media_gradient,
        aspect_ratio, video_duration_seconds, tags,
        ST_X(publishing_point::geometry) AS lon,
        ST_Y(publishing_point::geometry) AS lat,
        publishing_city, publishing_state, publishing_country,
        audience_scope, max_radius_meters, target_country,
        likes_count, comments_count, shares_count, saves_count, views_count,
        published_at;
    `, [
      id,
      creatorId,
      post.contentType || 'reel',
      classification,
      engine,
      post.title || 'Untitled Post',
      post.description || '',
      safeMediaAssetId,
      post.mediaUrl || null,
      post.mediaThumbnail || '',
      post.mediaGradient || 'from-amber-600 via-rose-600 to-indigo-900',
      post.aspectRatio || '9:16',
      post.videoDurationSeconds != null ? post.videoDurationSeconds : null,
      JSON.stringify(post.tags || []),
      lon,
      lat,
      city,
      state,
      country,
      Boolean(post.publishingLocation?.isVerified),
      scope,
      maxRadiusMeters,
      country,
      post.commercialMetadata ? JSON.stringify(post.commercialMetadata) : null
    ]);

    const row = res.rows[0];
    return this.mapRowToPost(row, post);
  }

  public async getFeed(
    viewer: ViewerLocation | null,
    tab: 'global' | 'around_me' | 'following' = 'global',
    limit = 30,
    offset = 0,
    radiusKm = 40,
    excludeIds: string[] = []   // ← videos already shown to this user
  ): Promise<{ post: Post; eligibility: EligibilityResult }[]> {
    const lon = viewer?.coords.longitude ?? 78.0373;
    const lat = viewer?.coords.latitude ?? 15.8281;

    let queryStr = `
      SELECT
        p.*,
        u.email AS creator_email,
        up.display_name AS creator_name,
        up.handle AS creator_handle,
        up.avatar_url AS creator_avatar,
        ST_X(p.publishing_point::geometry) AS lon,
        ST_Y(p.publishing_point::geometry) AS lat,
        ST_Distance(
          p.publishing_point,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0 AS distance_km
      FROM posts p
      JOIN users u ON u.id = p.creator_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE p.deleted_at IS NULL
        AND p.moderation_status = 'approved'
    `;

    const params: any[] = [lon, lat];

    if (tab === 'around_me') {
      const radiusMeters = Math.min(40000, Math.max(1000, Number(radiusKm || 40) * 1000));
      queryStr += ` AND (
        ST_DWithin(p.publishing_point, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $${params.length + 1})
        OR LOWER(p.publishing_city) = LOWER($${params.length + 2})
      )`;
      params.push(radiusMeters, viewer?.cityName || 'Kurnool');
    }

    // Exclude videos already seen by this user (sent from client localStorage)
    // Keep list to max 200 IDs to avoid giant SQL queries
    const safeExclude = excludeIds.slice(0, 200).filter(id => typeof id === 'string' && id.length > 0);
    if (safeExclude.length > 0) {
      const placeholders = safeExclude.map((_, i) => `$${params.length + 1 + i}`).join(',');
      queryStr += ` AND p.id NOT IN (${placeholders})`;
      params.push(...safeExclude);
    }

    // Use RANDOM() ordering so every refresh returns a different set
    // (ORDER BY published_at DESC always returned the same 30 newest videos)
    queryStr += ` ORDER BY RANDOM() LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    const res = await this.client.query(queryStr, params);

    return res.rows.map((r: any) => {
      const post = this.mapRowToPost(r);
      const eligibility = evaluateOrganicEligibility(viewer, post);
      return { post, eligibility };
    });
  }

  public async getReels(
    viewer: ViewerLocation | null,
    limit = 30,
    excludeIds: string[] = []   // ← reels already shown in the carousel
  ): Promise<{ reel: Post; eligibility: EligibilityResult }[]> {
    const lon = viewer?.coords.longitude ?? 78.0373;
    const lat = viewer?.coords.latitude ?? 15.8281;

    const params: any[] = [lon, lat];
    let excludeClause = '';

    const safeExclude = excludeIds.slice(0, 200).filter(id => typeof id === 'string' && id.length > 0);
    if (safeExclude.length > 0) {
      const placeholders = safeExclude.map((_, i) => `$${3 + i}`).join(',');
      excludeClause = `AND p.id NOT IN (${placeholders})`;
      params.push(...safeExclude);
    }
    params.push(limit);

    const res = await this.client.query(`
      SELECT
        p.*,
        u.email AS creator_email,
        up.display_name AS creator_name,
        up.handle AS creator_handle,
        up.avatar_url AS creator_avatar,
        ST_X(p.publishing_point::geometry) AS lon,
        ST_Y(p.publishing_point::geometry) AS lat,
        ST_Distance(
          p.publishing_point,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0 AS distance_km
      FROM posts p
      JOIN users u ON u.id = p.creator_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE p.deleted_at IS NULL
        AND p.moderation_status = 'approved'
        AND p.content_type IN ('video', 'reel')
        ${excludeClause}
      ORDER BY RANDOM()
      LIMIT $${params.length};
    `, params);

    return res.rows.map((r: any) => {
      const post = this.mapRowToPost(r);
      const eligibility = evaluateOrganicEligibility(viewer, post);
      return { reel: post, eligibility };
    });
  }

  public async getAllPosts(): Promise<Post[]> {
    const res = await this.client.query(`
      SELECT
        p.*,
        u.email AS creator_email,
        up.display_name AS creator_name,
        up.handle AS creator_handle,
        up.avatar_url AS creator_avatar,
        ST_X(p.publishing_point::geometry) AS lon,
        ST_Y(p.publishing_point::geometry) AS lat
      FROM posts p
      JOIN users u ON u.id = p.creator_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.published_at DESC;
    `);
    return res.rows.map((r: any) => this.mapRowToPost(r));
  }

  public async updatePostLocation(
    postId: string,
    lon: number,
    lat: number,
    city: string,
    state: string,
    ticketReference: string,
    reason: string
  ): Promise<Post | null> {
    // Audit update
    await this.client.query(`
      UPDATE posts
      SET
        publishing_point = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        publishing_city = $3,
        publishing_state = $4,
        updated_at = NOW()
      WHERE id = $5;
    `, [lon, lat, city, state, postId]);

    const res = await this.client.query(`
      SELECT
        p.*,
        u.email AS creator_email,
        up.display_name AS creator_name,
        up.handle AS creator_handle,
        up.avatar_url AS creator_avatar,
        ST_X(p.publishing_point::geometry) AS lon,
        ST_Y(p.publishing_point::geometry) AS lat
      FROM posts p
      JOIN users u ON u.id = p.creator_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE p.id = $1;
    `, [postId]);

    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToPost(res.rows[0]);
  }

  public async searchPosts(
    query: string,
    viewer?: ViewerLocation | null,
    limit = 30
  ): Promise<Array<{ post: Post; eligibility: EligibilityResult }>> {
    const qWild = '%' + query.trim().toLowerCase() + '%';
    const res = await this.client.query(`
      SELECT
        p.*,
        u.email AS creator_email,
        up.display_name AS creator_name,
        up.handle AS creator_handle,
        up.avatar_url AS creator_avatar,
        ST_X(p.publishing_point::geometry) AS lon,
        ST_Y(p.publishing_point::geometry) AS lat
      FROM posts p
      JOIN users u ON u.id = p.creator_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE p.deleted_at IS NULL
        AND p.moderation_status = 'approved'
        AND (
          LOWER(p.title) LIKE $1
          OR LOWER(p.description) LIKE $1
          OR LOWER(COALESCE(up.display_name, '')) LIKE $1
          OR LOWER(COALESCE(up.handle, '')) LIKE $1
          OR array_to_string(p.tags, ',') ILIKE $1
        )
      ORDER BY p.published_at DESC
      LIMIT $2;
    `, [qWild, limit]);

    return (res.rows || []).map((r: any) => {
      const post = this.mapRowToPost(r);
      const eligibility = evaluateOrganicEligibility(viewer, post);
      return { post, eligibility };
    });
  }

  public async toggleLike(
    postId: string,
    userId = 'current_user_1'
  ): Promise<{ liked: boolean; likesCount: number }> {
    await this.client.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ($1, $2, 'user', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `, [userId, `${userId}@localnet.in`]);

    const check = await this.client.query(
      'SELECT 1 FROM post_likes WHERE user_id = $1 AND post_id = $2;',
      [userId, postId]
    );

    let liked = false;
    if (check.rows && check.rows.length > 0) {
      await this.client.query(
        'DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2;',
        [userId, postId]
      );
      await this.client.query(
        'UPDATE posts SET likes_count = GREATEST(0, likes_count - 1), updated_at = NOW() WHERE id = $1;',
        [postId]
      );
      liked = false;
    } else {
      await this.client.query(
        'INSERT INTO post_likes (user_id, post_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING;',
        [userId, postId]
      );
      await this.client.query(
        'UPDATE posts SET likes_count = likes_count + 1, updated_at = NOW() WHERE id = $1;',
        [postId]
      );
      liked = true;
    }

    const res = await this.client.query('SELECT likes_count FROM posts WHERE id = $1;', [postId]);
    const likesCount = Number(res.rows?.[0]?.likes_count ?? (liked ? 1 : 0));
    return { liked, likesCount };
  }

  public async addComment(
    postId: string,
    userId = 'current_user_1',
    body: string
  ): Promise<any> {
    await this.client.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ($1, $2, 'user', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `, [userId, `${userId}@localnet.in`]);

    const res = await this.client.query(`
      INSERT INTO post_comments (post_id, user_id, body, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, post_id, user_id, body, created_at;
    `, [postId, userId, body]);

    await this.client.query(
      'UPDATE posts SET comments_count = comments_count + 1, updated_at = NOW() WHERE id = $1;',
      [postId]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      postId: row.post_id,
      author: 'You (Local Viewer)',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      text: row.body,
      likes: 0,
      time: 'Just now',
      createdAt: row.created_at
    };
  }

  public async getComments(postId: string): Promise<any[]> {
    const res = await this.client.query(`
      SELECT
        pc.id,
        pc.post_id,
        pc.user_id,
        pc.body AS text,
        pc.created_at,
        COALESCE(up.display_name, 'You (Local Viewer)') AS author,
        COALESCE(up.avatar_url, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80') AS author_avatar
      FROM post_comments pc
      LEFT JOIN users u ON u.id = pc.user_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE pc.post_id = $1 AND pc.deleted_at IS NULL
      ORDER BY pc.created_at ASC;
    `, [postId]);

    return (res.rows || []).map((r: any) => ({
      id: r.id,
      author: r.author,
      authorAvatar: r.author_avatar,
      text: r.text,
      likes: 0,
      time: 'Just now',
      createdAt: r.created_at
    }));
  }

  public async getCommentsForPosts(postIds: string[]): Promise<Record<string, any[]>> {
    if (!postIds || postIds.length === 0) return {};
    const res = await this.client.query(`
      SELECT
        pc.id,
        pc.post_id,
        pc.user_id,
        pc.body AS text,
        pc.created_at,
        COALESCE(up.display_name, 'You (Local Viewer)') AS author,
        COALESCE(up.avatar_url, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80') AS author_avatar
      FROM post_comments pc
      LEFT JOIN users u ON u.id = pc.user_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE pc.post_id = ANY($1) AND pc.deleted_at IS NULL
      ORDER BY pc.created_at ASC;
    `, [postIds]);

    const map: Record<string, any[]> = {};
    for (const row of res.rows || []) {
      if (!map[row.post_id]) map[row.post_id] = [];
      map[row.post_id].push({
        id: row.id,
        author: row.author,
        authorAvatar: row.author_avatar,
        text: row.text,
        likes: 0,
        time: 'Just now',
        createdAt: row.created_at
      });
    }
    return map;
  }

  public async getPostStats(postId: string): Promise<{ likes: number; comments: number; views: number } | null> {
    const res = await this.client.query('SELECT likes_count, comments_count, views_count FROM posts WHERE id = $1;', [postId]);
    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      likes: Number(r.likes_count || 0),
      comments: Number(r.comments_count || 0),
      views: Number(r.views_count || 0)
    };
  }

  public async updateThumbnail(postId: string, thumbnailUrl: string): Promise<void> {
    try {
      await this.client.query(
        `UPDATE posts SET media_thumbnail = $1, updated_at = NOW() WHERE id = $2 AND (media_thumbnail IS NULL OR media_thumbnail = '' OR media_thumbnail NOT LIKE 'data:image%');`,
        [thumbnailUrl, postId]
      );
    } catch (e) {
      console.warn('Update thumbnail error:', e);
    }
  }

  public async recordView(
    postId: string,
    userId = 'current_user_1',
    city = 'Kurnool'
  ): Promise<{ viewsCount: number }> {
    try {
      await this.client.query(`
        INSERT INTO reel_views (post_id, viewer_user_id, watch_duration_ms, viewer_city, created_at)
        VALUES ($1, $2, 3000, $3, NOW());
      `, [postId, userId, city]);
    } catch { }

    await this.client.query(
      'UPDATE posts SET views_count = views_count + 1, updated_at = NOW() WHERE id = $1;',
      [postId]
    );

    const res = await this.client.query('SELECT views_count FROM posts WHERE id = $1;', [postId]);
    return { viewsCount: Number(res.rows?.[0]?.views_count ?? 1) };
  }

  private mapRowToPost(r: any, fallback?: Partial<Post>): Post {
    const tags = Array.isArray(r.tags) ? r.tags : typeof r.tags === 'string' ? JSON.parse(r.tags) : [];
    return {
      id: r.id,
      creatorId: r.creator_id,
      creatorName: r.creator_name || fallback?.creatorName || 'Kurnool Creator',
      creatorHandle: r.creator_handle || fallback?.creatorHandle || `@${r.creator_id}`,
      creatorAvatar: r.creator_avatar || fallback?.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      creatorVerified: true,
      contentType: r.content_type,
      classification: r.classification,
      title: r.title,
      description: r.description,
      mediaAssetId: r.media_asset_id || undefined,
      mediaUrl: r.media_url ? (
        r.media_url.includes('.s3.amazonaws.com') && !r.media_url.includes('.s3.ap-southeast-2.amazonaws.com')
          ? r.media_url.replace('.s3.amazonaws.com', '.s3.ap-southeast-2.amazonaws.com')
          : r.media_url
      ) : undefined,
      mediaThumbnail: r.media_thumbnail || (
        r.media_url?.includes('reel_dance.mp4') ? 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80' :
          r.media_url?.includes('reel_tech.mp4') ? 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80' :
            r.media_url?.includes('reel_music.mp4') ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80' : ''
      ),
      mediaGradient: r.media_gradient || 'from-amber-600 via-rose-600 to-indigo-900',
      aspectRatio: r.aspect_ratio || '9:16',
      videoDurationSeconds: r.video_duration_seconds ? Number(r.video_duration_seconds) : undefined,
      publishingLocation: {
        latitude: Number(r.lat ?? fallback?.publishingLocation?.latitude ?? 15.8281),
        longitude: Number(r.lon ?? fallback?.publishingLocation?.longitude ?? 78.0373),
        cityName: r.publishing_city,
        state: r.publishing_state,
        country: r.publishing_country,
        isVerified: Boolean(r.origin_verified),
        publishedAt: (r.published_at || r.created_at || new Date()).toString()
      },
      audienceDistribution: {
        engine: r.engine || 'ORGANIC_ENTERTAINMENT',
        scope: r.audience_scope as AudienceScope,
        maxRadiusKm: r.max_radius_meters ? Number(r.max_radius_meters) / 1000 : null
      },
      tags,
      stats: {
        likes: Number(r.likes_count || 0),
        comments: Number(r.comments_count || 0),
        shares: Number(r.shares_count || 0),
        saves: Number(r.saves_count || 0),
        views: Number(r.views_count || 0)
      },
      hasLiked: false,
      hasSaved: false,
      moderation: { status: 'approved' },
      createdAt: (r.published_at || new Date()).toString()
    };
  }
}
