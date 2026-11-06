import React, { useState, useEffect } from 'react';
import { Post, UserRole, SupportedLanguage } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { MediaCardThumbnail } from './common/MediaCardThumbnail.tsx';
import { getTranslation } from '../lib/i18n.ts';
import {
  User,
  ShieldCheck,
  Globe,
  MapPin,
  Bookmark,
  Grid,
  Zap,
  TrendingUp,
  Settings,
  Sun,
  Moon,
  Sparkles,
  Briefcase,
  Store,
  Users,
  Wrench,
  Languages,
  CheckCircle2,
  BarChart3,
  ShieldAlert,
  Play,
  LogOut,
  LogIn
} from 'lucide-react';

interface ProfileViewProps {
  posts: Post[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLocationModal: () => void;
  language: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onOpenLab: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  posts,
  isDarkMode,
  onToggleDarkMode,
  onOpenLocationModal,
  language,
  onSelectLanguage,
  onOpenLab
}) => {
  const { viewerLocation } = useLocation();
  const { user, loginWithGoogle, logout, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'creator_studio' | 'roles' | 'admin_audit'>('posts');
  const [activeRole, setActiveRole] = useState<UserRole>('creator');

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  const savedPostsKey = user ? `localnet_saved_posts_${user.id}` : 'localnet_saved_posts_anonymous';

  const [savedPostIds, setSavedPostIds] = useState<Record<string, boolean>>(() => {
    try {
      const key = user ? `localnet_saved_posts_${user.id}` : 'localnet_saved_posts_anonymous';
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  // Re-load saved posts when user changes (login / logout)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(savedPostsKey);
      setSavedPostIds(raw ? JSON.parse(raw) : {});
    } catch { setSavedPostIds({}); }
  }, [savedPostsKey]);

  const t = (key: string) => getTranslation(language, key);

  // Only show posts created by the currently logged-in user — no fallback to demo IDs
  const myPosts = user ? posts.filter(p => p.creatorId === user.id) : [];
  const savedPostsList = posts.filter(p => savedPostIds[p.id]);

  // Dynamic Live Creator Analytics
  const totalViews = myPosts.reduce((acc, p) => acc + (p.stats?.views || (p as any).viewsCount || 0), 0);
  const totalLikes = myPosts.reduce((acc, p) => acc + (p.stats?.likes || (p as any).likesCount || 0), 0);
  const totalComments = myPosts.reduce((acc, p) => acc + (p.stats?.comments || (p as any).commentsCount || 0), 0);
  const totalDurationSecs = myPosts.reduce((acc, p) => acc + ((p.videoDurationSeconds || 15) * Math.max(1, p.stats?.views || 1)), 0);
  const watchHours = (totalDurationSecs / 3600).toFixed(1);
  const avgWatchSecs = myPosts.length > 0
    ? (myPosts.reduce((acc, p) => acc + (p.videoDurationSeconds || 15), 0) / myPosts.length).toFixed(1)
    : '15.0';

  const worldwidePosts = myPosts.filter(p => p.audienceDistribution?.scope === 'worldwide').length;
  const local40kmPosts = myPosts.filter(p => p.audienceDistribution?.scope === '40km').length;
  const hyperlocalPosts = myPosts.filter(p => p.audienceDistribution?.scope === '10km' || p.audienceDistribution?.scope === '5km').length;
  const totalScopedPosts = Math.max(1, myPosts.length);

  const worldwidePercent = myPosts.length > 0 ? Math.round((worldwidePosts / totalScopedPosts) * 100) : 70;
  const local40kmPercent = myPosts.length > 0 ? Math.round((local40kmPosts / totalScopedPosts) * 100) : 20;
  const hyperlocalPercent = Math.max(0, 100 - worldwidePercent - local40kmPercent);

  const rolesList: { role: UserRole; labelKey: string; icon: React.ReactNode; desc: string }[] = [
    { role: 'viewer', labelKey: 'roleViewer', icon: <User className="w-4 h-4" />, desc: 'Watch global entertainment, discover local deals, and order within 40 km.' },
    { role: 'creator', labelKey: 'roleCreator', icon: <Sparkles className="w-4 h-4 text-amber-500" />, desc: 'Publish organic reels with reach up to Worldwide. Monetize collaborations.' },
    { role: 'business_owner', labelKey: 'roleBusinessOwner', icon: <Briefcase className="w-4 h-4 text-blue-500" />, desc: 'Run geotargeted ads strictly capped at 40 km. View CPC/CPM analytics.' },
    { role: 'merchant', labelKey: 'roleMerchant', icon: <Store className="w-4 h-4 text-emerald-500" />, desc: 'Sell local handlooms, produce, and goods with delivery under 40 km.' },
    { role: 'service_provider', labelKey: 'roleServiceProvider', icon: <Wrench className="w-4 h-4 text-indigo-500" />, desc: 'Offer plumbing, electrical, or tutoring services within local service boundaries.' },
    { role: 'community_admin', labelKey: 'roleCommunityAdmin', icon: <Users className="w-4 h-4 text-rose-500" />, desc: 'Manage civic, agricultural, and neighborhood discussion forums.' }
  ];

  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch('/api/admin/audit-log');
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-5 sm:space-y-6 min-w-0">

      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
        <div className="relative shrink-0">
          <img
            src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"}
            alt={user?.name || "User Profile"}
            referrerPolicy="no-referrer"
            className="w-20 h-20 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-amber-500/20"
          />
          <span className="absolute bottom-1 right-1 p-1 bg-amber-500 text-slate-950 rounded-full shadow-md">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </span>
        </div>

        <div className="flex-1 text-center sm:text-left space-y-3 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {user?.name || "Arjun Rayalaseema"}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {user ? "Google Verified" : t(`role${activeRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {user ? `${user.handle} Â· ${user.email}` : `@arjun_grooves Â· Publishing from ${viewerLocation.cityName}`}
              </p>
            </div>

            <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0 flex-wrap">
              {user ? (
                <button
                  onClick={() => logout()}
                  disabled={authLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-300 rounded-xl transition-colors border border-rose-200 dark:border-rose-800"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => loginWithGoogle()}
                  disabled={authLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all shadow-sm active:scale-95"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}

              <button
                onClick={onOpenLocationModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate max-w-[120px]">{viewerLocation.cityName}</span>
              </button>

              <button
                onClick={onToggleDarkMode}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 max-w-xl leading-relaxed">
            {user ? (user.bio || "LocalNet verified creator. Discover 40 km verified local commerce and worldwide entertainment.") : "Kurnool-based choreographer & cultural curator. Active creator with 98k+ worldwide reach, and local merchant empowering Rayalaseema weavers within 40 km."}
          </p>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 min-[440px]:grid-cols-4 gap-2.5 sm:gap-4 pt-2 text-xs text-center sm:text-left border-t border-slate-100 dark:border-slate-800/80">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent sm:dark:bg-transparent">
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm block">
                {myPosts.length}
              </span>
              <span className="text-slate-500 text-[11px]">Published Shorts</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent sm:dark:bg-transparent">
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm block">
                {totalViews.toLocaleString()}
              </span>
              <span className="text-slate-500 text-[11px]">Total Views</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent sm:dark:bg-transparent">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm block">
                {totalLikes.toLocaleString()}
              </span>
              <span className="text-slate-500 text-[11px]">Total Likes</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent sm:dark:bg-transparent">
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-sm block">
                {totalComments.toLocaleString()}
              </span>
              <span className="text-slate-500 text-[11px]">Total Comments</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto no-scrollbar shadow-inner">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${activeTab === 'posts'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <Grid className="w-4 h-4" />
          <span>My Posts ({myPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('saved')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${activeTab === 'saved'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <Bookmark className="w-4 h-4 text-amber-500" />
          <span>Saved ({savedPostsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('creator_studio')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${activeTab === 'creator_studio'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-500" />
          <span>Creator Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${activeTab === 'roles'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <Settings className="w-4 h-4" />
          <span>Multi-Role Switcher</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('admin_audit');
            fetchAuditLogs();
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${activeTab === 'admin_audit'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <ShieldAlert className="w-4 h-4 text-indigo-500" />
          <span>Geo-Policy Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: POSTS */}
      {activeTab === 'posts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {myPosts.map(p => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm"
            >
              <div className="aspect-[4/3] bg-slate-950 relative">
                <MediaCardThumbnail
                  postId={p.id}
                  thumbnailUrl={p.mediaThumbnail}
                  mediaUrl={p.mediaUrl}
                  alt={p.title}
                  className="w-full h-full object-cover"
                  gradient={p.mediaGradient}
                />
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-mono">
                  {p.audienceDistribution.scope.toUpperCase()}
                </span>
              </div>
              <div className="p-3">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                  {p.title}
                </h4>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>{p.stats.likes.toLocaleString()} likes</span>
                  <span>{p.stats.views.toLocaleString()} views</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: SAVED BOOKMARKS */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500" />
                Saved Shorts & Community Media
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Videos, local offers, and reels you've bookmarked to watch later.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
              {savedPostsList.length} Saved
            </span>
          </div>

          {savedPostsList.length === 0 ? (
            <div className="w-full text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Bookmark className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Saved Shorts Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Tap the bookmark ribbon on any video on your home feed to save it here for fast re-watching!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savedPostsList.map(p => (
                <div
                  key={p.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div className="aspect-[9/16] relative bg-slate-950">
                    <MediaCardThumbnail
                      postId={p.id}
                      thumbnailUrl={p.mediaThumbnail || (p as any).thumbnailUrl}
                      mediaUrl={p.mediaUrl}
                      alt={p.title}
                      className="w-full h-full object-cover"
                      gradient={p.mediaGradient}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 p-3 flex flex-col justify-between">
                      <span className="self-end px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white font-mono">
                        {p.videoDurationSeconds ? `${p.videoDurationSeconds}s` : 'Short'}
                      </span>
                      <div>
                        <h4 className="text-white font-bold text-xs line-clamp-1">{p.title}</h4>
                        <p className="text-white/70 text-[10px] truncate">@{p.creatorHandle || (p as any).author?.handle || 'creator'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
                    <span>{p.stats?.likes || (p as any).likesCount || 0} likes</span>
                    <span>{p.stats?.views || (p as any).viewsCount || 0} views</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATOR STUDIO (SCREEN 13) */}
      {activeTab === 'creator_studio' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              Creator Studio & Organic Distribution Analytics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Performance breakdown across Engine A (Organic Global Reach) and local mandal viewer retention.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-400">Total Video Views</span>
              <p className="text-2xl font-black font-mono mt-1 text-slate-900 dark:text-white">
                {totalViews.toLocaleString()}
              </p>
              <span className="text-[11px] text-emerald-500 font-semibold">{myPosts.length} published shorts</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-400">Total Watch Time</span>
              <p className="text-2xl font-black font-mono mt-1 text-slate-900 dark:text-white">
                {watchHours}h
              </p>
              <span className="text-[11px] text-slate-400">Avg {avgWatchSecs}s per reel</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-400">Total Engagement</span>
              <p className="text-2xl font-black font-mono mt-1 text-indigo-600 dark:text-indigo-400">
                {(totalLikes + totalComments).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400">{totalLikes} likes · {totalComments} comments</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-400">Monetization Status</span>
              <p className="text-2xl font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                ACTIVE
              </p>
              <span className="text-[11px] text-emerald-500 font-semibold">Eligible for local offers</span>
            </div>
          </div>

          {/* Geographical Reach Breakdown */}
          <div className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              Audience Reach & Distribution Breakdown
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between items-center font-medium mb-1">
                  <span>Worldwide Organic Reach (Global Scope)</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300">{worldwidePercent}% ({worldwidePosts} shorts)</span>
                </div>
                <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${worldwidePercent}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center font-medium mb-1">
                  <span>Hyperlocal 40 km Reach (City & Surrounding Mandals)</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{local40kmPercent}% ({local40kmPosts} shorts)</span>
                </div>
                <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${local40kmPercent}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center font-medium mb-1">
                  <span>Neighborhood 10 km Commercial Proximity</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{hyperlocalPercent}% ({hyperlocalPosts} shorts)</span>
                </div>
                <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${hyperlocalPercent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-ROLE SWITCHER */}
      {activeTab === 'roles' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-500" />
              Unified Identity & Multi-Role Switching
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              One account powers all roles. A creator can sell handloom products as a merchant or run business campaigns without creating a second login.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {rolesList.map(item => {
              const isActive = activeRole === item.role;
              return (
                <div
                  key={item.role}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${isActive
                      ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 ring-1 ring-amber-500 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          {t(item.labelKey)}
                        </h3>
                      </div>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                          Active Role
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveRole(item.role)}
                    className={`w-full py-1.5 text-xs font-bold rounded-xl transition-colors ${isActive
                        ? 'bg-amber-600 text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500'
                      }`}
                  >
                    {isActive ? 'Current Active Identity' : 'Switch to this Role'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL & DECISION RECORDS */}
      {activeTab === 'admin_audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-500 shrink-0" />
                <span>Auditable Decision Records</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Every distribution evaluation produces an auditable record documenting Haversine distance, rule codes, and delivery status.
              </p>
            </div>
            <button
              onClick={onOpenLab}
              className="px-3 py-1.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 shrink-0 self-start sm:self-auto"
            >
              Open Test Suite
            </button>
          </div>

          <div className="space-y-3">
            {isLoadingAudit ? (
              <p className="text-xs text-slate-400">Loading audit trail...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400">
                No decisions recorded yet. Browse feed to generate live records.
              </p>
            ) : (
              auditLogs.slice(0, 10).map(log => (
                <div
                  key={log.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {log.engine}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${log.isDelivered ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                      {log.isDelivered ? 'DELIVERED' : 'BLOCKED'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600 dark:text-slate-300">
                    <span>Origin: <strong>{log.originCity}</strong> â†’ Viewer: <strong>{log.viewerCity}</strong></span>
                    <span className="font-mono">Distance: {log.viewerDistanceKm} km</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                    Rule: <code className="font-mono text-amber-600 dark:text-amber-400">{log.ruleCode}</code> Â· {log.notes}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};
