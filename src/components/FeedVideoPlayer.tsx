import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Post } from '../types/index.ts';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Film,
  Heart,
  Loader2,
  RotateCcw,
  RotateCw,
  Music
} from 'lucide-react';
import { triggerHaptic } from '../lib/haptics.ts';

interface FeedVideoPlayerProps {
  post: Post;
  isCurrentlyPlaying: boolean;
  onPlayRequest: () => void;
  onPauseRequest: () => void;
  onOpenReels?: () => void;
  onDoubleTapLike?: () => void;
  isLiked?: boolean;
  /** Called once when the video has been watched for ≥ 3 seconds */
  onVideoSeen?: (postId: string) => void;
  /** Called once when ≥ 50% of the video has been watched */
  onWatch50?: (postId: string) => void;
}

export const FeedVideoPlayer: React.FC<FeedVideoPlayerProps> = ({
  post,
  isCurrentlyPlaying,
  onPlayRequest,
  onPauseRequest,
  onOpenReels,
  onDoubleTapLike,
  isLiked,
  onVideoSeen,
  onWatch50
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track watch milestones — fire each only once per video session
  const seenFiredRef = useRef(false);
  const watch50FiredRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(post.videoDurationSeconds || 0);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  // When the proxy stream fails (Vercel/no yt-dlp), fall back to YouTube iframe
  const [useYouTubeIframe, setUseYouTubeIframe] = useState(false);
  const [youtubeSrc, setYoutubeSrc] = useState('');
  const [doubleTapHeart, setDoubleTapHeart] = useState<{ x: number; y: number } | null>(null);
  const [centerIconFlash, setCenterIconFlash] = useState<'play' | 'pause' | null>(null);
  const [skipAnimation, setSkipAnimation] = useState<'backward' | 'forward' | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const isPreviewRef = useRef(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPositionPx, setHoverPositionPx] = useState<number | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // FIX: track last real touch event so we can ignore the synthesized
  // mouseenter that the browser fires on every tap (mobile only).
  const lastTouchTimeRef = useRef<number>(0);
  const lastTapRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // FIX: track showControls in a ref so the single-tap handler always
  // reads the current value without needing it in its closure.
  const showControlsRef = useRef(true);

  // Keep showControlsRef in sync with state
  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);

  // Global listener to ensure strictly ONE video plays at any time
  useEffect(() => {
    const handleGlobalVideoPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail && customEvent.detail.id !== post.id) {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        setIsPreviewPlaying(false);
        isPreviewRef.current = false;
      }
    };

    window.addEventListener('localnet:video-play', handleGlobalVideoPlay);
    return () => window.removeEventListener('localnet:video-play', handleGlobalVideoPlay);
  }, [post.id]);

  // Sync external play/pause instruction with local video element
  useEffect(() => {
    if (!videoRef.current) return;
    if (isCurrentlyPlaying) {
      // FIX: only clear preview flags here; do NOT call play() if the video
      // is already playing (it may be in preview, which is fine — we just
      // let it keep playing and the tap handler will unmute it).
      setIsPreviewPlaying(false);
      // FIX: only clear isPreviewRef if we are sure the preview .then()
      // has already resolved (i.e., don't race with IntersectionObserver).
      // We leave isPreviewRef as-is here; togglePlayPause clears it on tap.
      if (videoRef.current.paused) {
        document.querySelectorAll('video').forEach((v) => {
          if (v !== videoRef.current && !v.paused) v.pause();
        });
        window.dispatchEvent(new CustomEvent('localnet:video-play', { detail: { id: post.id } }));
        videoRef.current.play().catch(() => {
          onPauseRequest();
        });
      }
    } else {
      if (!videoRef.current.paused && !isPreviewRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isCurrentlyPlaying, onPauseRequest, post.id]);

  // YouTube-style: Auto-play 5-second muted promo preview
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isCurrentlyPlaying) {
          const anyPlaying = Array.from(document.querySelectorAll('video')).some(
            (v) => v !== videoRef.current && !v.paused
          );
          if (anyPlaying) return;

          // Never restart preview if the user has already watched past 0.3s
          if (videoRef.current && videoRef.current.paused) {
            if (videoRef.current.currentTime > 0.3) {
              return;
            }
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.currentTime = 0;
            window.dispatchEvent(new CustomEvent('localnet:video-play', { detail: { id: post.id } }));
            videoRef.current
              .play()
              .then(() => {
                setIsPreviewPlaying(true);
                isPreviewRef.current = true;
              })
              .catch(() => { });
          }
        } else if (!entry.isIntersecting && isPreviewRef.current) {
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
          setIsPreviewPlaying(false);
          isPreviewRef.current = false;
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isCurrentlyPlaying, post.id]);

  // Handle Fullscreen state change events
  useEffect(() => {
    const handleFsChange = () => {
      const activeFs = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(activeFs === containerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Controls auto-hide timer (3.5 seconds so user has comfortable time to use controls)
  const resetControlsTimer = useCallback((delayMs = 3500) => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isCurrentlyPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, delayMs);
    }
  }, [isCurrentlyPlaying]);

  useEffect(() => {
    if (!isCurrentlyPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isCurrentlyPlaying, resetControlsTimer]);

  // Video time & duration updates
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    // 5-second promo preview loop (only in preview mode)
    if (isPreviewRef.current && cur >= 5.0) {
      videoRef.current.currentTime = 0;
    }

    const totalDur = videoRef.current.duration || duration || 1;

    // ── Watch milestone tracking ─────────────────────────────────────────
    // Mark as "seen" after 3 seconds of real (non-preview) playback
    if (isCurrentlyPlaying && cur >= 3 && !seenFiredRef.current) {
      seenFiredRef.current = true;
      onVideoSeen?.(post.id);
    }
    // Track 50% completion
    if (isCurrentlyPlaying && totalDur > 0 && cur / totalDur >= 0.5 && !watch50FiredRef.current) {
      watch50FiredRef.current = true;
      onWatch50?.(post.id);
    }
    // ─────────────────────────────────────────────────────────────────────

    if (!duration && videoRef.current.duration) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const d = videoRef.current.duration;
    if (d && !isNaN(d) && isFinite(d) && d > 0) {
      setDuration(d);
    }
    // Seek to 0.5s so browsers render a real frame instead of a black box.
    // Only on cold-start (currentTime === 0) and only when no poster exists.
    if (!post.mediaThumbnail && !isCurrentlyPlaying && videoRef.current.currentTime === 0) {
      try {
        videoRef.current.currentTime = 0.5;
      } catch { }
    }
  };

  // FIX: Exit preview mode and transition to full playback WITHOUT restarting.
  // Saves currentTime before any state changes and restores it afterward.
  const exitPreviewAndPlay = () => {
    if (!videoRef.current) return;

    // 1. Save the current position immediately.
    const savedTime = videoRef.current.currentTime;

    // 2. Clear preview flags BEFORE calling onPlayRequest so the
    //    isCurrentlyPlaying effect does not race with them.
    setIsPreviewPlaying(false);
    isPreviewRef.current = false;

    // 3. Unmute the video element directly (instant, no async).
    videoRef.current.muted = false;
    setIsMuted(false);

    // 4. Tell parent this video is now the active one.
    onPlayRequest();

    // 5. Restore position if anything reset it during the state transition.
    //    Use requestAnimationFrame so it runs after React flushes effects.
    requestAnimationFrame(() => {
      if (videoRef.current && Math.abs(videoRef.current.currentTime - savedTime) > 0.3) {
        videoRef.current.currentTime = savedTime;
      }
      // Ensure the video is actually playing (it may have been paused by the effect).
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => { });
      }
    });
  };

  // Play / Pause toggle — called only from the explicit play/pause button,
  // never from a tap on the video surface (taps only show/hide controls).
  const togglePlayPause = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('light');
    if (!videoRef.current) return;

    if (isPreviewPlaying || isPreviewRef.current) {
      // FIX: transition from preview to full play; save & restore position.
      exitPreviewAndPlay();
      setCenterIconFlash('play');
      setTimeout(() => setCenterIconFlash(null), 600);
      resetControlsTimer();
      return;
    }

    if (videoRef.current.paused) {
      onPlayRequest();
      setCenterIconFlash('play');
    } else {
      onPauseRequest();
      setCenterIconFlash('pause');
    }
    setTimeout(() => setCenterIconFlash(null), 600);
    resetControlsTimer();
  };

  // Skip Forward / Backward by N seconds (YouTube style)
  const handleSkip = (seconds: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    const total = videoRef.current.duration || duration || post.videoDurationSeconds || 0;
    const current = videoRef.current.currentTime || 0;
    const target = Math.max(0, Math.min(total || 99999, current + seconds));

    videoRef.current.currentTime = target;
    setCurrentTime(target);

    setSkipAnimation(seconds < 0 ? 'backward' : 'forward');
    setTimeout(() => setSkipAnimation(null), 700);
    resetControlsTimer();
  };

  // Picture-in-Picture toggle
  const togglePiP = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
    resetControlsTimer();
  };

  // Fullscreen toggle
  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    const isFs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (!isFs) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => { });
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
        (videoRef.current as any).webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  // Scrubber timeline seek logic
  const performSeek = (clientX: number) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const total = videoRef.current.duration || duration || post.videoDurationSeconds || 0;
    if (!total || total <= 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = ratio * total;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Click & Drag scrubber handler
  const handleScrubStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    performSeek(clientX);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const cx = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      performSeek(cx);
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      resetControlsTimer();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const total = videoRef.current?.duration || duration || post.videoDurationSeconds || 0;
    if (!total || total <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = offsetX / rect.width;
    const time = ratio * total;
    setHoverPercent(ratio * 100);
    setHoverTime(time);
    setHoverPositionPx(offsetX);
    setIsHoveringScrubber(true);
    if (previewVideoRef.current && isFinite(time)) {
      previewVideoRef.current.currentTime = time;
    }
  };

  const handleScrubberMouseLeave = () => {
    setIsHoveringScrubber(false);
    setHoverPercent(null);
    setHoverTime(null);
    setHoverPositionPx(null);
  };

  // FIX: Video stage click handler.
  const handleStageClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickWidth = rect.width;
    const xRatio = clickX / clickWidth;

    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    lastTapRef.current = now;

    if (timeDiff < 400) {
      // ── Double tap ──────────────────────────────────────────────────────
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      if (xRatio < 0.35) {
        handleSkip(-10);
      } else if (xRatio > 0.65) {
        handleSkip(10);
      } else {
        if (onDoubleTapLike) {
          triggerHaptic('doubleTap');
          const y = e.clientY - rect.top;
          setDoubleTapHeart({ x: clickX, y });
          setTimeout(() => setDoubleTapHeart(null), 800);
          onDoubleTapLike();
        }
      }
    } else {
      // ── Single tap ──────────────────────────────────────────────────────
      singleTapTimeoutRef.current = setTimeout(() => {
        if (isPreviewPlaying || isPreviewRef.current) {
          // In preview mode: tap exits preview and starts full play from current position
          exitPreviewAndPlay();
          setCenterIconFlash('play');
          setTimeout(() => setCenterIconFlash(null), 600);
          resetControlsTimer();
        } else if (videoRef.current && videoRef.current.paused) {
          // If paused: resume playing from current position (never restart from 0)
          onPlayRequest();
          videoRef.current.play().catch(() => {});
          setCenterIconFlash('play');
          setTimeout(() => setCenterIconFlash(null), 600);
          resetControlsTimer();
        } else {
          // In full-play mode: tap shows controls for 3.5s so user can use skip, pause, volume, etc.
          resetControlsTimer();
        }
      }, 220);
    }
  };

  // Mute / Volume toggle
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
    if (!nextMuted && videoRef.current.volume === 0) {
      videoRef.current.volume = 1;
      setVolume(1);
    }
    resetControlsTimer();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
    resetControlsTimer();
  };

  // Playback rate cycle (1x → 1.25x → 1.5x → 2x)
  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
    resetControlsTimer();
  };

  // Keyboard controls when hovering player
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'j') {
      e.preventDefault();
      handleSkip(-10);
    } else if (e.key === 'ArrowRight' || e.key === 'l') {
      e.preventDefault();
      handleSkip(10);
    } else if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 'p') {
      e.preventDefault();
      togglePiP();
    } else if (e.key === 'f') {
      e.preventDefault();
      toggleFullscreen(e as any);
    } else if (e.key === 'm') {
      e.preventDefault();
      toggleMute(e as any);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration || post.videoDurationSeconds || 0;
  const progressPercent = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  // ── YouTube iframe fallback (proxy failed on Vercel / no yt-dlp) ─────────
  if (useYouTubeIframe && youtubeSrc) {
    return (
      <div className={`relative w-full aspect-[4/3] max-h-[560px] bg-black overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen max-h-none aspect-auto' : ''}`}>
        <iframe
          src={youtubeSrc}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          className="w-full h-full border-0"
          title={post.title}
        />
        {/* Small badge showing YouTube fallback mode */}
        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold flex items-center gap-1 pointer-events-none">
          <svg className="w-3 h-3 fill-red-500" viewBox="0 0 24 24"><path d="M21.582 7.186a2.506 2.506 0 0 0-1.762-1.774C18.254 5 12 5 12 5s-6.254 0-7.82.412A2.506 2.506 0 0 0 2.418 7.186 26.26 26.26 0 0 0 2 12a26.26 26.26 0 0 0 .418 4.814 2.506 2.506 0 0 0 1.762 1.774C5.746 19 12 19 12 19s6.254 0 7.82-.412a2.506 2.506 0 0 0 1.762-1.774A26.26 26.26 0 0 0 22 12a26.26 26.26 0 0 0-.418-4.814zM10 15V9l5.2 3-5.2 3z"/></svg>
          YouTube
        </div>
      </div>
    );
  }

  if (hasError || !post.mediaUrl) {
    return (
      <div
        onClick={() => {
          setHasError(false);
          onPlayRequest();
        }}
        className={`w-full h-full aspect-[4/3] bg-gradient-to-br ${post.mediaGradient || 'from-amber-600 via-rose-700 to-indigo-950'
          } flex flex-col items-center justify-center p-4 text-center text-white relative cursor-pointer`}
      >
        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 active:scale-90 transition-transform">
          <Play className="w-6 h-6 text-white ml-0.5" />
        </div>
        <p className="font-bold text-xs sm:text-sm line-clamp-1 max-w-xs">{post.title}</p>
        <span className="text-[10px] text-white/70 mt-0.5">{post.creatorName}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={() => resetControlsTimer()}
      onTouchStart={() => {
        lastTouchTimeRef.current = Date.now();
        resetControlsTimer();
      }}
      onMouseEnter={() => {
        const touchedRecently = Date.now() - lastTouchTimeRef.current < 4000;
        if (touchedRecently) return;
        setShowControls(true);

        // Real desktop mouse hover → start muted 5 s preview from the
        // beginning ONLY if the video hasn't been watched yet.
        if (!isCurrentlyPlaying && videoRef.current && videoRef.current.paused) {
          videoRef.current.muted = true;
          setIsMuted(true);
          // Only reset to 0 on a truly cold start (never mid-watch).
          if (videoRef.current.currentTime < 0.5) {
            videoRef.current.currentTime = 0;
          }
          videoRef.current.play().then(() => {
            setIsPreviewPlaying(true);
            isPreviewRef.current = true;
          }).catch(() => { });
        }
      }}
      onMouseLeave={() => {
        // Skip synthetic mouseleave fired on touch devices
        const touchedRecently = Date.now() - lastTouchTimeRef.current < 4000;
        if (touchedRecently) return;

        if (isCurrentlyPlaying) {
          setShowControls(false);
        } else if (isPreviewPlaying || isPreviewRef.current) {
          if (videoRef.current) {
            videoRef.current.pause();
          }
          setIsPreviewPlaying(false);
          isPreviewRef.current = false;
        }
      }}
      className={`group/player relative w-full bg-black overflow-hidden select-none outline-none ${isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen flex items-center justify-center'
          : 'aspect-[4/3] max-h-[560px] rounded-b-none'
        }`}
    >
      {/* Video Element — single element, never remounted */}
      <video
        ref={videoRef}
        id={`feed-video-${post.id}`}
        src={
          // Normalise S3 region — always use the explicit regional endpoint.
          // FIX: removed the #t=0.5 URL fragment that was present in older
          // versions; it caused seek resets on some mobile browsers.
          // The 0.5 s thumbnail seek is now handled in onLoadedMetadata.
          (post.mediaUrl?.includes('.s3.amazonaws.com') && !post.mediaUrl.includes('.s3.ap-southeast-2.amazonaws.com'))
            ? post.mediaUrl.replace('.s3.amazonaws.com', '.s3.ap-southeast-2.amazonaws.com')
            : post.mediaUrl
        }
        poster={post.mediaThumbnail || undefined}
        onPlay={() => {
          // FIX: do NOT call onPlayRequest() when the video fires its onPlay
          // event during the auto-preview — that would wrongly set
          // isCurrentlyPlaying=true and trigger effects that race with the
          // IntersectionObserver, ultimately resetting currentTime to 0.
          // Only broadcast "I am the active video" when we are in real
          // (non-preview) playback, i.e. when isPreviewRef is already false.
          if (!isPreviewRef.current) {
            document.querySelectorAll('video').forEach((v) => {
              if (v !== videoRef.current && !v.paused) {
                v.pause();
              }
            });
            window.dispatchEvent(new CustomEvent('localnet:video-play', { detail: { id: post.id } }));
            onPlayRequest();
          }
        }}
        loop
        muted={isMuted}
        playsInline
        preload={isCurrentlyPlaying ? 'auto' : 'metadata'}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => {
          // If this is a proxy-stream URL that failed (e.g. on Vercel without yt-dlp),
          // extract the YouTube ID and fall back to an iframe embed automatically.
          const url = post.mediaUrl || '';
          const proxyMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{8,15})/);
          if (url.includes('/api/proxy-stream') && proxyMatch?.[1]) {
            const ytId = proxyMatch[1];
            setYoutubeSrc(`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`);
            setUseYouTubeIframe(true);
          } else {
            setHasError(true);
          }
        }}
        onClick={handleStageClick}
        className={`w-full h-full cursor-pointer ${isFullscreen ? 'max-h-screen object-contain' : 'object-cover'
          }`}
      />

      {/* Double Tap Heart Animation (Instagram Style) */}
      {doubleTapHeart && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 animate-ping"
          style={{ left: doubleTapHeart.x, top: doubleTapHeart.y }}
        >
          <Heart className="w-20 h-20 fill-rose-500 text-rose-500 drop-shadow-2xl" />
        </div>
      )}

      {/* YouTube Double-Tap Skip Feedback Ripple */}
      {skipAnimation === 'backward' && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center bg-black/60 backdrop-blur-md text-white px-4 py-3 rounded-full animate-fade-in shadow-2xl">
          <RotateCcw className="w-8 h-8 animate-spin [animation-iteration-count:1]" />
          <span className="text-xs font-bold font-mono mt-1">-10 sec</span>
        </div>
      )}

      {skipAnimation === 'forward' && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center bg-black/60 backdrop-blur-md text-white px-4 py-3 rounded-full animate-fade-in shadow-2xl">
          <RotateCw className="w-8 h-8 animate-spin [animation-iteration-count:1]" />
          <span className="text-xs font-bold font-mono mt-1">+10 sec</span>
        </div>
      )}

      {/* Center Icon Flash (Play/Pause confirmation) */}
      {centerIconFlash && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-2xl scale-125 transition-transform">
            {centerIconFlash === 'play' ? (
              <Play className="w-8 h-8 fill-white ml-1" />
            ) : (
              <Pause className="w-8 h-8 fill-white" />
            )}
          </div>
        </div>
      )}

      {/* Buffering Indicator — shimmer bar at top + spinner */}
      {isBuffering && isCurrentlyPlaying && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          {/* Top loading bar shimmer */}
          <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-shimmer" />
          </div>
          <div className="p-3 rounded-full bg-black/60 backdrop-blur-md">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Always-visible playback progress bar at the bottom (YouTube-style red line) */}
      {isCurrentlyPlaying && effectiveDuration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] z-10 pointer-events-none bg-white/20">
          <div
            className="h-full bg-rose-500"
            style={{ width: `${progressPercent}%`, transition: 'width 0.25s linear' }}
          />
        </div>
      )}

      {/* Large Centre Play Button when Paused and not previewing */}
      {!isCurrentlyPlaying && !isBuffering && !isPreviewPlaying && (
        <div
          onClick={togglePlayPause}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 backdrop-blur-[1px] cursor-pointer group-hover/player:bg-black/25 transition-all"
        >
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-red-600/90 hover:bg-red-600 active:scale-95 text-white flex items-center justify-center shadow-2xl ring-4 ring-white/30 backdrop-blur-md transition-all">
            <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-white ml-1" />
          </div>
        </div>
      )}

      {/* 5-Second Promo Preview Badge */}
      {isPreviewPlaying && !isCurrentlyPlaying && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2 pointer-events-none animate-fade-in">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-rose-500/40 text-white shadow-xl">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-[11px] font-bold tracking-wider uppercase font-mono text-rose-400">
              Promo • {Math.min(5, Math.floor(currentTime) + 1)}s/5s
            </span>
          </div>
          <span className="text-[10px] font-semibold text-white/95 bg-black/70 px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/10 hidden sm:inline">
            Tap to watch full video with sound
          </span>
        </div>
      )}

      {/* Top Gradient Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'
          }`}
      />

      {/* Top Floating Badge (Reels link & Duration) */}
      <div
        className={`absolute top-3 left-3 right-3 z-20 flex items-center justify-between text-white transition-opacity duration-300 pointer-events-auto ${showControls ? 'opacity-100' : 'opacity-0'
          }`}
      >
        {post.audioTrack && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white text-[11px] font-medium shadow mr-2 max-w-[160px] truncate">
            <Music className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{post.audioTrack.title}</span>
          </div>
        )}
        {onOpenReels && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReels();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold shadow transition-all active:scale-95"
            title="Watch in immersive vertical Reels mode"
          >
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span>Shorts View</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/90 border border-white/10">
            {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Bottom Controls Bar (YouTube/Instagram Frosted Glass) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          resetControlsTimer();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          resetControlsTimer();
        }}
        className={`absolute bottom-0 left-0 right-0 z-20 pt-8 pb-2.5 px-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Scrubber Timeline */}
        <div
          ref={progressBarRef}
          onMouseDown={handleScrubStart}
          onTouchStart={(e) => {
            // FIX: stop propagation so a scrubber drag does not bubble up
            // to the container's onTouchStart and trigger a fake mouseenter.
            e.stopPropagation();
            handleScrubStart(e);
          }}
          onMouseMove={handleScrubberMouseMove}
          onMouseLeave={handleScrubberMouseLeave}
          className="group/scrub relative w-full py-2.5 -my-1 cursor-pointer flex items-center select-none"
        >
          {/* YouTube Floating Scrubber Preview Tooltip */}
          {isHoveringScrubber && hoverPercent !== null && hoverTime !== null && hoverPositionPx !== null && (
            <div
              className="absolute bottom-6 -translate-x-1/2 pointer-events-none flex flex-col items-center z-40 transition-transform duration-75"
              style={{
                left: `${Math.max(54, Math.min((progressBarRef.current?.clientWidth || 300) - 54, hoverPositionPx))}px`
              }}
            >
              <div className="bg-slate-900/95 border border-white/20 rounded-xl p-1 shadow-2xl backdrop-blur-md flex flex-col items-center">
                <div className="w-28 h-16 bg-black rounded-lg overflow-hidden relative border border-white/10 mb-1 flex items-center justify-center">
                  <video
                    ref={previewVideoRef}
                    src={post.mediaUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                </div>
                <span className="text-[10px] font-mono font-bold text-white px-2 py-0.5 rounded-full bg-black/70 border border-white/10">
                  {formatTime(hoverTime)}
                </span>
              </div>
              <div className="w-2 h-2 bg-slate-900 border-r border-b border-white/20 transform rotate-45 -mt-1" />
            </div>
          )}

          {/* Visual Track */}
          <div className="relative w-full h-1.5 group-hover/scrub:h-2.5 bg-white/25 group-hover/scrub:bg-white/35 rounded-full transition-all overflow-visible">
            {isHoveringScrubber && hoverPercent !== null && (
              <div
                className="absolute top-0 bottom-0 left-0 bg-white/30 rounded-full pointer-events-none"
                style={{ width: `${hoverPercent}%` }}
              />
            )}
            <div
              className="h-full bg-rose-500 rounded-full relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/scrub:scale-100 transition-transform -mr-1.5 ring-2 ring-rose-500/50" />
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white gap-2 mt-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Rewind 10s */}
            <button
              type="button"
              onClick={(e) => handleSkip(-10, e)}
              className="p-1.5 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition-colors relative flex items-center justify-center active:scale-95"
              title="Rewind 10 seconds (← or J)"
            >
              <RotateCcw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="absolute text-[8px] font-bold font-mono tracking-tighter">10</span>
            </button>

            {/* Play / Pause Button */}
            <button
              type="button"
              onClick={togglePlayPause}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors active:scale-95"
              title={isCurrentlyPlaying ? 'Pause (space or K)' : 'Play (space or K)'}
            >
              {isCurrentlyPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white ml-0.5" />
              )}
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={(e) => handleSkip(10, e)}
              className="p-1.5 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition-colors relative flex items-center justify-center active:scale-95"
              title="Forward 10 seconds (→ or L)"
            >
              <RotateCw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="absolute text-[8px] font-bold font-mono tracking-tighter">10</span>
            </button>

            {/* Volume & Mute */}
            <div className="flex items-center gap-1.5 group/vol ml-1">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-16 h-1 accent-rose-500 bg-white/30 rounded-lg cursor-pointer hidden group-hover/vol:inline-block transition-all"
                title="Volume"
              />
            </div>

            {/* Time Indicator */}
            <div className="text-[11px] sm:text-xs font-mono tabular-nums text-white/80 select-none ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/40">/</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Playback Speed */}
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-white/15 hover:bg-white/25 text-white/90 transition-colors"
              title="Change Playback Speed"
            >
              {playbackRate}x
            </button>

            {/* Picture-in-Picture */}
            <button
              type="button"
              onClick={togglePiP}
              className="p-1.5 sm:p-2 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition-all active:scale-95"
              title="Picture in Picture (P)"
            >
              <PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-full hover:bg-white/20 text-white transition-all active:scale-95"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              ) : (
                <Maximize className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
