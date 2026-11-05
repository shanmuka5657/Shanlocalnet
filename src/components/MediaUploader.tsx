import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, FileVideo, Image as ImageIcon, X, AlertCircle, CheckCircle, RefreshCw, Play, Pause, Film, Sparkles, Camera, Upload, Scissors, Clock } from 'lucide-react';

export interface UploadedMediaData {
  mediaAssetId?: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  aspectRatio: string;
  videoDurationSeconds?: number;
  originalFilename?: string;
  thumbnailUrl?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}

interface MediaUploaderProps {
  contentType: 'video' | 'reel' | 'photo' | 'multi_photo' | 'text' | 'story' | 'community_update';
  onMediaUploaded: (data: UploadedMediaData) => void;
  onMediaCleared: () => void;
  initialMediaUrl?: string;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_VIDEO_DURATION_SEC = 120; // 2 minutes

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  contentType,
  onMediaUploaded,
  onMediaCleared,
  initialMediaUrl
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialMediaUrl || null);
  const [isVideo, setIsVideo] = useState<boolean>(contentType === 'reel' || contentType === 'video');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [coverTimestamp, setCoverTimestamp] = useState<number>(0.5);
  const [capturedThumbnail, setCapturedThumbnail] = useState<string>('');
  const capturedThumbnailRef = useRef<string>('');
  const serverPublicUrlRef = useRef<string | null>(null);
  const serverAssetIdRef = useRef<string | undefined>(undefined);
  const [serverAssetId, setServerAssetId] = useState<string | undefined>(undefined);
  const [serverPublicUrl, setServerPublicUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [isTrimPreviewing, setIsTrimPreviewing] = useState<boolean>(false);


  const [status, setStatus] = useState<'idle' | 'validating' | 'uploading' | 'ready' | 'error'>(
    initialMediaUrl ? 'ready' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediaMeta, setMediaMeta] = useState<{
    width?: number;
    height?: number;
    duration?: number;
    aspectRatio?: string;
    sizeMb?: string;
  } | null>(null);

  // Automatically propagate trim range changes to parent
  useEffect(() => {
    if (file && isVideo && (videoDuration > 0 || (mediaMeta?.duration || 0) > 0)) {
      onMediaUploaded({
        mediaAssetId: serverAssetId || undefined,
        publicUrl: serverPublicUrl || previewUrl || '',
        mimeType: file.type,
        sizeBytes: file.size,
        aspectRatio: mediaMeta?.aspectRatio || '9:16',
        videoDurationSeconds: videoDuration || mediaMeta?.duration,
        originalFilename: file.name,
        thumbnailUrl: capturedThumbnail || undefined,
        trimStartSeconds: trimStart,
        trimEndSeconds: trimEnd > 0 ? trimEnd : videoDuration
      });
    }
  }, [trimStart, trimEnd]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const customThumbInputRef = useRef<HTMLInputElement>(null);

  const isReelMode = contentType === 'reel';
  const acceptedTypes = isReelMode
    ? 'video/mp4,video/webm'
    : contentType === 'photo'
    ? 'image/jpeg,image/png,image/webp'
    : 'image/jpeg,image/png,image/webp,video/mp4,video/webm';

  const determineAspectRatio = (w: number, h: number): string => {
    const ratio = w / h;
    if (ratio <= 0.65) return '9:16';
    if (ratio >= 0.9 && ratio <= 1.1) return '1:1';
    if (ratio >= 1.2 && ratio <= 1.45) return '4:3';
    return '16:9';
  };

  const isBlackFrame = (context: CanvasRenderingContext2D, width: number, height: number): boolean => {
    try {
      const points = [
        [Math.round(width / 2), Math.round(height / 2)],
        [Math.round(width / 4), Math.round(height / 4)],
        [Math.round(3 * width / 4), Math.round(height / 4)],
        [Math.round(width / 4), Math.round(3 * height / 4)],
        [Math.round(3 * width / 4), Math.round(3 * height / 4)],
        [Math.round(width / 2), Math.round(height / 3)],
        [Math.round(width / 2), Math.round(2 * height / 3)]
      ];
      for (const [px, py] of points) {
        const pixel = context.getImageData(px, py, 1, 1).data;
        if (pixel[0] > 12 || pixel[1] > 12 || pixel[2] > 12) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleCaptureFrame = (targetTime?: number, retries = 0) => {
    const vid = videoPreviewRef.current;
    if (!vid) return;

    vid.muted = true;
    vid.playsInline = true;

    if (typeof targetTime === 'number') {
      setCoverTimestamp(targetTime);
      try {
        vid.currentTime = targetTime;
      } catch (e) {
        console.warn('Set currentTime error:', e);
      }
    }

    const doCapture = () => {
      const v = videoPreviewRef.current;
      if (!v) return;
      try {
        const vw = v.videoWidth || 480;
        const vh = v.videoHeight || 360;
        const canvas = document.createElement('canvas');
        const targetW = 480;
        const targetH = Math.round((targetW * vh) / vw);
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, targetW, targetH);
          if (isBlackFrame(ctx, targetW, targetH) && retries < 4) {
            const nextSeek = Math.min((retries + 1) * 0.8, (v.duration || 5) / 2);
            v.currentTime = nextSeek;
            setCoverTimestamp(nextSeek);
            setTimeout(() => handleCaptureFrame(nextSeek, retries + 1), 150);
            return;
          }
          const newThumb = canvas.toDataURL('image/jpeg', 0.85);
          setCapturedThumbnail(newThumb);
          capturedThumbnailRef.current = newThumb;
          if (file) {
            onMediaUploaded({
              mediaAssetId: serverAssetIdRef.current || serverAssetId || undefined,
              publicUrl: serverPublicUrlRef.current || serverPublicUrl || previewUrl || '',
              mimeType: file.type,
              sizeBytes: file.size,
              aspectRatio: mediaMeta?.aspectRatio || '9:16',
              videoDurationSeconds: videoDuration || mediaMeta?.duration,
              originalFilename: file.name,
              thumbnailUrl: newThumb,
              trimStartSeconds: trimStart,
              trimEndSeconds: trimEnd > 0 ? trimEnd : videoDuration
            });
          }
        }
      } catch (err) {
        console.warn('Capture frame error:', err);
      }
    };

    if (typeof targetTime === 'number') {
      vid.addEventListener('seeked', () => {
        requestAnimationFrame(doCapture);
      }, { once: true });
    } else {
      requestAnimationFrame(doCapture);
    }
  };

  const handleCustomThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const thumbFile = e.target.files?.[0];
    if (!thumbFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCapturedThumbnail(reader.result);
        capturedThumbnailRef.current = reader.result;
        if (file) {
          onMediaUploaded({
            mediaAssetId: serverAssetIdRef.current || serverAssetId || undefined,
            publicUrl: serverPublicUrlRef.current || serverPublicUrl || previewUrl || '',
            mimeType: file.type,
            sizeBytes: file.size,
            aspectRatio: mediaMeta?.aspectRatio || '9:16',
            videoDurationSeconds: videoDuration || mediaMeta?.duration,
            originalFilename: file.name,
            thumbnailUrl: reader.result,
            trimStartSeconds: trimStart,
            trimEndSeconds: trimEnd > 0 ? trimEnd : videoDuration
          });
        }
      }
    };
    reader.readAsDataURL(thumbFile);
  };

  const handleFileValidation = async (selectedFile: File) => {
    setErrorMessage(null);
    setStatus('validating');

    const fileIsVideo = selectedFile.type.startsWith('video/') || selectedFile.name.match(/\.(mp4|webm)$/i) !== null;
    setIsVideo(fileIsVideo);

    // 1. Size Validation
    if (fileIsVideo) {
      if (selectedFile.size > MAX_VIDEO_SIZE) {
        setStatus('error');
        setErrorMessage(
          `Video file size (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB) exceeds the 100 MB limit.`
        );
        return;
      }
    } else {
      if (selectedFile.size > MAX_IMAGE_SIZE) {
        setStatus('error');
        setErrorMessage(
          `Image file size (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB) exceeds the 10 MB limit.`
        );
        return;
      }
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    setFile(selectedFile);

    // 2. Metadata Inspection (Dimensions & Duration)
    if (fileIsVideo) {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = objectUrl;

      tempVideo.onloadedmetadata = () => {
        const duration = Math.round(tempVideo.duration);
        const width = tempVideo.videoWidth;
        const height = tempVideo.videoHeight;
        const aspectRatio = determineAspectRatio(width, height);

        if (duration > MAX_VIDEO_DURATION_SEC) {
          setStatus('error');
          setErrorMessage(
            `Video duration (${duration}s) exceeds the maximum allowed duration of ${MAX_VIDEO_DURATION_SEC} seconds (2 mins).`
          );
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setMediaMeta({
          width,
          height,
          duration,
          aspectRatio,
          sizeMb: (selectedFile.size / 1024 / 1024).toFixed(1)
        });

        // Extract crisp video thumbnail at 0.5s
        let uploadFired = false;
        const fireUploadWithThumbnail = (thumbnailDataUrl) => {
          if (uploadFired) return;
          uploadFired = true;
          if (thumbnailDataUrl) {
            setCapturedThumbnail(thumbnailDataUrl);
          }
          executeUpload(selectedFile, {
            width,
            height,
            duration,
            aspectRatio,
            thumbnailUrl: thumbnailDataUrl
          });
        };

        // Fallback timer: proceed with upload if seek times out
        const fallbackTimer = setTimeout(() => {
          fireUploadWithThumbnail();
        }, 1200);

        tempVideo.onseeked = () => {
          clearTimeout(fallbackTimer);
          try {
            const canvas = document.createElement('canvas');
            const targetWidth = Math.min(width || 480, 480);
            const targetHeight = Math.round(targetWidth * ((height || 480) / (width || 480)));
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(tempVideo, 0, 0, targetWidth, targetHeight);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
              fireUploadWithThumbnail(dataUrl);
              return;
            }
          } catch (err) {
            console.warn('Canvas thumbnail capture error:', err);
          }
          fireUploadWithThumbnail();
        };

        // Seek to 0.5s to trigger onseeked and capture frame
        try {
          tempVideo.currentTime = Math.min(0.5, Math.max(0.1, (duration || 1) / 2));
        } catch {
          fireUploadWithThumbnail();
        }
      };

      tempVideo.onerror = () => {
        setStatus('error');
        setErrorMessage('Failed to decode video file. Format may be corrupt or unsupported.');
      };
    } else {
      const tempImg = new Image();
      tempImg.src = objectUrl;
      tempImg.onload = () => {
        const width = tempImg.naturalWidth;
        const height = tempImg.naturalHeight;
        const aspectRatio = determineAspectRatio(width, height);

        setMediaMeta({
          width,
          height,
          aspectRatio,
          sizeMb: (selectedFile.size / 1024 / 1024).toFixed(1)
        });

        // Trigger real upload
        executeUpload(selectedFile, { width, height, aspectRatio });
      };

      tempImg.onerror = () => {
        setStatus('error');
        setErrorMessage('Failed to decode image file. Format may be corrupt or unsupported.');
      };
    }
  };

  const executeUpload = async (
    fileToUpload: File,
    meta: { width?: number; height?: number; duration?: number; aspectRatio: string }
  ) => {
    setStatus('uploading');
    setUploadProgress(0);

    const applyClientFallback = () => {
      setUploadProgress(100);
      setStatus('ready');

      const finalThumb = capturedThumbnailRef.current || capturedThumbnail || (meta as any).thumbnailUrl || undefined;
      const uploadedData: UploadedMediaData = {
        mediaAssetId: serverAssetIdRef.current || serverAssetId || undefined,
        publicUrl: previewUrl || URL.createObjectURL(fileToUpload),
        mimeType: fileToUpload.type,
        sizeBytes: fileToUpload.size,
        aspectRatio: meta.aspectRatio,
        videoDurationSeconds: meta.duration,
        originalFilename: fileToUpload.name,
        thumbnailUrl: finalThumb,
        trimStartSeconds: trimStart,
        trimEndSeconds: trimEnd > 0 ? trimEnd : (videoDuration || meta.duration)
      };

      onMediaUploaded(uploadedData);
    };

    try {
      // 1. Request presigned upload URL from backend
      const presignRes = await fetch('/api/media/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileToUpload.name,
          mimeType: fileToUpload.type,
          sizeBytes: fileToUpload.size,
          category: isVideo ? 'videos_original' : 'posts_images'
        })
      });

      if (presignRes.ok) {
        const presignData = await presignRes.json();
        const { uploadUrl, mediaAssetId, publicUrl, storageProvider, key } = presignData;

        if (storageProvider === 's3' && uploadUrl) {
          // DIRECT S3 STREAMING UPLOAD (Bypasses Vercel 4.5MB payload limit completely)
          const s3Xhr = new XMLHttpRequest();
          s3Xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 95);
              setUploadProgress(percent);
            }
          });

          s3Xhr.onload = async () => {
            if (s3Xhr.status >= 200 && s3Xhr.status < 300) {
              setUploadProgress(98);
              try {
                await fetch('/api/media/confirm', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    mediaAssetId,
                    key,
                    width: meta.width,
                    height: meta.height,
                    durationSeconds: meta.duration
                  })
                });
              } catch {
                // S3 upload is already verified; continue even if confirm errors
              }

              setUploadProgress(100);
              setStatus('ready');
              if (mediaAssetId) {
                setServerAssetId(mediaAssetId);
                serverAssetIdRef.current = mediaAssetId;
              }
              if (publicUrl) {
                setServerPublicUrl(publicUrl);
                serverPublicUrlRef.current = publicUrl;
              }
              const finalThumb = capturedThumbnailRef.current || capturedThumbnail || (meta as any).thumbnailUrl || undefined;
              onMediaUploaded({
                mediaAssetId: mediaAssetId || undefined,
                publicUrl: publicUrl || previewUrl || URL.createObjectURL(fileToUpload),
                mimeType: fileToUpload.type,
                sizeBytes: fileToUpload.size,
                aspectRatio: meta.aspectRatio,
                videoDurationSeconds: meta.duration,
                originalFilename: fileToUpload.name,
                thumbnailUrl: finalThumb,
                trimStartSeconds: trimStart,
                trimEndSeconds: trimEnd > 0 ? trimEnd : (videoDuration || meta.duration)
              });
            } else {
              applyClientFallback();
            }
          };

          s3Xhr.onerror = () => {
            applyClientFallback();
          };

          s3Xhr.open('PUT', uploadUrl);
          s3Xhr.setRequestHeader('Content-Type', fileToUpload.type);
          s3Xhr.send(fileToUpload);
          return;
        }
      }
    } catch {
      // Presign failed - fall back to direct upload
    }

    // Direct / Local upload fallback
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('category', isVideo ? 'videos_original' : 'posts_images');

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 95);
        setUploadProgress(percent);
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response && response.mediaAsset) {
              setUploadProgress(100);
              setStatus('ready');
              if (response.mediaAsset?.id) setServerAssetId(response.mediaAsset.id);
              if (response.publicUrl) setServerPublicUrl(response.publicUrl);

              const uploadedData: UploadedMediaData = {
                mediaAssetId: response.mediaAsset.id,
                publicUrl: response.publicUrl,
                mimeType: response.mediaAsset.mimeType,
                sizeBytes: response.mediaAsset.sizeBytes,
                aspectRatio: meta.aspectRatio,
                videoDurationSeconds: meta.duration,
                originalFilename: fileToUpload.name,
                thumbnailUrl: (meta as any).thumbnailUrl
              };

              onMediaUploaded(uploadedData);
            } else {
              applyClientFallback();
            }
          } catch {
            applyClientFallback();
          }
        } else {
          // Status 413, 404, 405, or any server error -> graceful fallback
          applyClientFallback();
        }
      }
    };

    xhr.onerror = () => {
      applyClientFallback();
    };

    xhr.open('POST', '/api/media/upload');
    xhr.send(formData);
  };

  const handleClear = useCallback(() => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setMediaMeta(null);
    setStatus('idle');
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onMediaCleared();
  }, [previewUrl, onMediaCleared]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileValidation(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileValidation(e.target.files[0]);
    }
  };

  return (
    <div className="w-full space-y-2.5">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Media Upload Error:</span>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Dropzone (When No File Selected) */}
      {!previewUrl && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 scale-[0.99]'
              : 'border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/50 bg-slate-50/50 dark:bg-slate-800/40'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
              {isReelMode ? (
                <FileVideo className="w-6 h-6" />
              ) : contentType === 'photo' ? (
                <ImageIcon className="w-6 h-6" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                Click to browse or drag & drop {isReelMode ? 'a reel video' : 'a photo or video'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isReelMode
                  ? 'MP4, WebM (Max 100 MB, up to 120s)'
                  : 'JPEG, PNG, WebP (Max 10 MB) or MP4, WebM (Max 100 MB)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Media Preview & Active Upload Status */}
      {previewUrl && (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 shadow-md">
          <div className="relative flex items-center justify-center max-h-72 bg-black/40 overflow-hidden">
            {isVideo ? (
              <video
                ref={videoPreviewRef}
                src={previewUrl}
                poster={capturedThumbnail || undefined}
                controls
                playsInline
                className="max-h-72 w-auto object-contain mx-auto"
                onTimeUpdate={(e) => {
                  const vid = e.currentTarget;
                  if (trimEnd > 0 && vid.currentTime >= trimEnd) {
                    vid.currentTime = trimStart;
                  }
                }}
                onLoadedMetadata={(e) => {
                  const target = e.currentTarget;
                  if (!target) return;
                  const d = target.duration;
                  const vw = target.videoWidth || 0;
                  const vh = target.videoHeight || 0;
                  if (d && !isNaN(d) && isFinite(d) && d > 0) {
                    setVideoDuration(d);
                    setTrimStart(0);
                    setTrimEnd(d);
                    setMediaMeta(prev => ({
                      ...prev,
                      duration: Math.round(d),
                      width: vw || prev?.width,
                      height: vh || prev?.height
                    }));
                    handleCaptureFrame(Math.min(0.5, d / 2));
                  }
                }}
              />
            ) : (
              <img
                src={previewUrl}
                alt="Upload preview"
                className="max-h-72 w-auto object-contain mx-auto"
              />
            )}

            {/* Overlaid Badges */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/70 text-white backdrop-blur-md flex items-center gap-1">
                {isVideo ? <Film className="w-3 h-3 text-amber-400" /> : <ImageIcon className="w-3 h-3 text-indigo-400" />}
                {isVideo ? 'Video' : 'Photo'}
              </span>

              {mediaMeta?.aspectRatio && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/70 text-slate-300 backdrop-blur-md">
                  {mediaMeta.aspectRatio}
                </span>
              )}

              {Boolean(mediaMeta?.duration || videoDuration) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/70 text-amber-300 backdrop-blur-md flex items-center gap-0.5">
                  <Play className="w-2.5 h-2.5 fill-current" />
                  {Math.max(1, Math.round(mediaMeta?.duration || videoDuration))}s
                </span>
              )}
            </div>

            {/* Top Right Action Buttons */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={status === 'uploading'}
                title="Replace Media"
                className="p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                title="Remove Media"
                className="p-1.5 rounded-full bg-rose-600/80 hover:bg-rose-700 text-white backdrop-blur-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Video Cover Frame Selector (YouTube / Instagram Style) */}
          {Boolean(isVideo) && (
            <div className="p-3.5 bg-slate-900 border-t border-slate-800 space-y-3 text-left w-full">
              <div className="flex items-center justify-between text-xs text-white">
                <span className="font-bold flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  Choose Cover Frame
                </span>
                <span className="font-mono text-slate-400 text-[11px]">
                  {Math.floor(coverTimestamp / 60)}:{Math.floor(coverTimestamp % 60) < 10 ? '0' : ''}{Math.floor(coverTimestamp % 60)} / {Math.floor((videoDuration || mediaMeta?.duration || 1) / 60)}:{Math.floor((videoDuration || mediaMeta?.duration || 1) % 60) < 10 ? '0' : ''}{Math.floor((videoDuration || mediaMeta?.duration || 1) % 60)}
                </span>
              </div>

              <div className="flex items-start sm:items-center gap-3">
                {capturedThumbnail ? (
                  <div className="relative group shrink-0">
                    <img
                      src={capturedThumbnail}
                      alt="Cover frame"
                      className="w-14 h-20 rounded-xl object-cover border-2 border-amber-500 shadow-lg shadow-amber-500/20"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white font-medium">
                      Cover
                    </div>
                  </div>
                ) : (
                  <div className="w-14 h-20 rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center shrink-0 text-slate-500">
                    <ImageIcon className="w-5 h-5 mb-1" />
                    <span className="text-[9px]">Cover</span>
                  </div>
                )}

                <div className="flex-1 space-y-2 min-w-0">
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, videoDuration || mediaMeta?.duration || 10)}
                    step="0.1"
                    value={coverTimestamp}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCoverTimestamp(val);
                      if (videoPreviewRef.current) {
                        videoPreviewRef.current.currentTime = val;
                      }
                      handleCaptureFrame(val);
                    }}
                    onPointerUp={() => handleCaptureFrame(coverTimestamp)}
                    onTouchEnd={() => handleCaptureFrame(coverTimestamp)}
                    onMouseUp={() => handleCaptureFrame(coverTimestamp)}
                    className="w-full h-2 bg-slate-700 accent-amber-500 rounded-lg cursor-pointer"
                  />

                  {/* Quick Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const current = videoPreviewRef.current?.currentTime || 0;
                        setCoverTimestamp(current);
                        handleCaptureFrame();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-amber-500/30"
                      title="Grab currently paused video frame"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Grab Current Frame
                    </button>

                    <button
                      type="button"
                      onClick={() => customThumbInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                      title="Upload an image from your device as cover"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Custom Image
                    </button>
                    <input
                      ref={customThumbInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleCustomThumbnailUpload}
                    />
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Scrub the slider or pause video above and click &quot;Grab Current Frame&quot; to pick thumbnail cover.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Video Trim & Clip Duration Studio (YouTube Studio Style) */}
          {Boolean(isVideo) && (videoDuration > 0 || (mediaMeta?.duration || 0) > 0) && (
            <div className="p-3.5 bg-slate-950 border-t border-slate-800 space-y-3 text-left w-full">
              <div className="flex items-center justify-between text-xs text-white">
                <span className="font-bold flex items-center gap-1.5 text-amber-400">
                  <Scissors className="w-4 h-4" />
                  Video Trim & Clip Boundaries
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
                    Duration: {Math.max(0.1, (trimEnd || videoDuration) - trimStart).toFixed(1)}s / {videoDuration.toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Visual Trim Track with Highlighted Range */}
              <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                  style={{
                    left: `${videoDuration > 0 ? (trimStart / videoDuration) * 100 : 0}%`,
                    right: `${videoDuration > 0 ? Math.max(0, 100 - ((trimEnd || videoDuration) / videoDuration) * 100) : 0}%`
                  }}
                />
              </div>

              {/* Dual Sliders: Start & End */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300 text-[11px]">
                    <span className="font-medium">Start: {trimStart.toFixed(1)}s</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = videoPreviewRef.current?.currentTime || 0;
                        const nextStart = Math.min(cur, (trimEnd || videoDuration) - 0.5);
                        setTrimStart(nextStart);
                      }}
                      className="text-amber-400 hover:text-amber-300 underline text-[10px]"
                    >
                      Current Playhead
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, (trimEnd || videoDuration) - 0.5)}
                    step="0.1"
                    value={trimStart}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimStart(val);
                      if (videoPreviewRef.current) {
                        videoPreviewRef.current.currentTime = val;
                      }
                    }}
                    className="w-full h-2 bg-slate-700 accent-amber-500 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300 text-[11px]">
                    <span className="font-medium">End: {(trimEnd || videoDuration).toFixed(1)}s</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = videoPreviewRef.current?.currentTime || videoDuration;
                        const nextEnd = Math.max(cur, trimStart + 0.5);
                        setTrimEnd(nextEnd);
                      }}
                      className="text-amber-400 hover:text-amber-300 underline text-[10px]"
                    >
                      Current Playhead
                    </button>
                  </div>
                  <input
                    type="range"
                    min={trimStart + 0.5}
                    max={videoDuration || 10}
                    step="0.1"
                    value={trimEnd || videoDuration}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimEnd(val);
                      if (videoPreviewRef.current) {
                        videoPreviewRef.current.currentTime = val;
                      }
                    }}
                    className="w-full h-2 bg-slate-700 accent-rose-500 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Quick Presets & Preview Playback */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart(0);
                      setTrimEnd(videoDuration);
                      if (videoPreviewRef.current) videoPreviewRef.current.currentTime = 0;
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700"
                  >
                    Full Video
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart(0);
                      setTrimEnd(Math.min(15, videoDuration));
                      if (videoPreviewRef.current) videoPreviewRef.current.currentTime = 0;
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700"
                  >
                    First 15s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart(0);
                      setTrimEnd(Math.min(30, videoDuration));
                      if (videoPreviewRef.current) videoPreviewRef.current.currentTime = 0;
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700"
                  >
                    First 30s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart(0);
                      setTrimEnd(Math.min(60, videoDuration));
                      if (videoPreviewRef.current) videoPreviewRef.current.currentTime = 0;
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700"
                  >
                    First 60s
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!videoPreviewRef.current) return;
                    videoPreviewRef.current.currentTime = trimStart;
                    videoPreviewRef.current.play();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-emerald-500/30 ml-auto"
                >
                  <Play className="w-3 h-3 fill-emerald-300" />
                  Play Trimmed Clip
                </button>
              </div>
            </div>
          )}

          {/* Upload Progress Bar & Verification State */}
          <div className="p-3 bg-slate-900 border-t border-slate-800">
            {status === 'uploading' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    Uploading and validating signature...
                  </span>
                  <span className="font-bold text-amber-400">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-rose-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'ready' && (
              <div className="flex items-center justify-between text-[11px] text-emerald-400">
                <span className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Binary signature verified & stored
                </span>
                {mediaMeta?.sizeMb && (
                  <span className="text-slate-400 text-[10px]">{mediaMeta.sizeMb} MB</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

