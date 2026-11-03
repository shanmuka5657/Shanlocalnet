import { IDatabaseClient } from '../postgresPool.ts';
import { Post, EligibilityResult, ViewerLocation, AudienceScope } from '../../types/index.ts';
import { calculateHaversineDistance, evaluateOrganicEligibility } from '../../lib/geo.ts';

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
    const scope = normalizeDbScope(post.audienceDistribution?.scope);
    const classification = post.classification || 'organic';
    const engine = post.audienceDistribution?.engine || (classification === 'organic' ? 'ORGANIC_ENTERTAINMENT' : 'COMMERCIAL_ADVERTISEMENT');
    const maxRadiusMeters = post.audienceDistribution?.maxRadiusKm ? post.audienceDistribution.maxRadiusKm * 1000 : null;

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
      post.mediaAssetId || null,
      post.mediaUrl || null,
      post.mediaThumbnail || '',
      post.mediaGradient || 'from-amber-600 via-rose-600 to-indigo-900',
      post.aspectRatio || '9:16',
      post.videoDurationSeconds || (post.contentType === 'reel' || post.contentType === 'video' ? 20 : null),
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
    offset = 0
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
      // Around Me: within 40 km or matching city
      queryStr += ` AND (
        ST_DWithin(p.publishing_point, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 40000)
        OR LOWER(p.publishing_city) = LOWER($3)
      )`;
      params.push(viewer?.cityName || 'Kurnool');
    }

    queryStr += ` ORDER BY p.published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
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
    limit = 30
  ): Promise<{ reel: Post; eligibility: EligibilityResult }[]> {
    const lon = viewer?.coords.longitude ?? 78.0373;
    const lat = viewer?.coords.latitude ?? 15.8281;

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
      ORDER BY p.published_at DESC
      LIMIT $3;
    `, [lon, lat, limit]);

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
      mediaUrl: r.media_url || undefined,
      mediaThumbnail: r.media_thumbnail || '',
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
