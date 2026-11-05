import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Mic,
  MicOff,
  X,
  ArrowLeft,
  Clock,
  TrendingUp,
  Play,
  Film,
  Store,
  User,
  Briefcase,
  MapPin,
  ShieldCheck,
  Phone,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { Post, BusinessProfile, ViewerLocation, SupportedLanguage } from '../../types/index.ts';
import { getTranslation } from '../../lib/i18n.ts';
import { calculateHaversineDistance } from '../../lib/geo.ts';
import { useVoiceSearch } from '../../hooks/useVoiceSearch.ts';

export type SearchCategoryTab = 'all' | 'videos' | 'nearby' | 'people' | 'jobs';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  reels: Post[];
  businesses: BusinessProfile[];
  viewerLocation: ViewerLocation;
  language: SupportedLanguage;
  onSelectPost: (post: Post) => void;
  onSelectReel: (reel: Post) => void;
  onSelectBusiness: (business: BusinessProfile) => void;
  onSelectCreator: (handle: string) => void;
}

const RECENT_SEARCHES_KEY = 'localnet_recent_searches';

const TRENDING_LOCAL_TOPICS = [
  { tag: '#KurnoolFood', label: 'Kurnool Food & Biryani', icon: '🍲' },
  { tag: '#RayalaseemaShorts', label: 'Rayalaseema Comedy', icon: '🎬' },
  { tag: '#KondaReddyFort', label: 'Konda Reddy Buruju', icon: '🏰' },
  { tag: '#PlumberServices', label: 'Plumbers & Electricians', icon: '🔧' },
  { tag: '#LocalJobs', label: 'Jobs in Kurnool', icon: '💼' },
  { tag: '#Tungabhadra', label: 'Tungabhadra River Views', icon: '🌊' }
];

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  posts,
  reels,
  businesses,
  viewerLocation,
  language,
  onSelectPost,
  onSelectReel,
  onSelectBusiness,
  onSelectCreator
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchCategoryTab>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [distanceFilterKm, setDistanceFilterKm] = useState<number>(40);
  const [serverResults, setServerResults] = useState<{
    posts?: Post[];
    businesses?: BusinessProfile[];
  } | null>(null);
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
      setServerResults(null);
    }
  }, [isOpen]);

  // Voice Search integration
  const handleVoiceTranscript = (transcript: string) => {
    setQuery(transcript);
    saveSearchQuery(transcript);
  };

  const { isListening, isSupported: isVoiceSupported, startListening, stopListening, error: voiceError } =
    useVoiceSearch({
      language,
      onTranscript: handleVoiceTranscript
    });

  const saveSearchQuery = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    try {
      const updated = [trimmed, ...recentSearches.filter(q => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const removeRecentSearch = (itemToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(q => q !== itemToRemove);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced server search to complement client-side index
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setServerResults(null);
      setIsSearchingServer(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const queryParams = new URLSearchParams({
          q: trimmed,
          type: activeTab,
          lat: String(viewerLocation.coords.latitude),
          lon: String(viewerLocation.coords.longitude),
          radiusKm: String(distanceFilterKm)
        });
        const res = await fetch(`/api/search?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setServerResults(data);
        }
      } catch (err) {
        // Fallback to client-side search seamlessly
      } finally {
        setIsSearchingServer(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, activeTab, distanceFilterKm, viewerLocation]);

  // Instant 0ms Client-Side Filtered Matching
  const filteredLocalResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return { matchedVideos: [], matchedBusinesses: [], matchedCreators: [] };
    }

    // Combine posts & reels and deduplicate
    const allVideos = [...posts, ...reels].filter((v, idx, arr) => arr.findIndex(item => item.id === v.id) === idx);

    // 1. Videos & Reels matching title, description, creator, or tags
    const matchedVideos = allVideos.filter(p => {
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchCreator = (p.creatorName || '').toLowerCase().includes(q) || (p.creatorHandle || '').toLowerCase().includes(q);
      const matchTag = (p.tags || []).some(t => t.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchCreator || matchTag;
    });

    // 2. Businesses matching name, category, or address (filtered strictly within distanceFilterKm)
    const matchedBusinesses = (businesses || [])
      .map(b => {
        const distKm = calculateHaversineDistance(
          viewerLocation.coords.latitude,
          viewerLocation.coords.longitude,
          b.coordinates.latitude,
          b.coordinates.longitude
        );
        return { ...b, distanceKm: Math.round(distKm * 10) / 10 };
      })
      .filter(b => {
        const matchName = (b.name || '').toLowerCase().includes(q);
        const matchCat = (b.category || '').toLowerCase().includes(q);
        const matchAddr = (b.address || '').toLowerCase().includes(q) || (b.city || '').toLowerCase().includes(q);
        const inRadius = b.distanceKm <= distanceFilterKm;
        return inRadius && (matchName || matchCat || matchAddr);
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    // 3. Unique Creators
    const creatorMap = new Map<string, { name: string; handle: string; avatar: string; verified: boolean; postCount: number }>();
    allVideos.forEach(p => {
      const key = (p.creatorHandle || p.creatorName || '').toLowerCase();
      if (!key) return;
      if (
        p.creatorName.toLowerCase().includes(q) ||
        p.creatorHandle.toLowerCase().includes(q)
      ) {
        if (!creatorMap.has(key)) {
          creatorMap.set(key, {
            name: p.creatorName,
            handle: p.creatorHandle,
            avatar: p.creatorAvatar,
            verified: p.creatorVerified,
            postCount: 1
          });
        } else {
          creatorMap.get(key)!.postCount += 1;
        }
      }
    });

    return {
      matchedVideos,
      matchedBusinesses,
      matchedCreators: Array.from(creatorMap.values())
    };
  }, [query, posts, reels, businesses, viewerLocation, distanceFilterKm]);

  if (!isOpen) return null;

  const totalResultsCount =
    filteredLocalResults.matchedVideos.length +
    filteredLocalResults.matchedBusinesses.length +
    filteredLocalResults.matchedCreators.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-xl text-white overflow-hidden animate-fade-in safe-area-top safe-area-bottom">

      {/* Top Header Bar with Search Input */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Back Button */}
          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Close Search"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Search Input Container */}
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 absolute left-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveSearchQuery(query);
                }
              }}
              placeholder={getTranslation(language, 'searchPlaceholder') || `Search in ${viewerLocation.cityName} & Global...`}
              className="w-full bg-slate-800/90 text-white placeholder-slate-400 text-sm sm:text-base rounded-2xl pl-10 pr-20 py-2.5 sm:py-3 border border-slate-700/80 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all shadow-inner"
            />

            {/* Clear Button (X) */}
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-10 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Voice Search Button */}
            {isVoiceSupported && (
              <button
                onClick={() => {
                  if (isListening) {
                    stopListening();
                  } else {
                    startListening();
                  }
                }}
                className={`absolute right-2.5 p-1.5 sm:p-2 rounded-xl transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/50'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700'
                }`}
                title={isListening ? 'Listening... tap to stop' : 'Voice Search (Telugu / Hindi / English)'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Listening Active Banner */}
        {isListening && (
          <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between animate-pulse">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Listening... Speak clearly in {language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English'}
            </span>
            <button
              onClick={stopListening}
              className="text-[11px] underline font-semibold text-amber-200"
            >
              Done
            </button>
          </div>
        )}

        {/* Voice Error Notification */}
        {voiceError && (
          <div className="mt-2 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span>{voiceError}</span>
          </div>
        )}

        {/* Category Filter Tabs */}
        {query.trim().length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 mt-3 overflow-x-auto no-scrollbar pb-1 text-xs sm:text-sm">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Results
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                activeTab === 'videos'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Reels & Videos</span>
            </button>
            <button
              onClick={() => setActiveTab('nearby')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                activeTab === 'nearby'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Shops (≤ 40km)</span>
            </button>
            <button
              onClick={() => setActiveTab('people')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                activeTab === 'people'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Creators</span>
            </button>
          </div>
        )}

        {/* Hyperlocal Distance Sub-filter (when on nearby or all) */}
        {query.trim().length > 0 && (activeTab === 'nearby' || activeTab === 'all') && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-400">
              <SlidersHorizontal className="w-3 h-3 text-amber-500" />
              Radius:
            </span>
            {[5, 10, 25, 40].map(r => (
              <button
                key={r}
                onClick={() => setDistanceFilterKm(r)}
                className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
                  distanceFilterKm === r
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ≤ {r} km
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 max-w-4xl mx-auto w-full">

        {/* VIEW A: Empty Query State (Recent Searches + Local Trending Topics) */}
        {!query.trim() && (
          <div className="space-y-6">

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Recent Searches
                  </span>
                  <button
                    onClick={clearAllRecent}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(item);
                        saveSearchQuery(item);
                      }}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-xs sm:text-sm text-slate-300 hover:text-white transition-all border border-slate-700/50"
                    >
                      <span>{item}</span>
                      <span
                        onClick={(e) => removeRecentSearch(item, e)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded-full"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending in Kurnool & Rayalaseema */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Trending in {viewerLocation.cityName} & Nearby
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TRENDING_LOCAL_TOPICS.map((topic, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(topic.tag.replace('#', ''));
                      saveSearchQuery(topic.tag);
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-left border border-slate-800 hover:border-amber-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{topic.icon}</span>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                          {topic.tag}
                        </div>
                        <div className="text-[11px] text-slate-400">{topic.label}</div>
                      </div>
                    </div>
                    <span className="text-xs text-amber-500/80 group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Proximity Discover Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-800/60 to-slate-800/40 border border-amber-500/20 text-xs text-slate-300 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                Search instantly connects you to creators, viral videos worldwide, and local shops within <strong>{distanceFilterKm} km</strong> of {viewerLocation.cityName}.
              </span>
            </div>
          </div>
        )}

        {/* VIEW B: Search Query Active with Results */}
        {query.trim() && (
          <div className="space-y-6">

            {/* Empty Results Case */}
            {totalResultsCount === 0 && !isSearchingServer && (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                  <Search className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white">No results found for "{query}"</h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                  Try checking your spelling, using broader keywords, or exploring trending topics in {viewerLocation.cityName}.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => setDistanceFilterKm(40)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 font-semibold"
                  >
                    Expand to 40 km
                  </button>
                  <button
                    onClick={() => setQuery('')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold"
                  >
                    Clear Search
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 1: Videos & Reels */}
            {(activeTab === 'all' || activeTab === 'videos') && filteredLocalResults.matchedVideos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-amber-500" />
                    Videos & Reels ({filteredLocalResults.matchedVideos.length})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredLocalResults.matchedVideos.map((video) => (
                    <div
                      key={video.id}
                      onClick={() => {
                        saveSearchQuery(query);
                        onClose();
                        if (video.contentType === 'reel' || video.contentType === 'video') {
                          onSelectReel(video);
                        } else {
                          onSelectPost(video);
                        }
                      }}
                      className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-800 border border-slate-800 hover:border-amber-500/50 cursor-pointer shadow-md transition-all hover:-translate-y-0.5"
                    >
                      {/* Video Thumbnail or Gradient */}
                      {video.mediaThumbnail ? (
                        <img
                          src={video.mediaThumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            background: video.mediaGradient || 'linear-gradient(135deg, #1e293b, #0f172a)'
                          }}
                        >
                          <Play className="w-8 h-8 text-white/50" />
                        </div>
                      )}

                      {/* Scrim overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/60 backdrop-blur-md text-amber-400 border border-white/10 uppercase">
                          {video.audienceDistribution.scope}
                        </span>
                        {video.videoDurationSeconds && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-black/60 backdrop-blur-md text-white">
                            {Math.floor(video.videoDurationSeconds / 60)}:
                            {String(Math.floor(video.videoDurationSeconds % 60)).padStart(2, '0')}
                          </span>
                        )}
                      </div>

                      {/* Bottom Info */}
                      <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
                        <p className="text-xs font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
                          {video.title}
                        </p>
                        <p className="text-[11px] text-slate-300 truncate mt-1 flex items-center gap-1">
                          <span>{video.creatorName}</span>
                          {video.creatorVerified && (
                            <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0 inline" />
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 2: Local Businesses & Services (≤ 40km) */}
            {(activeTab === 'all' || activeTab === 'nearby') && filteredLocalResults.matchedBusinesses.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-amber-500" />
                    Local Businesses & Services ({filteredLocalResults.matchedBusinesses.length})
                  </span>
                  <span className="text-[11px] text-amber-400 font-semibold">
                    Strictly ≤ {distanceFilterKm} km
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredLocalResults.matchedBusinesses.map((biz: any) => (
                    <div
                      key={biz.id}
                      onClick={() => {
                        saveSearchQuery(query);
                        onClose();
                        onSelectBusiness(biz);
                      }}
                      className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/40 transition-all cursor-pointer shadow-sm group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                              {biz.name}
                            </h4>
                            <span className="text-[11px] font-semibold text-slate-400">
                              {biz.category}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                            {biz.distanceKm} km away
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 mt-2 line-clamp-2">
                          {biz.description || biz.address}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="truncate">{biz.city || 'Kurnool'}</span>
                        </span>
                        {biz.phone && (
                          <a
                            href={`tel:${biz.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 3: Creators & Handles */}
            {(activeTab === 'all' || activeTab === 'people') && filteredLocalResults.matchedCreators.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-500" />
                    Creators & Profiles ({filteredLocalResults.matchedCreators.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredLocalResults.matchedCreators.map((creator, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        saveSearchQuery(query);
                        onClose();
                        onSelectCreator(creator.handle);
                      }}
                      className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-amber-500/40 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={creator.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={creator.name}
                          className="w-10 h-10 rounded-full object-cover border border-amber-500/40"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate flex items-center gap-1">
                            <span>{creator.name}</span>
                            {creator.verified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0 inline" />
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono truncate">
                            {creator.handle}
                          </div>
                        </div>
                      </div>
                      <button className="px-3 py-1 rounded-xl bg-slate-700 hover:bg-amber-600 text-white font-bold text-xs transition-colors shrink-0">
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
};
