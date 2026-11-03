import { IDatabaseClient } from '../postgresPool.ts';
import { MediaAsset } from '../../types/index.ts';

export interface CreateMediaAssetInput {
  id?: string;
  ownerUserId: string;
  bucketCategory: 'avatars' | 'posts_images' | 'videos_original' | 'videos_processed' | 'business_media' | 'temp_uploads';
  s3Key: string;
  storageProvider?: 'local' | 's3';
  originalFilename?: string;
  cloudfrontUrl?: string;
  mimeType: string;
  sizeBytes: number;
  magicBytesVerified?: boolean;
  durationSeconds?: number;
  width?: number;
  height?: number;
  processingStatus?: 'pending' | 'processing' | 'ready' | 'failed';
}

export class MediaAssetsRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  public async createAsset(data: CreateMediaAssetInput): Promise<MediaAsset> {
    // Ensure owner user exists in users table
    await this.client.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ($1, $2, 'user', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `, [data.ownerUserId, `${data.ownerUserId}@localnet.in`]);

    const res = await this.client.query(`
      INSERT INTO media_assets (
        owner_user_id, bucket_category, s3_key, storage_provider,
        original_filename, cloudfront_url, mime_type, magic_bytes_verified,
        size_bytes, duration_seconds, width, height, processing_status,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        NOW(), NOW()
      )
      RETURNING *;
    `, [
      data.ownerUserId,
      data.bucketCategory,
      data.s3Key,
      data.storageProvider || 'local',
      data.originalFilename || null,
      data.cloudfrontUrl || null,
      data.mimeType,
      Boolean(data.magicBytesVerified),
      data.sizeBytes,
      data.durationSeconds || null,
      data.width || null,
      data.height || null,
      data.processingStatus || 'pending'
    ]);

    return this.mapRowToMediaAsset(res.rows[0]);
  }

  public async getAssetById(id: string): Promise<MediaAsset | null> {
    const res = await this.client.query(`
      SELECT * FROM media_assets WHERE id = $1;
    `, [id]);

    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToMediaAsset(res.rows[0]);
  }

  public async getAssetByKey(key: string): Promise<MediaAsset | null> {
    const res = await this.client.query(`
      SELECT * FROM media_assets WHERE s3_key = $1;
    `, [key]);

    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToMediaAsset(res.rows[0]);
  }

  public async confirmAsset(
    id: string,
    updates: {
      processingStatus: 'ready' | 'failed';
      magicBytesVerified: boolean;
      durationSeconds?: number;
      width?: number;
      height?: number;
      cloudfrontUrl?: string;
    }
  ): Promise<MediaAsset | null> {
    const res = await this.client.query(`
      UPDATE media_assets
      SET
        processing_status = $2,
        magic_bytes_verified = $3,
        duration_seconds = COALESCE($4, duration_seconds),
        width = COALESCE($5, width),
        height = COALESCE($6, height),
        cloudfront_url = COALESCE($7, cloudfront_url),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `, [
      id,
      updates.processingStatus,
      updates.magicBytesVerified,
      updates.durationSeconds || null,
      updates.width || null,
      updates.height || null,
      updates.cloudfrontUrl || null
    ]);

    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToMediaAsset(res.rows[0]);
  }

  public async deleteAsset(id: string): Promise<boolean> {
    const res = await this.client.query(`
      DELETE FROM media_assets WHERE id = $1 RETURNING id;
    `, [id]);
    return Boolean(res.rows && res.rows.length > 0);
  }

  private mapRowToMediaAsset(r: any): MediaAsset {
    return {
      id: r.id,
      ownerUserId: r.owner_user_id,
      bucketCategory: r.bucket_category,
      s3Key: r.s3_key,
      storageProvider: r.storage_provider || 'local',
      originalFilename: r.original_filename || undefined,
      cloudfrontUrl: r.cloudfront_url || undefined,
      mimeType: r.mime_type,
      magicBytesVerified: Boolean(r.magic_bytes_verified),
      sizeBytes: Number(r.size_bytes),
      durationSeconds: r.duration_seconds ? Number(r.duration_seconds) : undefined,
      width: r.width ? Number(r.width) : undefined,
      height: r.height ? Number(r.height) : undefined,
      processingStatus: r.processing_status,
      createdAt: (r.created_at || new Date()).toString(),
      updatedAt: (r.updated_at || new Date()).toString()
    };
  }
}
