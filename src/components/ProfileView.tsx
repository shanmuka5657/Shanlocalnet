import React, { useState } from 'react';
import { Post, UserRole, SupportedLanguage } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
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
  Play
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

  const [activeTab, setActiveTab] = useState<'posts' | 'creator_studio' | 'roles' | 'admin_audit'>('posts');
  const [activeRole, setActiveRole] = useState<UserRole>('creator');

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  const t = (key: string) => getTranslation(language, key);

  const myPosts = posts.filter(p => p.creatorId === 'creator_arjun' || p.creatorId === 'current_user');

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
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
            alt="Arjun Rayalaseema"
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
                  Arjun Rayalaseema
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {t(`role${activeRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                @arjun_grooves · Publishing from {viewerLocation.cityName}
              </p>
            </div>

            <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
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
            Kurnool-based choreographer & cultural curator. Active creator with 98k+ worldwide reach, and local merchant empowering Rayalaseema weavers within 40 km.
          </p>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 min-[440px]:grid-cols-4 gap-2.5 sm:gap-4 pt-2 text-xs text-center sm:text-left border-t border-slate-100 dark:border-slate-800/80">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent sm:dark:bg-transparent">
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm block">
                24.5K
              </span>
              <span className="text-slate-500 text-[11px]">Followers</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent sm:dark:bg-transparent">
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm block">
                318
              </span>
              <span className="text-slate-500 text-[11px]">Following</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent sm:dark:bg-transparent">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm block">
                98.5K
              </span>
              <span className="text-slate-500 text-[11px]">Worldwide Organic</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent sm:dark:bg-transparent">
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-sm block">
                12.4K
              </span>
              <span className="text-slate-500 text-[11px]">40km Local</span>
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
                343.5K
              </p>
              <span className="text-[11px] text-emerald-500 font-semibold">+18.4% this month</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-400">Total Watch Time</span>
              <p className="text-2xl font-black font-mono mt-1 text-slate-900 dark:text-white">
                1,840h
              </p>
              <span className="text-[11px] text-slate-400">Avg 19.2s per reel</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-400">Audience Retention</span>
              <p className="text-2xl font-black font-mono mt-1 text-indigo-600 dark:text-indigo-400">
                82.4%
              </p>
              <span className="text-[11px] text-slate-400">High completion rate</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-400">Monetization Status</span>
              <p className="text-2xl font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                ACTIVE
              </p>
              <span className="text-[11px] text-emerald-500 font-semibold">Eligible for brand deals</span>
            </div>
          </div>

          {/* Geographical Reach Breakdown */}
          <div className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              Worldwide Reach Distribution Breakdown
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center font-medium">
                <span>India (Kurnool, Hyderabad, Mumbai, Delhi)</span>
                <span className="font-mono font-bold">78% (76,800 views)</span>
              </div>
              <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full w-[78%]" />
              </div>

              <div className="flex justify-between items-center font-medium pt-2">
                <span>United Kingdom & Europe</span>
                <span className="font-mono font-bold">14% (13,800 views)</span>
              </div>
              <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full w-[14%]" />
              </div>

              <div className="flex justify-between items-center font-medium pt-2">
                <span>United States & Americas</span>
                <span className="font-mono font-bold">8% (7,900 views)</span>
              </div>
              <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full w-[8%]" />
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
                    <span>Origin: <strong>{log.originCity}</strong> → Viewer: <strong>{log.viewerCity}</strong></span>
                    <span className="font-mono">Distance: {log.viewerDistanceKm} km</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                    Rule: <code className="font-mono text-amber-600 dark:text-amber-400">{log.ruleCode}</code> · {log.notes}
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
