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
}

export const FeedVideoPlayer: React.FC<FeedVideoPlayerProps> = ({
  post,
  isCurrentlyPlaying,
  onPlayRequest,
  onPauseRequest,
  onOpenReels,
  onDoubleTapLike,
  isLiked
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  const lastTapRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Global listener to ensure strictly ONE video plays at any time across the entire app
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
      setIsPreviewPlaying(false);
      isPreviewRef.current = false;
      if (videoRef.current.paused) {
        // Pause all other video elements on the page immediately
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

  // YouTube-style: Auto-play 5-second muted promo preview ONLY for the single most visible video
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isCurrentlyPlaying) {
          // Check if any video is already playing before auto-previewing
          const anyPlaying = Array.from(document.querySelectorAll('video')).some(
            (v) => v !== videoRef.current && !v.paused
          );
          if (anyPlaying) return;

          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.currentTime = 0;
            // Notify all other players to pause
            window.dispatchEvent(new CustomEvent('localnet:video-play', { detail: { id: post.id } }));
            videoRef.current
              .play()
              .then(() => {
                setIsPreviewPlaying(true);
                isPreviewRef.current = true;
              })
              .catch(() => {});
          }
        } else if (!entry.isIntersecting && isPreviewRef.current) {
          // Scrolled off screen -> pause preview and reset
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
          setIsPreviewPlaying(false);
          isPreviewRef.current = false;
        }
      },
      { threshold: 0.75 }
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

  // Controls auto-hide timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isCurrentlyPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
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

    // YouTube 5-second promo preview loop
    if (isPreviewRef.current && cur >= 5.0) {
      videoRef.current.currentTime = 0;
    }

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
    // If no poster is present, seek to 0.5s so Chrome/Safari renders the video screen instead of an empty black box
    if (!post.mediaThumbnail && !isCurrentlyPlaying && videoRef.current.currentTime === 0) {
      try {
        videoRef.current.currentTime = 0.5;
      } catch {}
    }
  };

  // Play / Pause toggle
  const togglePlayPause = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('light');
    if (!videoRef.current) return;

    if (isPreviewPlaying || isPreviewRef.current) {
      // Tap on promo preview -> immediately start full video with unmuted audio!
      setIsPreviewPlaying(false);
      isPreviewRef.current = false;
      onPlayRequest();
      videoRef.current.muted = false;
      setIsMuted(false);
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

  // Picture-in-Picture toggle (YouTube Style)
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
        containerRef.current.requestFullscreen().catch(() => {});
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
        (videoRef.current as any).webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
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

  // Video Stage Click: handles Single Tap (play/pause) & Double Tap (Rewind, Forward, or Like)
  const handleStageClick = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickWidth = rect.width;
    const xRatio = clickX / clickWidth;

    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    lastTapRef.current = now;

    if (timeDiff < 320) {
      // Double tap detected! Cancel pending single tap
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      if (xRatio < 0.35) {
        // Double tap left side -> Rewind 10s (YouTube Style)
        handleSkip(-10);
      } else if (xRatio > 0.65) {
        // Double tap right side -> Forward 10s (YouTube Style)
        handleSkip(10);
      } else {
        // Double tap center -> Instagram Like Heart Animation
        if (onDoubleTapLike) {
          triggerHaptic('doubleTap');
          const y = e.clientY - rect.top;
          setDoubleTapHeart({ x: clickX, y });
          setTimeout(() => setDoubleTapHeart(null), 800);
          onDoubleTapLike();
        }
      }
    } else {
      // Single tap: queue play/pause
      singleTapTimeoutRef.current = setTimeout(() => {
        togglePlayPause();
      }, 280);
    }
    resetControlsTimer();
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

  // Playback rate cycle (1x -> 1.25x -> 1.5x -> 2x)
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

  if (hasError || !post.mediaUrl) {
    return (
      <div
        onClick={() => {
          setHasError(false);
          onPlayRequest();
        }}
        className={`w-full h-full aspect-[4/3] bg-gradient-to-br ${
          post.mediaGradient || 'from-amber-600 via-rose-700 to-indigo-950'
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
      onMouseMove={resetControlsTimer}
      onMouseEnter={() => {
        setShowControls(true);
        if (!isCurrentlyPlaying && videoRef.current && videoRef.current.paused) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.currentTime = 0;
          videoRef.current.play().then(() => {
            setIsPreviewPlaying(true);
            isPreviewRef.current = true;
          }).catch(() => {});
        }
      }}
      onMouseLeave={() => {
        if (isCurrentlyPlaying) {
          setShowControls(false);
        } else if (isPreviewPlaying || isPreviewRef.current) {
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
          setIsPreviewPlaying(false);
          isPreviewRef.current = false;
        }
      }}
      className={`group/player relative w-full bg-black overflow-hidden select-none outline-none ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen flex items-center justify-center'
          : 'aspect-[4/3] max-h-[560px] rounded-b-none'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        id={`feed-video-${post.id}`}
        src={post.mediaThumbnail ? post.mediaUrl : `${post.mediaUrl}#t=0.5`}
        poster={post.mediaThumbnail || undefined}
        onPlay={() => {
          document.querySelectorAll('video').forEach((v) => {
            if (v !== videoRef.current && !v.paused) {
              v.pause();
            }
          });
          window.dispatchEvent(new CustomEvent('localnet:video-play', { detail: { id: post.id } }));
          onPlayRequest();
        }}
        loop
        muted={isMuted}
        playsInline
        preload={isCurrentlyPlaying ? 'auto' : (post.mediaThumbnail ? 'none' : 'metadata')}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => setHasError(true)}
        onClick={handleStageClick}
        className={`w-full h-full cursor-pointer ${
          isFullscreen ? 'max-h-screen object-contain' : 'object-cover'
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

      {/* Buffering Indicator */}
      {isBuffering && isCurrentlyPlaying && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/20 backdrop-blur-xs">
          <div className="p-3 rounded-full bg-black/60 backdrop-blur-md">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Large Center Play Button when Paused */}
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

      {/* 5-Second Promo Preview Badge (YouTube Style) */}
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
        className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Top Floating Badge (Reels link & Duration) */}
      <div
        className={`absolute top-3 left-3 right-3 z-20 flex items-center justify-between text-white transition-opacity duration-300 pointer-events-auto ${
          showControls ? 'opacity-100' : 'opacity-0'
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
        className={`absolute bottom-0 left-0 right-0 z-20 pt-8 pb-2.5 px-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber Timeline with Expanded Touch/Click Target (30px tall touch zone) */}
        <div
          ref={progressBarRef}
          onMouseDown={handleScrubStart}
          onTouchStart={handleScrubStart}
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
            {/* Ghost hover progress bar */}
            {isHoveringScrubber && hoverPercent !== null && (
              <div
                className="absolute top-0 bottom-0 left-0 bg-white/30 rounded-full pointer-events-none"
                style={{ width: `${hoverPercent}%` }}
              />
            )}
            {/* Progress Filled */}
            <div
              className="h-full bg-rose-500 rounded-full relative"
              style={{ width: `${progressPercent}%` }}
            >
              {/* Scrubber Thumb */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/scrub:scale-100 transition-transform -mr-1.5 ring-2 ring-rose-500/50" />
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white gap-2 mt-1">
          {/* Left Controls: Rewind 10s, Play/Pause, Forward 10s, Volume, Time */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Rewind 10s Button */}
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

            {/* Forward 10s Button */}
            <button
              type="button"
              onClick={(e) => handleSkip(10, e)}
              className="p-1.5 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition-colors relative flex items-center justify-center active:scale-95"
              title="Forward 10 seconds (→ or L)"
            >
              <RotateCw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="absolute text-[8px] font-bold font-mono tracking-tighter">10</span>
            </button>

            {/* Volume & Mute with Hover Slider */}
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

          {/* Right Controls: Playback Speed, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Playback Speed Pill */}
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-white/15 hover:bg-white/25 text-white/90 transition-colors"
              title="Change Playback Speed"
            >
              {playbackRate}x
            </button>

            {/* Picture-in-Picture Button */}
            <button
              type="button"
              onClick={togglePiP}
              className="p-1.5 sm:p-2 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition-all active:scale-95"
              title="Picture in Picture (P)"
            >
              <PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>

            {/* Fullscreen Button */}
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
