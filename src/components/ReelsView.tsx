import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Post, EligibilityResult } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  MapPin,
  Globe,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Info,
  ArrowLeft,
  Music,
  Send,
  X,
  Plus,
  Maximize,
  Minimize,
  Bell
} from 'lucide-react';
import { EligibilityExplainerModal } from './EligibilityExplainerModal.tsx';

interface ReelsViewProps {
  reels: { reel: Post; eligibility: EligibilityResult }[];
  initialIndex?: number;
  onOpenCreate: () => void;
  onClose: () => void;
}

export const ReelsView: React.FC<ReelsViewProps> = ({
  reels,
  initialIndex = 0,
  onOpenCreate,
  onClose
}) => {
  const { viewerLocation } = useLocation();

  const [currentIndex, setCurrentIndex] = useState(
    initialIndex >= 0 && initialIndex < reels.length ? initialIndex : 0
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [likedReels, setLikedReels] = useState<Record<string, boolean>>({});
  const [savedReels, setSavedReels] = useState<Record<string, boolean>>({});
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({ creator_arjun: true });
  const [showShareToast, setShowShareToast] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});
  const [doubleTapHeart, setDoubleTapHeart] = useState<{ id: string; x: number; y: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      const activeFs = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(activeFs === stageRef.current);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!stageRef.current) return;
    const isFs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (!isFs) {
      if (stageRef.current.requestFullscreen) {
        stageRef.current.requestFullscreen().catch(() => {});
      } else if ((stageRef.current as any).webkitRequestFullscreen) {
        (stageRef.current as any).webkitRequestFullscreen();
      } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
        (videoRef.current as any).webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || !videoRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Comments state per reel
  const [commentsMap, setCommentsMap] = useState<Record<string, { author: string; text: string; time: string }[]>>({
    post_kurnool_dance_worldwide: [
      { author: 'Suresh Kumar', text: 'Konda Reddy Fort dance moves are next level! 🔥', time: '2h ago' },
      { author: 'Ananya Sharma', text: 'Watching from Mumbai! Rayalaseema folk beats are incredible.', time: '5h ago' }
    ],
    post_hyderabad_tech_comedy_worldwide: [
      { author: 'Rahul Varma', text: 'This happens in our Hitec City sprint demo every Monday 😂', time: '1h ago' },
      { author: 'David M.', text: 'Global relatable dev humor right here from London!', time: '3h ago' }
    ],
    post_mumbai_streetfood_worldwide: [
      { author: 'Priya Reddy', text: 'Craving Pav Bhaji now! Amazing cinematography.', time: '4h ago' }
    ]
  });
  const [newCommentInput, setNewCommentInput] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const lastWheelTime = useRef<number>(0);
  const lastTapTime = useRef<number>(0);

  const activeReelData = reels[currentIndex];
  const activeReel = activeReelData?.reel;
  const activeEligibility = activeReelData?.eligibility;

  // Auto-play / reset on index change
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setIsPlaying(true);
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Browser autoplay restriction, fallback to muted play
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => setIsPlaying(false));
          }
        });
      }
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, reels.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCommentsDrawer) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm') {
        e.preventDefault();
        setIsMuted(prev => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showCommentsDrawer) {
          setShowCommentsDrawer(false);
        } else if (showAuditModal) {
          setShowAuditModal(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, showCommentsDrawer, showAuditModal, onClose]);

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaTime = Date.now() - touchStartTime.current;
    touchStartY.current = null;

    // Fast flick or standard drag distance threshold
    const isQuickFlick = deltaTime < 300 && Math.abs(deltaY) > 30;
    const isLongDrag = Math.abs(deltaY) > 60;

    if (isQuickFlick || isLongDrag) {
      if (deltaY < 0) {
        handleNext(); // Swiped Up -> Next Reel
      } else {
        handlePrev(); // Swiped Down -> Previous Reel
      }
    }
  };

  // Mouse wheel debounce on desktop
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 400) return; // Debounce 400ms

    if (e.deltaY > 35) {
      lastWheelTime.current = now;
      handleNext();
    } else if (e.deltaY < -35) {
      lastWheelTime.current = now;
      handlePrev();
    }
  };

  // Single / Double tap detection on video
  const handleVideoTap = (e: React.MouseEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;

    if (timeSinceLastTap < 300 && activeReel) {
      // Double tap -> Like with animated heart
      setLikedReels(prev => ({ ...prev, [activeReel.id]: true }));
      const rect = e.currentTarget.getBoundingClientRect();
      setDoubleTapHeart({
        id: activeReel.id,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setTimeout(() => setDoubleTapHeart(null), 800);
      lastTapTime.current = 0;
    } else {
      // Single tap -> Toggle Play/Pause after slight delay to detect double tap
      lastTapTime.current = now;
      setTimeout(() => {
        if (Date.now() - lastTapTime.current >= 280) {
          togglePlayPause();
        }
      }, 300);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleLike = (id: string) => {
    setLikedReels(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSave = (id: string) => {
    setSavedReels(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFollow = (creatorId: string) => {
    setFollowingMap(prev => ({ ...prev, [creatorId]: !prev[creatorId] }));
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 2500);
  };

  const handleAddComment = () => {
    if (!newCommentInput.trim() || !activeReel) return;
    const newComment = {
      author: 'You (LocalNet Viewer)',
      text: newCommentInput.trim(),
      time: 'Just now'
    };
    setCommentsMap(prev => ({
      ...prev,
      [activeReel.id]: [newComment, ...(prev[activeReel.id] || [])]
    }));
    setNewCommentInput('');
  };

  if (!activeReel) {
    return (
      <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-black text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Globe className="w-12 h-12 text-slate-400" />
        <h3 className="text-base sm:text-lg font-bold">
          No vertical reels eligible for {viewerLocation.cityName}
        </h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Reels respect creator-selected radius boundaries. Switch to Kurnool or Hyderabad to discover local creator reels!
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs mt-2"
        >
          Return to Feed
        </button>
      </div>
    );
  }

  const isWorldwide = activeReel.audienceDistribution.scope === 'worldwide';
  const isLiked = likedReels[activeReel.id] ?? activeReel.hasLiked;
  const isSaved = savedReels[activeReel.id] ?? activeReel.hasSaved;
  const isFollowing = followingMap[activeReel.creatorId];
  const activeComments = commentsMap[activeReel.id] || [];

  const hasVideoError = videoErrors[activeReel.id] || !activeReel.mediaUrl || activeReel.mediaUrl.endsWith('.jpg') || activeReel.mediaUrl.endsWith('.png');

  return (
    <div
      className="fixed inset-0 z-50 w-full h-[100dvh] bg-black text-white flex items-center justify-center overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Immersive 9:16 Video Stage (Edge-to-Edge on mobile, centered on desktop) */}
      <div ref={stageRef} className="relative w-full h-full max-w-[500px] md:mx-auto flex items-center justify-center bg-black overflow-hidden shadow-2xl">
        
        {/* Active Video Player or Audio Visualizer */}
        {!hasVideoError ? (
          <video
            ref={videoRef}
            src={activeReel.mediaUrl}
            poster={activeReel.mediaThumbnail || undefined}
            preload="metadata"
            loop
            playsInline
            muted={isMuted}
            onClick={handleVideoTap}
            onError={() => setVideoErrors(prev => ({ ...prev, [activeReel.id]: true }))}
            onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
            onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
            className="w-full h-full object-cover cursor-pointer"
          />
        ) : (
          <div
            onClick={handleVideoTap}
            className={`w-full h-full bg-gradient-to-br ${activeReel.mediaGradient || 'from-amber-700 via-rose-800 to-indigo-950'} flex flex-col items-center justify-center p-6 text-center text-white relative cursor-pointer`}
          >
            {/* Animated Audio Visualizer Waves */}
            <div className="flex items-end gap-1.5 h-16 mb-6">
              <span className="w-2 bg-white/70 rounded-full animate-bounce [animation-delay:0.1s] h-10" />
              <span className="w-2 bg-white/90 rounded-full animate-bounce [animation-delay:0.3s] h-16" />
              <span className="w-2 bg-white/60 rounded-full animate-bounce [animation-delay:0.2s] h-8" />
              <span className="w-2 bg-white/90 rounded-full animate-bounce [animation-delay:0.4s] h-14" />
              <span className="w-2 bg-white/70 rounded-full animate-bounce [animation-delay:0.15s] h-11" />
            </div>
            <p className="font-extrabold text-base px-4 drop-shadow">{activeReel.title}</p>
            <span className="text-xs text-white/80 mt-1.5 font-medium">{activeReel.creatorHandle}</span>
          </div>
        )}

        {/* Double-tap popping heart animation */}
        {doubleTapHeart && (
          <div
            className="absolute pointer-events-none z-30 animate-ping duration-500"
            style={{ left: doubleTapHeart.x - 32, top: doubleTapHeart.y - 32 }}
          >
            <Heart className="w-16 h-16 fill-rose-500 text-rose-500 drop-shadow-2xl" />
          </div>
        )}

        {/* Paused Indicator Overlay */}
        {!isPlaying && (
          <div
            onClick={togglePlayPause}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer"
          >
            <div className="p-4 rounded-full bg-white/20 backdrop-blur-md text-white shadow-2xl scale-110 transition-transform">
              <Play className="w-10 h-10 ml-1 fill-white" />
            </div>
          </div>
        )}

        {/* Floating Top Navigation Header */}
        <div className="absolute top-0 left-0 right-0 z-30 pt-safe px-3 sm:px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto gap-2">
          
          {/* Back Button */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md text-white border border-white/20 transition-all shadow-md active:scale-95 text-xs font-bold"
            aria-label="Back to Home Feed"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden min-[360px]:inline">Feed</span>
          </button>

          {/* Organic Distribution Reach Pill */}
          <button
            onClick={() => setShowAuditModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md border shadow-md truncate max-w-[55%] ${
              isWorldwide
                ? 'bg-indigo-950/80 text-indigo-200 border-indigo-400/40'
                : 'bg-emerald-950/80 text-emerald-200 border-emerald-400/40'
            }`}
          >
            {isWorldwide ? <Globe className="w-3.5 h-3.5 shrink-0 text-indigo-300" /> : <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-300" />}
            <span className="truncate">
              {isWorldwide ? 'Worldwide' : `${activeReel.audienceDistribution.scope} Local`}
            </span>
            <Info className="w-3 h-3 opacity-70 shrink-0 ml-0.5" />
          </button>

          {/* Sound Mute/Unmute & Viewer Location Pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className="p-2 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 transition-all shadow-md active:scale-95"
              aria-label={isMuted ? "Unmute audio" : "Mute audio"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 transition-all shadow-md active:scale-95"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 text-white" />
              ) : (
                <Maximize className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Right Action Rail (Vertical Thumb-Zone Friendly) */}
        <div className="absolute right-2 sm:right-3 bottom-20 z-30 flex flex-col items-center gap-3.5 text-white">
          
          {/* Creator Avatar with follow + */}
          <div className="relative mb-1">
            <img
              src={activeReel.creatorAvatar}
              alt={activeReel.creatorName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-white shadow-xl"
            />
            {!isFollowing && (
              <button
                onClick={() => toggleFollow(activeReel.creatorId)}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center text-[10px] font-black shadow-md hover:scale-110 active:scale-95 transition-transform"
                title="Follow Creator"
              >
                +
              </button>
            )}
          </div>

          {/* Like */}
          <button
            onClick={() => toggleLike(activeReel.id)}
            className="flex flex-col items-center gap-0.5 group active:scale-90 transition-transform"
            aria-label="Like reel"
          >
            <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md group-hover:bg-black/60 border border-white/10 transition-colors">
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-white'}`} />
            </div>
            <span className="text-[10px] font-mono tabular-nums font-semibold drop-shadow">
              {(activeReel.stats.likes + (isLiked ? 1 : 0)).toLocaleString()}
            </span>
          </button>

          {/* Comments */}
          <button
            onClick={() => setShowCommentsDrawer(true)}
            className="flex flex-col items-center gap-0.5 group active:scale-90 transition-transform"
            aria-label="Open comments"
          >
            <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md group-hover:bg-black/60 border border-white/10 transition-colors">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-mono tabular-nums font-semibold drop-shadow">
              {activeComments.length}
            </span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-0.5 group active:scale-90 transition-transform"
            aria-label="Share reel"
          >
            <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md group-hover:bg-black/60 border border-white/10 transition-colors">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-semibold drop-shadow">Share</span>
          </button>

          {/* Save */}
          <button
            onClick={() => toggleSave(activeReel.id)}
            className="flex flex-col items-center gap-0.5 group active:scale-90 transition-transform"
            aria-label="Bookmark reel"
          >
            <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md group-hover:bg-black/60 border border-white/10 transition-colors">
              <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
            </div>
            <span className="text-[10px] font-semibold drop-shadow">Save</span>
          </button>

          {/* Create Shortcut */}
          <button
            onClick={onOpenCreate}
            className="flex flex-col items-center gap-0.5 group active:scale-90 transition-transform"
            aria-label="Create reel"
          >
            <div className="p-2.5 rounded-full bg-amber-500 text-slate-950 font-black shadow-lg">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-bold text-amber-400 drop-shadow">Create</span>
          </button>
        </div>

        {/* Bottom Information Scrim */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pb-safe px-4 pt-16 pb-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent text-white space-y-2 pointer-events-none pr-16">
          
          {/* Creator Line */}
          <div className="flex items-center gap-1.5 pointer-events-auto truncate">
            <span className="font-bold text-sm drop-shadow truncate">
              {activeReel.creatorName}
            </span>
            {activeReel.creatorVerified && (
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-white/60 text-xs">·</span>
            <span className="text-xs text-white/80 font-medium truncate">
              {activeReel.publishingLocation.cityName}
            </span>
          </div>

          {/* Caption */}
          <p className="text-xs text-white/95 leading-relaxed line-clamp-2 drop-shadow pointer-events-auto">
            {activeReel.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-amber-300 font-medium pointer-events-auto">
            {activeReel.tags.slice(0, 4).map(t => (
              <span key={t}>#{t}</span>
            ))}
          </div>

          {/* Audio Track Indicator with Rotating Vinyl Disc */}
          <div className="flex items-center gap-2 pt-1 pointer-events-auto">
            <div className="flex items-center gap-1.5 text-[11px] text-white/80 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 max-w-[200px] truncate">
              <Music className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">Original Audio · {activeReel.creatorName}</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center animate-spin [animation-duration:4s]">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
          </div>
        </div>

        {/* Reels Scrubber Timeline Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="absolute bottom-0 left-0 right-0 z-30 h-1.5 hover:h-2.5 bg-white/20 hover:bg-white/40 cursor-pointer transition-all pointer-events-auto group/scrub"
        >
          <div
            className="h-full bg-rose-500 relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow scale-0 group-hover/scrub:scale-100 transition-transform" />
          </div>
        </div>

        {/* Desktop Up / Down Controls (Visible on md+ screens) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col gap-3">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-full bg-black/60 hover:bg-black/90 text-white disabled:opacity-20 transition-all backdrop-blur-md border border-white/20 shadow-xl active:scale-95"
            aria-label="Previous reel"
          >
            <ChevronUp className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === reels.length - 1}
            className="p-3 rounded-full bg-black/60 hover:bg-black/90 text-white disabled:opacity-20 transition-all backdrop-blur-md border border-white/20 shadow-xl active:scale-95"
            aria-label="Next reel"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* Swipe Hint Indicator on first video */}
        {currentIndex === 0 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 animate-bounce opacity-70">
            <ChevronUp className="w-4 h-4 text-white" />
            <span className="text-[10px] tracking-wider uppercase font-semibold text-white/80">Swipe up</span>
          </div>
        )}

      </div>

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl border border-slate-700 backdrop-blur-md animate-fade-in flex items-center gap-2">
          <span>Reel link copied to clipboard!</span>
        </div>
      )}

      {/* Interactive Comments Drawer */}
      {showCommentsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div
            onClick={() => setShowCommentsDrawer(false)}
            className="flex-1 cursor-pointer"
          />
          <div className="w-full max-w-[500px] mx-auto bg-slate-900 text-white rounded-t-3xl p-4 sm:p-5 shadow-2xl border-t border-slate-800 flex flex-col max-h-[70vh] animate-slide-up">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-amber-400" />
                Comments ({activeComments.length})
              </h3>
              <button
                onClick={() => setShowCommentsDrawer(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {activeComments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No comments yet. Be the first to share your thoughts!
                </div>
              ) : (
                activeComments.map((comment, i) => (
                  <div key={i} className="flex gap-2.5 text-xs">
                    <div className="w-7 h-7 rounded-full bg-amber-600/30 text-amber-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                      {comment.author[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{comment.author}</span>
                        <span className="text-[10px] text-slate-400">{comment.time}</span>
                      </div>
                      <p className="text-slate-200 mt-0.5 leading-snug">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Box */}
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={newCommentInput}
                onChange={e => setNewCommentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleAddComment}
                disabled={!newCommentInput.trim()}
                className="p-2 rounded-full bg-amber-500 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Engine A Eligibility Audit Explainer Modal */}
      <EligibilityExplainerModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        post={activeReel}
        eligibility={activeEligibility || null}
      />
    </div>
  );
};
