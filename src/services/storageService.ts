import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  provider: 'local' | 's3';
  localUploadDir: string;
  baseUrl: string;
  s3?: {
    bucket: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
    cloudfrontUrl?: string;
    forcePathStyle?: boolean;
  };
}

export interface FileValidationResult {
  valid: boolean;
  detectedMime?: string;
  category: 'image' | 'video' | 'unknown';
  error?: string;
}

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm'];

/**
 * Validates file signature (magic bytes) against expected formats.
 */
export function validateMagicBytes(buffer: Buffer): FileValidationResult {
  if (!buffer || buffer.length < 12) {
    return { valid: false, category: 'unknown', error: 'File buffer too short for validation' };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg', category: 'image' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png', category: 'image' };
  }

  // 3. WebP: 'RIFF' .... 'WEBP'
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { valid: true, detectedMime: 'image/webp', category: 'image' };
  }

  // 4. MP4: offset 4-8 is 'ftyp'
  const ftyp = buffer.subarray(4, 8).toString('ascii');
  if (ftyp === 'ftyp') {
    return { valid: true, detectedMime: 'video/mp4', category: 'video' };
  }

  // 5. WebM / Matroska: 1A 45 DF A3 (EBML)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { valid: true, detectedMime: 'video/webm', category: 'video' };
  }

  return { valid: false, category: 'unknown', error: 'Unsupported or unverified file signature' };
}

export interface StreamRangeResult {
  stream: Readable;
  contentLength: number;
  contentRange?: string;
  totalSize: number;
  contentType: string;
  statusCode: number;
}

export interface IStorageAdapter {
  providerName: 'local' | 's3';
  saveFile(key: string, buffer: Buffer, mimeType: string): Promise<{ key: string; publicUrl: string }>;
  getFileStream(key: string, rangeHeader?: string): Promise<StreamRangeResult | null>;
  getFileMetadata(key: string): Promise<{ sizeBytes: number; mimeType: string; exists: boolean }>;
  deleteFile(key: string): Promise<boolean>;
  generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes: number,
    expiresInSeconds?: number
  ): Promise<{ uploadUrl: string; key: string; headers: Record<string, string>; publicUrl: string }>;
  getPublicUrl(key: string): string;
}

/**
 * Local Disk Storage Adapter for development, isolated environments, and testing.
 * Files are stored outside public web roots and served only via controlled media endpoints.
 */
export class LocalStorageAdapter implements IStorageAdapter {
  public providerName: 'local' = 'local';
  private uploadDir: string;
  private baseUrl: string;

  constructor(uploadDir: string, baseUrl: string) {
    this.uploadDir = path.resolve(process.cwd(), uploadDir);
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^[/\\]+/, '');
    return path.join(this.uploadDir, sanitizedKey);
  }

  public async saveFile(key: string, buffer: Buffer, mimeType: string): Promise<{ key: string; publicUrl: string }> {
    const filePath = this.getFilePath(key);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, buffer);
    return {
      key,
      publicUrl: this.getPublicUrl(key),
    };
  }

  public async getFileMetadata(key: string): Promise<{ sizeBytes: number; mimeType: string; exists: boolean }> {
    const filePath = this.getFilePath(key);
    try {
      const stat = await fs.promises.stat(filePath);
      const ext = path.extname(key).toLowerCase();
      let mimeType = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.mp4') mimeType = 'video/mp4';
      else if (ext === '.webm') mimeType = 'video/webm';

      return {
        sizeBytes: stat.size,
        mimeType,
        exists: true,
      };
    } catch {
      return { sizeBytes: 0, mimeType: 'application/octet-stream', exists: false };
    }
  }

  public async getFileStream(key: string, rangeHeader?: string): Promise<StreamRangeResult | null> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stat = await fs.promises.stat(filePath);
    const totalSize = stat.size;
    const ext = path.extname(key).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || start >= totalSize || end >= totalSize || start > end) {
        return null;
      }

      const contentLength = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      return {
        stream,
        contentLength,
        contentRange: `bytes ${start}-${end}/${totalSize}`,
        totalSize,
        contentType,
        statusCode: 206, // Partial Content
      };
    }

    const stream = fs.createReadStream(filePath);
    return {
      stream,
      contentLength: totalSize,
      totalSize,
      contentType,
      statusCode: 200,
    };
  }

  public async deleteFile(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    _sizeBytes: number,
    _expiresInSeconds = 900
  ): Promise<{ uploadUrl: string; key: string; headers: Record<string, string>; publicUrl: string }> {
    // For local dev, return the direct multipart upload endpoint with key pre-specified
    const uploadUrl = `${this.baseUrl}/api/media/upload?key=${encodeURIComponent(key)}`;
    return {
      uploadUrl,
      key,
      headers: {
        'Content-Type': mimeType,
      },
      publicUrl: this.getPublicUrl(key),
    };
  }

  public getPublicUrl(key: string): string {
    const sanitizedKey = key.replace(/^[/\\]+/, '');
    return `${this.baseUrl}/api/media/file/${sanitizedKey}`;
  }
}

