import React, { useState } from 'react';
import { Post, AdCampaign, EligibilityResult, SupportedLanguage } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import { getTranslation } from '../lib/i18n.ts';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MapPin,
  Globe,
  Zap,
  Info,
  CheckCircle,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ExternalLink,
  Store,
  ShieldCheck,
  Sparkles,
  Users,
  Film,
  FileText
} from 'lucide-react';
import { EligibilityExplainerModal } from './EligibilityExplainerModal.tsx';

interface HomeFeedProps {
  posts: { post: Post; eligibility: EligibilityResult }[];
  ads: { ad: AdCampaign; eligibility: EligibilityResult }[];
  reels?: { reel: Post; eligibility: EligibilityResult }[];
  activeFeedTab: 'global' | 'around_me' | 'following';
  onChangeFeedTab: (tab: 'global' | 'around_me' | 'following') => void;
  onOpenCreate: () => void;
  onOpenLocationModal: () => void;
  onOpenReels: (index?: number) => void;
  language: SupportedLanguage;
}

export const HomeFeed: React.FC<HomeFeedProps> = ({
  posts,
  ads,
  reels = [],
  activeFeedTab,
  onChangeFeedTab,
  onOpenCreate,
  onOpenLocationModal,
  onOpenReels,
  language
}) => {
  const { viewerLocation } = useLocation();

  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [followingCreators, setFollowingCreators] = useState<Record<string, boolean>>({
    creator_arjun: true
  });

  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  const [activeAudit, setActiveAudit] = useState<{
    post?: Post | null;
    ad?: AdCampaign | null;
    eligibility: EligibilityResult | null;
  } | null>(null);

  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, string[]>>({
    post_kurnool_dance_worldwide: [
      'Proud of Kurnool! Amazing moves at the fort 🔥',
      'Watching this all the way from London! Love the beats.'
    ],
    post_hyderabad_tech_comedy_worldwide: [
      'Literally had this happen in today sprint demo 😂',
      'Relatable for every engineer in Hitec City and beyond'
    ]
  });
  const [newCommentText, setNewCommentText] = useState('');
  const [showShareToast, setShowShareToast] = useState<string | null>(null);

  const t = (key: string) => getTranslation(language, key);

  const toggleLike = (postId: string) => {
    setLikedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleSave = (postId: string) => {
    setSavedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleFollow = (creatorId: string) => {
    setFollowingCreators(prev => ({ ...prev, [creatorId]: !prev[creatorId] }));
  };

  const handleShare = (title: string) => {
    navigator.clipboard?.writeText(window.location.href);
    setShowShareToast(`Link copied for "${title}"`);
    setTimeout(() => setShowShareToast(null), 3000);
  };

  const handleAddComment = (postId: string) => {
    if (!newCommentText.trim()) return;
    setPostComments(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newCommentText.trim()]
    }));
    setNewCommentText('');
  };

  // Build combined stream with ads injected into the feed
  const combinedFeed: Array<{
    type: 'post' | 'ad';
    item: Post | AdCampaign;
    eligibility: EligibilityResult;
  }> = [];

  let adIndex = 0;
  posts.forEach((p, idx) => {
    combinedFeed.push({ type: 'post', item: p.post, eligibility: p.eligibility });
    if ((idx + 1) % 2 === 0 && adIndex < ads.length && activeFeedTab !== 'following') {
      combinedFeed.push({
        type: 'ad',
        item: ads[adIndex].ad,
        eligibility: ads[adIndex].eligibility
      });
      adIndex++;
    }
  });

  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6">

      {/* Prominent Feed / Reels / Around Me / Following Bar (Responsive on 320px, 360px, 390px, 412px & Desktop) */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-1 sm:p-1.5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-4 gap-1 w-full">
          {/* 1. Global / For You Feed */}
          <button
            onClick={() => onChangeFeedTab('global')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-[10px] min-[360px]:text-xs font-bold rounded-xl transition-all ${activeFeedTab === 'global'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('feedGlobal')}</span>
          </button>

          {/* 2. Full-Screen Vertical Reels (Always Accessible on all mobile widths) */}
          <button
            onClick={() => onOpenReels(0)}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-[10px] min-[360px]:text-xs font-bold rounded-xl transition-all bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm hover:brightness-110 active:scale-95"
            aria-label="Open Fullscreen Reels"
          >
            <Film className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span className="truncate">Reels</span>
          </button>

          {/* 3. Around Me (Hyperlocal <= 40km) */}
          <button
            onClick={() => onChangeFeedTab('around_me')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-[10px] min-[360px]:text-xs font-bold rounded-xl transition-all ${activeFeedTab === 'around_me'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('feedAroundMe')}</span>
          </button>

          {/* 4. Following */}
          <button
            onClick={() => onChangeFeedTab('following')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-[10px] min-[360px]:text-xs font-bold rounded-xl transition-all ${activeFeedTab === 'following'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('feedFollowing')}</span>
          </button>
        </div>
      </div>

      {/* YouTube Shorts / Instagram Reels Horizontal Shelf */}
      {reels && reels.length > 0 && (
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Shorts & Vertical Reels
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-black tracking-wider">
                    SWIPE
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500">
                  Global entertainment • Tap any video to launch full screen
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenReels(0)}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
            >
              Watch All →
            </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
            {reels.map((item, idx) => (
              <div
                key={item.reel.id}
                onClick={() => onOpenReels(idx)}
                className="group relative flex-shrink-0 w-28 sm:w-32 aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 cursor-pointer snap-start shadow-md hover:scale-[1.02] active:scale-95 transition-all"
              >
                {/* Media Preview */}
                {item.reel.mediaUrl && !item.reel.mediaUrl.endsWith('.jpg') ? (
                  <video
                    src={item.reel.mediaUrl}
                    muted
                    playsInline
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${item.reel.mediaGradient || 'from-rose-600 to-indigo-900'} flex items-center justify-center p-2 text-center`} />
                )}

                {/* Dark Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30 p-2 flex flex-col justify-between" />

                {/* Reach Badge */}
                <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-center text-[9px] font-bold text-white">
                  <span className="px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 text-amber-400" />
                    {item.reel.audienceDistribution.scope === 'worldwide'
                      ? 'Global'
                      : (item.reel.audienceDistribution.maxRadiusKm ? `${item.reel.audienceDistribution.maxRadiusKm}km` : item.reel.audienceDistribution.scope)}
                  </span>
                </div>

                {/* Bottom Title & Creator */}
                <div className="absolute bottom-2 left-2 right-2 text-white">
                  <p className="text-[11px] font-bold line-clamp-2 leading-tight drop-shadow">
                    {item.reel.title}
                  </p>
                  <p className="text-[9px] text-white/70 mt-0.5 truncate">
                    {item.reel.creatorName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed Context Kicker */}
      <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 px-1 gap-2">
        <span className="truncate">
          {activeFeedTab === 'global' && '🌍 Worldwide organic entertainment'}
          {activeFeedTab === 'around_me' && `📍 Hyperlocal discovery in ${viewerLocation.cityName} (≤ 40km)`}
          {activeFeedTab === 'following' && '👥 Updates from accounts you follow'}
        </span>
        <button
          onClick={onOpenLocationModal}
          className="font-semibold text-amber-600 dark:text-amber-400 hover:underline shrink-0"
        >
          {viewerLocation.cityName}
        </button>
      </div>

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg border border-slate-700 animate-fade-in flex items-center gap-2 max-w-[90vw] truncate">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{showShareToast}</span>
        </div>
      )}

      {/* Feed Stream */}
      <div className="w-full space-y-4 sm:space-y-6">
        {combinedFeed.map(entry => {
          if (entry.type === 'post') {
            const post = entry.item as Post;
            const eligibility = entry.eligibility;
            const isLiked = likedPosts[post.id] ?? post.hasLiked;
            const isSaved = savedPosts[post.id] ?? post.hasSaved;
            const isFollowing = followingCreators[post.creatorId];
            const isWorldwide = post.audienceDistribution.scope === 'worldwide';
            const commentsList = postComments[post.id] || [];

            return (
              <article
                key={post.id}
                className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* Header: Responsive creator info & action tags */}
                <div className="p-3 sm:p-4 flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img
                      src={post.creatorAvatar}
                      alt={post.creatorName}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 truncate">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {post.creatorName}
                        </span>
                        {post.creatorVerified && (
                          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                        <span className="truncate">{post.creatorHandle}</span>
                        <span aria-hidden="true">·</span>
                        <span className="shrink-0">{post.publishingLocation.cityName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleFollow(post.creatorId)}
                      className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors ${isFollowing
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>

                    <button
                      onClick={() => setActiveAudit({ post, eligibility, ad: null })}
                      className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-lg transition-colors border ${isWorldwide
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                          : 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      title="Inspect geographical distribution audit"
                    >
                      {isWorldwide ? <Globe className="w-3 h-3 shrink-0" /> : <MapPin className="w-3 h-3 shrink-0" />}
                      <span className="hidden min-[360px]:inline">{isWorldwide ? 'Worldwide' : `${post.audienceDistribution.scope}`}</span>
                      <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-60 ml-0.5 shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Media Container: Full width, responsive aspect ratio */}
                <div className="w-full relative aspect-[4/3] bg-slate-950 overflow-hidden flex items-center justify-center">
                  {(post.contentType === 'reel' || post.contentType === 'video') ? (
                    post.mediaUrl && !videoErrors[post.id] ? (
                      <div className="w-full h-full relative group">
                        <video
                          src={post.mediaUrl}
                          loop
                          muted={isMuted}
                          playsInline
                          autoPlay={playingVideoId === post.id}
                          className="w-full h-full object-cover"
                          onError={() => setVideoErrors(prev => ({ ...prev, [post.id]: true }))}
                          onPlay={() => setPlayingVideoId(post.id)}
                          onPause={() => {
                            if (playingVideoId === post.id) setPlayingVideoId(null);
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white pointer-events-auto">
                          <button
                            onClick={() => {
                              const v = document.querySelector(`video[src="${post.mediaUrl}"]`) as HTMLVideoElement;
                              if (v) {
                                if (v.paused) {
                                  v.play().catch(() => setVideoErrors(prev => ({ ...prev, [post.id]: true })));
                                  setPlayingVideoId(post.id);
                                } else {
                                  v.pause();
                                  setPlayingVideoId(null);
                                }
                              }
                            }}
                            className="p-1.5 sm:p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md transition-colors"
                          >
                            {playingVideoId === post.id ? (
                              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                            ) : (
                              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white ml-0.5" />
                            )}
                          </button>

                          <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="p-1.5 sm:p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md transition-colors"
                          >
                            {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${post.mediaGradient || 'from-amber-600 via-rose-700 to-indigo-950'} flex flex-col items-center justify-center p-4 text-center text-white relative`}>
                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 animate-pulse">
                          <Play className="w-6 h-6 text-white ml-0.5" />
                        </div>
                        <p className="font-bold text-xs sm:text-sm line-clamp-1 max-w-xs">{post.title}</p>
                        <span className="text-[10px] text-white/70 mt-0.5">{post.creatorName}</span>
                      </div>
                    )
                  ) : post.mediaUrl ? (
                    <img
                      src={post.mediaUrl}
                      alt={post.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center text-white relative">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-3">
                        <FileText className="w-6 h-6 text-amber-400" />
                      </div>
                      <p className="font-bold text-sm sm:text-base max-w-sm line-clamp-2">{post.title}</p>
                      <p className="text-xs text-slate-300 mt-2 max-w-xs line-clamp-3 leading-relaxed">{post.description}</p>
                    </div>
                  )}

                  {post.commercialMetadata?.isPaidPromotion && (
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-black/75 backdrop-blur-md text-amber-300 text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 border border-amber-400/30">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Paid Promotion · Capped at 40 km</span>
                    </div>
                  )}
                </div>

                {/* Engagement Bar */}
                <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`flex items-center gap-1 text-xs font-semibold transition-colors ${isLiked ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isLiked ? 'fill-rose-600' : ''}`} />
                        <span className="font-mono tabular-nums">
                          {(post.stats.likes + (isLiked ? 1 : 0)).toLocaleString()}
                        </span>
                      </button>

                      <button
                        onClick={() =>
                          setOpenCommentsPostId(openCommentsPostId === post.id ? null : post.id)
                        }
                        className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="font-mono tabular-nums">
                          {(post.stats.comments + commentsList.length).toLocaleString()}
                        </span>
                      </button>

                      <button
                        onClick={() => handleShare(post.title)}
                        className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>

                    <button
                      onClick={() => toggleSave(post.id)}
                      className={`transition-colors ${isSaved ? 'text-amber-500' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                      <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${isSaved ? 'fill-amber-500' : ''}`} />
                    </button>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                      {post.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                    {post.tags.map(tag => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>

                  {openCommentsPostId === post.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Comments ({commentsList.length})
                      </h4>

                      <div className="space-y-2 max-h-36 overflow-y-auto text-xs">
                        {commentsList.map((c, i) => (
                          <div key={i} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                            <span className="font-semibold text-slate-900 dark:text-white mr-1.5">
                              Local Viewer:
                            </span>
                            <span className="text-slate-700 dark:text-slate-300">{c}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newCommentText}
                          onChange={e => setNewCommentText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddComment(post.id)}
                          placeholder="Add a comment..."
                          className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors shrink-0"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          } else {
            // Commercial Local Advertisement Card (Engine B)
            const ad = entry.item as AdCampaign;
            const eligibility = entry.eligibility;

            return (
              <article
                key={ad.id}
                className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border-2 border-amber-300/80 dark:border-amber-900/60 shadow-md overflow-hidden relative"
              >
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 px-3 sm:px-4 py-2 border-b border-amber-200/60 dark:border-amber-900/50 flex items-center justify-between gap-1 text-[11px] sm:text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 truncate">
                    <Store className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Sponsored Local Commerce</span>
                  </div>

                  <button
                    onClick={() => setActiveAudit({ post: null, ad, eligibility })}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] sm:text-[10px] uppercase tracking-wide hover:bg-amber-400 transition-colors shrink-0"
                    title="Audit Commercial 40km Distribution Rule"
                  >
                    <span>≤ 40km ({ad.selectedRadiusKm}km)</span>
                    <Info className="w-2.5 h-2.5" />
                  </button>
                </div>

                <div className="p-3 sm:p-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-sm shrink-0">
                      {ad.businessName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 truncate">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {ad.businessName}
                        </span>
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                        <span>{ad.businessCategory}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{ad.targetCity} ({eligibility.distanceKm}km away)</span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={ad.ctaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-sm shrink-0"
                  >
                    <span>{ad.callToAction.replace('_', ' ')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="w-full relative aspect-[16/9] bg-gradient-to-br from-amber-700 via-rose-800 to-stone-950 p-4 sm:p-6 flex flex-col justify-end text-white overflow-hidden">
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                  <div className="relative z-10 space-y-1">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-300">
                      Hyperlocal Special · {ad.targetCity}
                    </span>
                    <h3 className="text-base sm:text-xl font-black text-white leading-tight">
                      {ad.headline}
                    </h3>
                  </div>
                </div>

                <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {ad.bodyText}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] sm:text-xs text-slate-500 gap-2">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Within {ad.selectedRadiusKm}km verified radius</span>
                    </span>

                    <button
                      onClick={() => setActiveAudit({ post: null, ad, eligibility })}
                      className="text-amber-600 dark:text-amber-400 font-medium hover:underline shrink-0"
                    >
                      Why eligible?
                    </button>
                  </div>
                </div>
              </article>
            );
          }
        })}

        {combinedFeed.length === 0 && (
          <div className="w-full text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <Globe className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 mx-auto" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              No eligible content for selected feed tab
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Switch to Global or change your city to discover active content.
            </p>
          </div>
        )}
      </div>

      <EligibilityExplainerModal
        isOpen={Boolean(activeAudit)}
        onClose={() => setActiveAudit(null)}
        post={activeAudit?.post}
        ad={activeAudit?.ad}
        eligibility={activeAudit?.eligibility || null}
      />

    </div>
  );
};
