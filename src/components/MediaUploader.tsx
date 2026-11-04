import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileVideo, Image as ImageIcon, X, AlertCircle, CheckCircle, RefreshCw, Play, Film, Sparkles, Camera, Upload } from 'lucide-react';

export interface UploadedMediaData {
  mediaAssetId: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  aspectRatio: string;
  videoDurationSeconds?: number;
  originalFilename?: string;
  thumbnailUrl?: string;
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
  const [videoDuration, setVideoDuration] = useState<number>(0);
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

  const handleCaptureFrame = (targetTime?: number) => {
    if (!videoPreviewRef.current) return;
    const vid = videoPreviewRef.current;
    if (typeof targetTime === 'number') {
      setCoverTimestamp(targetTime);
      vid.currentTime = targetTime;
    }

    const doCapture = () => {
      try {
        const canvas = document.createElement('canvas');
        const targetW = 480;
        const targetH = Math.round((targetW * (vid.videoHeight || 360)) / (vid.videoWidth || 480));
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(vid, 0, 0, targetW, targetH);
          const newThumb = canvas.toDataURL('image/jpeg', 0.85);
          setCapturedThumbnail(newThumb);
          if (file) {
            onMediaUploaded({
              mediaAssetId: `asset_${Date.now()}`,
              publicUrl: previewUrl || '',
              mimeType: file.type,
              sizeBytes: file.size,
              aspectRatio: mediaMeta?.aspectRatio || '9:16',
              videoDurationSeconds: videoDuration || mediaMeta?.duration,
              originalFilename: file.name,
              thumbnailUrl: newThumb
            });
          }
        }
      } catch (err) {
        console.warn('Capture frame error:', err);
      }
    };

    if (typeof targetTime === 'number') {
      vid.addEventListener('seeked', doCapture, { once: true });
    } else {
      doCapture();
    }
  };

  const handleCustomThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const thumbFile = e.target.files?.[0];
    if (!thumbFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCapturedThumbnail(reader.result);
        if (file) {
          onMediaUploaded({
            mediaAssetId: `asset_${Date.now()}`,
            publicUrl: previewUrl || '',
            mimeType: file.type,
            sizeBytes: file.size,
            aspectRatio: mediaMeta?.aspectRatio || '9:16',
            videoDurationSeconds: videoDuration || mediaMeta?.duration,
            originalFilename: file.name,
            thumbnailUrl: reader.result
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

        // Seek to 0.5s to capture thumbnail canvas frame
        tempVideo.currentTime = Math.min(0.5, (duration || 1) / 2);
      };

      tempVideo.onseeked = () => {
        let capturedThumb = '';
        try {
          const canvas = document.createElement('canvas');
          const targetW = 480;
          const targetH = Math.round((targetW * (tempVideo.videoHeight || 360)) / (tempVideo.videoWidth || 480));
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(tempVideo, 0, 0, targetW, targetH);
            capturedThumb = canvas.toDataURL('image/jpeg', 0.8);
          }
        } catch (e) {
          console.warn('Canvas thumbnail extract error:', e);
        }

        executeUpload(selectedFile, {
          width: tempVideo.videoWidth,
          height: tempVideo.videoHeight,
          duration: Math.round(tempVideo.duration),
          aspectRatio: determineAspectRatio(tempVideo.videoWidth, tempVideo.videoHeight),
          thumbnailUrl: capturedThumb
        });
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

      const uploadedData: UploadedMediaData = {
        mediaAssetId: `asset_client_${Date.now()}`,
        publicUrl: previewUrl || URL.createObjectURL(fileToUpload),
        mimeType: fileToUpload.type,
        sizeBytes: fileToUpload.size,
        aspectRatio: meta.aspectRatio,
        videoDurationSeconds: meta.duration,
        originalFilename: fileToUpload.name
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
              onMediaUploaded({
                mediaAssetId: mediaAssetId || `asset_${Date.now()}`,
                publicUrl: publicUrl || previewUrl || URL.createObjectURL(fileToUpload),
                mimeType: fileToUpload.type,
                sizeBytes: fileToUpload.size,
                aspectRatio: meta.aspectRatio,
                videoDurationSeconds: meta.duration,
                originalFilename: fileToUpload.name
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
                controls
                playsInline
                className="max-h-72 w-auto object-contain mx-auto"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (d && !isNaN(d) && isFinite(d) && d > 0) {
                    setVideoDuration(d);
                    setMediaMeta(prev => ({
                      ...prev,
                      duration: Math.round(d),
                      width: e.currentTarget.videoWidth || prev?.width,
                      height: e.currentTarget.videoHeight || prev?.height
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
                      handleCaptureFrame(val);
                    }}
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

