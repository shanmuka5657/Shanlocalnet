import React, { useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';

export interface MediaCardThumbnailProps {
  postId?: string;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  alt?: string;
  className?: string;
  gradient?: string;
  showPlayBadge?: boolean;
}

const isCanvasBlack = (context: CanvasRenderingContext2D, width: number, height: number): boolean => {
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
      if (pixel[0] > 20 || pixel[1] > 20 || pixel[2] > 20) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
};

export const MediaCardThumbnail: React.FC<MediaCardThumbnailProps> = ({
  postId,
  thumbnailUrl,
  mediaUrl,
  alt = 'Media preview',
  className = 'w-full h-full object-cover',
  gradient = 'linear-gradient(135deg, #1e293b, #0f172a)',
  showPlayBadge = false
}) => {
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const attemptCount = useRef<number>(0);

  // Check if existing thumbnail is a black dummy thumbnail
  const isBlackThumb = Boolean(
    thumbnailUrl &&
    thumbnailUrl.length < 1500 &&
    thumbnailUrl.includes('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
  );

  // Reset error states when props change
  useEffect(() => {
    setImgError(false);
    setVideoError(false);
    setCapturedThumbnail(null);
    attemptCount.current = 0;
  }, [thumbnailUrl, mediaUrl]);

  const hasValidThumbnail = Boolean(
    (!isBlackThumb && thumbnailUrl && thumbnailUrl.trim().length > 0 && !imgError) ||
    capturedThumbnail
  );

  const isVideoSource = Boolean(
    mediaUrl &&
    (mediaUrl.endsWith('.mp4') ||
      mediaUrl.endsWith('.webm') ||
      mediaUrl.includes('/videos/') ||
      mediaUrl.includes('/videos_original/') ||
      mediaUrl.startsWith('blob:'))
  );

  // Auto-capture video frame to canvas on loadeddata and persist to backend
  const handleVideoLoadedData = () => {
    if (attemptCount.current >= 3 || !videoRef.current) return;
    attemptCount.current += 1;

    try {
      const v = videoRef.current;
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        const canvas = document.createElement('canvas');
        const targetW = 400;
        const targetH = Math.round((targetW * v.videoHeight) / v.videoWidth);
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, targetW, targetH);
          if (isCanvasBlack(ctx, targetW, targetH)) {
            // If frame at current seek is black, seek to 2.0s
            try {
              v.currentTime = Math.min(2.0, (v.duration || 5) / 2);
            } catch {}
            return;
          }

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          if (dataUrl && dataUrl.length > 200) {
            setCapturedThumbnail(dataUrl);

            // Persist to server if postId is known and has no server thumbnail or had black thumbnail
            if (postId && (isBlackThumb || !thumbnailUrl || thumbnailUrl.trim().length === 0)) {
              fetch(`/api/posts/${postId}/thumbnail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ thumbnailUrl: dataUrl })
              }).catch(() => {});
            }
          }
        }
      }
    } catch {
      // Cross-origin canvas security or decode error - native video display continues normally
    }
  };

  // Strategy 1: Crisp static thumbnail image (or extracted canvas dataUrl)
  if (hasValidThumbnail) {
    return (
      <img
        src={capturedThumbnail || thumbnailUrl!}
        alt={alt}
        className={className}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  // Strategy 2: Native HTML5 video frame (renders exact video frame at 1.5s past warmup)
  if (mediaUrl && isVideoSource && !videoError) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-slate-950">
        <video
          ref={videoRef}
          src={`${mediaUrl}#t=1.5`}
          preload="metadata"
          muted
          playsInline
          crossOrigin="anonymous"
          className={className}
          onLoadedData={handleVideoLoadedData}
          onSeeked={handleVideoLoadedData}
          onError={() => setVideoError(true)}
        />
        {showPlayBadge && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white/80">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Strategy 3: Direct image fallback if mediaUrl is a photo
  if (mediaUrl && !videoError) {
    return (
      <img
        src={mediaUrl}
        alt={alt}
        className={className}
        loading="lazy"
        onError={() => setVideoError(true)}
      />
    );
  }

  // Strategy 4: Fallback gradient with subtle play symbol
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: gradient }}
    >
      <Play className="w-8 h-8 text-white/40" />
    </div>
  );
};