/**
 * AWS S3 / CloudFront Storage Adapter for production deployments.
 */
export class S3StorageAdapter implements IStorageAdapter {
  public providerName: 's3' = 's3';
  private s3Client: S3Client;
  private bucket: string;
  private cloudfrontUrl?: string;

  constructor(config: {
    bucket: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
    cloudfrontUrl?: string;
    forcePathStyle?: boolean;
  }) {
    this.bucket = config.bucket;
    this.cloudfrontUrl = config.cloudfrontUrl?.replace(/\/+$/, '');

    const clientConfig: any = {
      region: config.region || 'ap-south-1',
    };

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = config.forcePathStyle ?? true;
    }

    this.s3Client = new S3Client(clientConfig);
  }

  public async saveFile(key: string, buffer: Buffer, mimeType: string): Promise<{ key: string; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });
    await this.s3Client.send(command);
    return {
      key,
      publicUrl: this.getPublicUrl(key),
    };
  }

  public async getFileMetadata(key: string): Promise<{ sizeBytes: number; mimeType: string; exists: boolean }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      return {
        sizeBytes: response.ContentLength || 0,
        mimeType: response.ContentType || 'application/octet-stream',
        exists: true,
      };
    } catch {
      return { sizeBytes: 0, mimeType: 'application/octet-stream', exists: false };
    }
  }

  public async getFileStream(key: string, rangeHeader?: string): Promise<StreamRangeResult | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: rangeHeader,
      });
      const response = await this.s3Client.send(command);
      const stream = response.Body as unknown as Readable;

      return {
        stream,
        contentLength: response.ContentLength || 0,
        contentRange: response.ContentRange,
        totalSize: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        statusCode: rangeHeader ? 206 : 200,
      };
    } catch {
      return null;
    }
  }

  public async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  public async generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    _sizeBytes: number,
    expiresInSeconds = 900
  ): Promise<{ uploadUrl: string; key: string; headers: Record<string, string>; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    return {
      uploadUrl,
      key,
      headers: {
        'Content-Type': mimeType,
      },
      publicUrl: this.getPublicUrl(key),
    };
  }

  public getPublicUrl(key: string): string {
    if (this.cloudfrontUrl) {
      return `${this.cloudfrontUrl}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}

/**
 * Unified Storage Service managing environment adapters and media validations.
 */
export class StorageService {
  private adapter: IStorageAdapter;

  constructor(config?: Partial<StorageConfig>) {
    const provider = (config?.provider || process.env.STORAGE_PROVIDER || 'local').toLowerCase() as 'local' | 's3';
    const baseUrl = config?.baseUrl || process.env.PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const localUploadDir = config?.localUploadDir || process.env.LOCAL_UPLOAD_DIR || 'uploads';

    if (provider === 's3' && process.env.AWS_S3_BUCKET) {
      this.adapter = new S3StorageAdapter({
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION || 'ap-south-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        endpoint: process.env.AWS_ENDPOINT,
        cloudfrontUrl: process.env.CLOUDFRONT_URL,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      });
    } else {
      this.adapter = new LocalStorageAdapter(localUploadDir, baseUrl);
    }
  }

  public getAdapter(): IStorageAdapter {
    return this.adapter;
  }

  public getProviderName(): 'local' | 's3' {
    return this.adapter.providerName;
  }

  /**
   * Generates a safe, collision-resistant storage key.
   */
  public generateKey(category: string, filename: string): string {
    const ext = path.extname(filename).toLowerCase() || '.bin';
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(6).toString('hex');
    const safeBase = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    return `${category}/${timestamp}_${safeBase}_${randomHex}${ext}`;
  }

  /**
   * Validates file size and binary signature before storage.
   */
  public validateBuffer(buffer: Buffer, originalMime: string): { valid: boolean; error?: string; detectedMime?: string } {
    const signature = validateMagicBytes(buffer);
    if (!signature.valid) {
      return { valid: false, error: signature.error || 'Invalid file format or corrupt binary header' };
    }

    if (signature.category === 'image') {
      if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
        return { valid: false, error: `Image file exceeds maximum allowed size of 10 MB (current: ${(buffer.length / 1024 / 1024).toFixed(1)} MB)` };
      }
      if (!ALLOWED_IMAGE_MIMES.includes(signature.detectedMime || '')) {
        return { valid: false, error: `Image MIME type ${signature.detectedMime} is not permitted. Allowed: JPEG, PNG, WebP` };
      }
    } else if (signature.category === 'video') {
      if (buffer.length > MAX_VIDEO_SIZE_BYTES) {
        return { valid: false, error: `Video file exceeds maximum allowed size of 100 MB (current: ${(buffer.length / 1024 / 1024).toFixed(1)} MB)` };
      }
      if (!ALLOWED_VIDEO_MIMES.includes(signature.detectedMime || '')) {
        return { valid: false, error: `Video MIME type ${signature.detectedMime} is not permitted. Allowed: MP4, WebM` };
      }
    }

    return { valid: true, detectedMime: signature.detectedMime };
  }

  public async saveUploadedFile(
    category: string,
    filename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ key: string; publicUrl: string; detectedMime: string; sizeBytes: number }> {
    const validation = this.validateBuffer(buffer, mimeType);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const key = this.generateKey(category, filename);
    const saveResult = await this.adapter.saveFile(key, buffer, validation.detectedMime || mimeType);

    return {
      key: saveResult.key,
      publicUrl: saveResult.publicUrl,
      detectedMime: validation.detectedMime || mimeType,
      sizeBytes: buffer.length,
    };
  }

  public async getPresignedUpload(
    category: string,
    filename: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<{ uploadUrl: string; key: string; headers: Record<string, string>; publicUrl: string }> {
    // Validate declared type & size
    const isImage = ALLOWED_IMAGE_MIMES.includes(mimeType);
    const isVideo = ALLOWED_VIDEO_MIMES.includes(mimeType);

    if (!isImage && !isVideo) {
      throw new Error(`Unsupported MIME type: ${mimeType}. Allowed: JPEG, PNG, WebP, MP4, WebM`);
    }

    if (isImage && sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Declared image size exceeds 10 MB limit (${(sizeBytes / 1024 / 1024).toFixed(1)} MB)`);
    }

    if (isVideo && sizeBytes > MAX_VIDEO_SIZE_BYTES) {
      throw new Error(`Declared video size exceeds 100 MB limit (${(sizeBytes / 1024 / 1024).toFixed(1)} MB)`);
    }

    const key = this.generateKey(category, filename);
    return await this.adapter.generatePresignedUploadUrl(key, mimeType, sizeBytes);
  }

  public async getStream(key: string, range?: string): Promise<StreamRangeResult | null> {
    return await this.adapter.getFileStream(key, range);
  }

  public async delete(key: string): Promise<boolean> {
    return await this.adapter.deleteFile(key);
  }

  public getPublicUrl(key: string): string {
    return this.adapter.getPublicUrl(key);
  }
}

export const defaultStorageService = new StorageService();

