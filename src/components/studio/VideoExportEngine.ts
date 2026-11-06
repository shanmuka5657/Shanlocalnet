/**
 * LocalNet Video Export Engine — 100% Free Client-Side Video Processing
 * Composites video frames, text, pictures, emojis, stickers, and prices using
 * HTML5 Canvas, Web Audio API, and MediaRecorder directly on the user's device GPU.
 */

import { VideoProject, VideoOverlay } from './types.ts';
import { FILTER_PRESETS } from './FilterAudioControls.tsx';

export interface ExportProgress {
  stage: 'preparing' | 'rendering' | 'compressing' | 'completed' | 'error';
  progressPercent: number;
  errorMessage?: string;
}

export class VideoExportEngine {
  /**
   * Generates a crisp, non-black WebP poster thumbnail from a video element or URL.
   */
  static async generatePosterThumbnail(
    videoElement: HTMLVideoElement,
    targetTimestamp = 0.5
  ): Promise<string> {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const targetW = 480;
        const targetH = Math.round((targetW * (videoElement.videoHeight || 1920)) / (videoElement.videoWidth || 1080));
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve('');
          return;
        }

        const prevTime = videoElement.currentTime;
        videoElement.currentTime = targetTimestamp;

        const onSeeked = () => {
          videoElement.removeEventListener('seeked', onSeeked);
          ctx.drawImage(videoElement, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/webp', 0.82);
          videoElement.currentTime = prevTime;
          resolve(dataUrl);
        };

        videoElement.addEventListener('seeked', onSeeked, { once: true });
      } catch (err) {
        console.warn('Poster thumbnail generation error:', err);
        resolve('');
      }
    });
  }

  /**
   * Exports the video with all composite overlays rendered into a single MP4/WebM file.
   */
  static async exportCompositeVideo(
    project: VideoProject,
    onProgress: (status: ExportProgress) => void
  ): Promise<{ file: File; posterDataUrl: string }> {
    onProgress({ stage: 'preparing', progressPercent: 10 });

    // 1. If project has no overlays and no filter/speed adjustments, return source directly
    const hasModifications =
      project.overlays.length > 0 ||
      project.activeFilter !== 'normal' ||
      project.playbackSpeed !== 1.0 ||
      project.brightness !== 1.0 ||
      project.contrast !== 1.0 ||
      project.saturation !== 1.0 ||
      project.trimStart > 0 ||
      (project.trimEnd > 0 && project.trimEnd < project.duration);

    if (!hasModifications && project.sourceFile) {
      onProgress({ stage: 'completed', progressPercent: 100 });
      return {
        file: project.sourceFile,
        posterDataUrl: project.posterDataUrl || ''
      };
    }

    // 2. Feature detection for Canvas captureStream and MediaRecorder
    const isSupported =
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      typeof window.MediaRecorder === 'function';

    if (!isSupported) {
      console.warn('MediaRecorder or captureStream not supported in this environment, falling back to source file.');
      onProgress({ stage: 'completed', progressPercent: 100 });
      return {
        file: project.sourceFile || new File([], 'short.mp4'),
        posterDataUrl: project.posterDataUrl || ''
      };
    }

    return new Promise(async (resolve, reject) => {
      try {
        const video = document.createElement('video');
        video.src = project.sourceUrl;
        video.crossOrigin = 'anonymous';
        video.playsInline = true;
        video.muted = project.isOriginalAudioMuted;

        await new Promise((res, rej) => {
          video.onloadedmetadata = res;
          video.onerror = rej;
        });

        // Set up 9:16 portrait export canvas
        const canvas = document.createElement('canvas');
        canvas.width = 720;
        canvas.height = 1280;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        // Setup Audio context with original video audio + optional background music mixing
        let audioStream: MediaStream | null = null;
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();

          // Original video audio with volume control
          const videoSource = audioCtx.createMediaElementSource(video);
          const videoGain = audioCtx.createGain();
          videoGain.gain.value = project.isOriginalAudioMuted ? 0 : (project.originalAudioVolume ?? 1.0);
          videoSource.connect(videoGain);
          videoGain.connect(dest);

          // Mix in background music if selected
          if (project.backgroundMusicUrl) {
            try {
              const bgAudio = new Audio();
              bgAudio.crossOrigin = 'anonymous';
              bgAudio.src = project.backgroundMusicUrl;
              bgAudio.loop = true;
              await new Promise<void>((res) => {
                bgAudio.oncanplaythrough = () => res();
                bgAudio.onerror = () => res();
                setTimeout(res, 3000); // Don't wait forever
              });
              const bgSource = audioCtx.createMediaElementSource(bgAudio);
              const bgGain = audioCtx.createGain();
              bgGain.gain.value = project.backgroundMusicVolume ?? 0.8;
              bgSource.connect(bgGain);
              bgGain.connect(dest);
              bgAudio.play().catch(() => {});
            } catch {
              // BG music mixing is optional — skip silently on error
            }
          }

          audioStream = dest.stream;
        } catch {
          // Audio routing not strictly required if browser restricts
        }

        const stream = canvas.captureStream(30); // 30 FPS target
        if (audioStream) {
          audioStream.getAudioTracks().forEach(t => stream.addTrack(t));
        }

        const supportedMime = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4'
        ].find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

        const recorder = new MediaRecorder(stream, { mimeType: supportedMime });
        const chunks: Blob[] = [];

        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: supportedMime });
          const file = new File([blob], `short_${Date.now()}.${supportedMime.includes('mp4') ? 'mp4' : 'webm'}`, {
            type: supportedMime
          });
          onProgress({ stage: 'completed', progressPercent: 100 });
          resolve({ file, posterDataUrl: project.posterDataUrl || '' });
        };

        // Preload any image overlays for canvas drawing
        const loadedImages = new Map<string, HTMLImageElement>();
        for (const overlay of project.overlays) {
          if (overlay.assetUrl && !loadedImages.has(overlay.assetUrl)) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = overlay.assetUrl;
            await new Promise(r => {
              img.onload = r;
              img.onerror = r;
            });
            loadedImages.set(overlay.assetUrl, img);
          }
        }

        const duration = (project.trimEnd > 0 ? project.trimEnd : project.duration) - project.trimStart;
        recorder.start();
        video.currentTime = project.trimStart;
        await video.play();

        onProgress({ stage: 'rendering', progressPercent: 20 });

        // Frame rendering loop
        const drawFrame = () => {
          if (video.paused || video.ended || video.currentTime >= (project.trimEnd || project.duration)) {
            recorder.stop();
            return;
          }

          const currentT = video.currentTime;
          const elapsed = currentT - project.trimStart;
          const percent = Math.min(95, 20 + Math.round((elapsed / duration) * 75));
          onProgress({ stage: 'rendering', progressPercent: percent });

          // 1. Draw video background
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Apply active CSS filters
          const activePreset = FILTER_PRESETS.find(p => p.id === project.activeFilter);
          const filterStr = activePreset && activePreset.id !== 'normal' ? activePreset.cssFilter : '';
          ctx.filter = filterStr || 'none';

          // Center crop to 9:16
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.filter = 'none';

          // 2. Draw active overlays at this timestamp
          for (const overlay of project.overlays) {
            if (currentT >= overlay.startTime && currentT <= overlay.endTime) {
              ctx.save();

              const posX = (overlay.position.x / 100) * canvas.width;
              const posY = (overlay.position.y / 100) * canvas.height;
              const width = (overlay.size.width / 100) * canvas.width;
              ctx.translate(posX, posY);

              if (overlay.rotation) {
                ctx.rotate((overlay.rotation * Math.PI) / 180);
              }
              if (overlay.opacity !== undefined) {
                ctx.globalAlpha = overlay.opacity;
              }

              if (overlay.type === 'text' && overlay.content) {
                // Resolve font family from stored key
                const FONT_MAP: Record<string, string> = {
                  sans: 'Arial, sans-serif',
                  serif: 'Georgia, serif',
                  mono: '"Courier New", monospace',
                  impact: 'Impact, "Arial Black", sans-serif',
                  glow: 'Arial, sans-serif',
                };
                const resolvedFont = FONT_MAP[overlay.style?.fontFamily || 'sans'] || 'Arial, sans-serif';
                const fontSize = (overlay.style?.fontSize || 22) * (canvas.width / 340);
                ctx.font = `${overlay.style?.fontWeight || 'bold'} ${fontSize}px ${resolvedFont}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Neon glow effect
                if (overlay.style?.textShadow && overlay.style.textShadow !== 'none' && overlay.style.textShadow.includes('0 0')) {
                  ctx.shadowColor = overlay.style.color || '#ffffff';
                  ctx.shadowBlur = 18;
                } else {
                  ctx.shadowBlur = 0;
                }

                if (overlay.style?.backgroundColor && overlay.style.backgroundColor !== 'transparent') {
                  const textMetrics = ctx.measureText(overlay.content);
                  const padX = 16;
                  const padY = 10;
                  ctx.fillStyle = overlay.style.backgroundColor;
                  ctx.beginPath();
                  ctx.roundRect(
                    -textMetrics.width / 2 - padX,
                    -fontSize / 2 - padY,
                    textMetrics.width + padX * 2,
                    fontSize + padY * 2,
                    8
                  );
                  ctx.fill();
                }

                ctx.fillStyle = overlay.style?.color || '#ffffff';
                ctx.fillText(overlay.content, 0, 0);
                ctx.shadowBlur = 0;
              } else if (overlay.assetUrl && loadedImages.has(overlay.assetUrl)) {
                // Draw Image / Emoji / Sticker
                const img = loadedImages.get(overlay.assetUrl)!;
                const aspect = (img.naturalHeight || 1) / (img.naturalWidth || 1);
                const height = width * aspect;
                ctx.drawImage(img, -width / 2, -height / 2, width, height);
              } else if (overlay.type === 'price' && overlay.metadata) {
                // Draw Price Tag
                const tagW = width;
                const tagH = 65;
                const pScale = canvas.width / 340;
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.roundRect(-tagW / 2, -tagH / 2, tagW, tagH, 12);
                ctx.fill();
                ctx.fillStyle = '#0f172a';
                ctx.font = `bold ${Math.round(22 * pScale)}px Arial, sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(`₹${overlay.metadata.discountPrice}`, -tagW / 2 + 16, 5);
                ctx.font = `bold ${Math.round(14 * pScale)}px Arial, sans-serif`;
                ctx.fillText(overlay.metadata.productName || 'Offer', -tagW / 2 + 16, -14);
                if ((overlay.metadata.discountPercent || 0) > 0) {
                  ctx.textAlign = 'right';
                  ctx.font = `bold ${Math.round(11 * pScale)}px Arial, sans-serif`;
                  ctx.fillText(`${overlay.metadata.discountPercent}% OFF`, tagW / 2 - 10, 5);
                }
              } else if (overlay.type === 'merchant' && overlay.metadata) {
                // Draw Merchant Badge or Store Location Pill
                const mW = width;
                const mH = 55;
                const mScale = canvas.width / 340;
                if (overlay.metadata.presetType === 'discount') {
                  const mGrad = ctx.createLinearGradient(-mW / 2, 0, mW / 2, 0);
                  mGrad.addColorStop(0, '#dc2626');
                  mGrad.addColorStop(1, '#f59e0b');
                  ctx.fillStyle = mGrad;
                  ctx.beginPath();
                  ctx.roundRect(-mW / 2, -mH / 2, mW, mH, 12);
                  ctx.fill();
                  ctx.fillStyle = '#ffffff';
                  ctx.font = `bold ${Math.round(18 * mScale)}px Arial, sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.fillText(overlay.content || '', 0, 8);
                } else if (overlay.metadata.presetType === 'store') {
                  ctx.fillStyle = 'rgba(15,23,42,0.92)';
                  ctx.beginPath();
                  ctx.roundRect(-mW / 2, -mH / 2, mW, mH, 12);
                  ctx.fill();
                  ctx.strokeStyle = '#f59e0b';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  ctx.fillStyle = '#ffffff';
                  ctx.font = `bold ${Math.round(15 * mScale)}px Arial, sans-serif`;
                  ctx.textAlign = 'left';
                  ctx.fillText(String(overlay.metadata.storeName || ''), -mW / 2 + 28, -4);
                  ctx.fillStyle = '#94a3b8';
                  ctx.font = `${Math.round(11 * mScale)}px Arial, sans-serif`;
                  ctx.fillText(String(overlay.metadata.storeAddress || ''), -mW / 2 + 28, 14);
                }
              } else if (overlay.type === 'coupon' && overlay.metadata) {
                // Draw Coupon Overlay
                const cW = width;
                const cH = 55;
                const cScale = canvas.width / 340;
                const cGrad = ctx.createLinearGradient(-cW / 2, 0, cW / 2, 0);
                cGrad.addColorStop(0, '#059669');
                cGrad.addColorStop(1, '#0d9488');
                ctx.fillStyle = cGrad;
                ctx.beginPath();
                ctx.roundRect(-cW / 2, -cH / 2, cW, cH, 12);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(14 * cScale)}px Arial, sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(String(overlay.content || ''), -cW / 2 + 28, -4);
                ctx.fillStyle = '#a7f3d0';
                ctx.font = `${Math.round(11 * cScale)}px Arial, sans-serif`;
                ctx.fillText(`Code: ${String(overlay.metadata.couponCode || '')}`, -cW / 2 + 28, 14);
              }

              ctx.restore();
            }
          }

          requestAnimationFrame(drawFrame);
        };

        requestAnimationFrame(drawFrame);
      } catch (err: any) {
        console.error('Composite export error:', err);
        onProgress({ stage: 'error', progressPercent: 0, errorMessage: err.message });
        reject(err);
      }
    });
  }
}

