import React, { useState } from 'react';
import { Post, AdCampaign, BusinessProfile, EligibilityResult } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import { MediaCardThumbnail } from './common/MediaCardThumbnail.tsx';
import {
  Compass,
  MapPin,
  TrendingUp,
  Store,
  Users,
  Search,
  Filter,
  ShieldCheck,
  Star,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface ExploreViewProps {
  posts: { post: Post; eligibility: EligibilityResult }[];
  ads: { ad: AdCampaign; eligibility: EligibilityResult }[];
  businesses: BusinessProfile[];
  onOpenLocationModal: () => void;
  onOpenCreate: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  posts,
  ads,
  businesses,
  onOpenLocationModal,
  onOpenCreate
}) => {
  const { viewerLocation, getDistanceTo } = useLocation();

  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(40);
  const [searchQuery, setSearchQuery] = useState('');
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  // Filter businesses by proximity and search
  const nearbyBusinesses = businesses
    .map(biz => {
      const distanceKm = getDistanceTo(biz.coordinates.latitude, biz.coordinates.longitude);
      return { biz, distanceKm };
    })
    .filter(item => {
      const inRadius = item.distanceKm <= selectedRadiusKm;
      const matchesSearch =
        item.biz.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.biz.category.toLowerCase().includes(searchQuery.toLowerCase());
      return inRadius && matchesSearch;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Filter local posts in this city or within selected radius
  const localPosts = posts
    .filter(p => {
      const distance = p.eligibility.distanceKm;
      return (
        distance <= selectedRadiusKm &&
        (p.post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.post.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
      );
    })
    .sort((a, b) => a.eligibility.distanceKm - b.eligibility.distanceKm);

  return (
    <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-3 sm:py-6 space-y-5 sm:space-y-8">

      {/* City Hero & Geospatial Radar */}
      <div className="w-full bg-gradient-to-br from-amber-600 via-amber-700 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center gap-2 text-amber-200 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin-slow" />
              <span>Geospatial Radar Discovery</span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Exploring {viewerLocation.cityName}
            </h1>

            <p className="text-xs sm:text-sm text-amber-100/80 max-w-lg leading-relaxed">
              Discover verified local businesses, trending community media, and nearby creators within your selected radius.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenLocationModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold bg-white text-slate-900 hover:bg-amber-50 rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>Change Location</span>
            </button>
          </div>
        </div>

        {/* Radius Filter Slider Bar */}
        <div className="mt-6 pt-4 sm:mt-8 sm:pt-6 border-t border-white/15 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-semibold text-white">Radius:</span>
            <span className="font-bold text-amber-300 font-mono tabular-nums">
              {selectedRadiusKm} km
            </span>
            <span className="text-[10px] text-amber-200/70 hidden min-[360px]:inline">
              (Commerce ≤ 40km)
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto">
            {[1, 5, 10, 20, 30, 40].map(r => (
              <button
                key={r}
                onClick={() => setSelectedRadiusKm(r)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${selectedRadiusKm === r
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
              >
                {r}km
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={`Search shops, topics in ${viewerLocation.cityName}...`}
          className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm"
        />
      </div>

      {/* Section 1: Nearby Verified Businesses */}
      <section className="w-full space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
              <Store className="w-4 h-4 text-amber-500" />
              Verified Businesses within {selectedRadiusKm} km
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Direct physical storefronts & licensed community merchants
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-slate-400">
            {nearbyBusinesses.length}
          </span>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {nearbyBusinesses.map(({ biz, distanceKm }) => (
            <div
              key={biz.id}
              className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 min-w-0"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1 truncate">
                      <span className="truncate">{biz.name}</span>
                      {biz.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {biz.category}
                    </p>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] sm:text-[11px] font-semibold font-mono tabular-nums shrink-0">
                    {distanceKm} km
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                  {biz.description}
                </p>

                <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1 text-amber-500 font-semibold shrink-0">
                    <Star className="w-3 h-3 fill-amber-500" />
                    <span>{biz.rating}</span>
                  </div>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{biz.address}</span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate max-w-[120px]">
                  {biz.phone}
                </span>
                <a
                  href={`tel:${biz.phone}`}
                  className="px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors shrink-0"
                >
                  Contact
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Trending Local Posts */}
      <section className="w-full space-y-3 sm:space-y-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Trending Local Media within {selectedRadiusKm} km
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            Community stories and reels filmed near your current location
          </p>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {localPosts.map(({ post, eligibility }) => (
            <div
              key={post.id}
              className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 shadow-sm flex gap-3 min-w-0"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-950 overflow-hidden shrink-0 relative">
                <MediaCardThumbnail
                  postId={post.id}
                  thumbnailUrl={post.mediaThumbnail}
                  mediaUrl={post.mediaUrl}
                  alt={post.title}
                  className="w-full h-full object-cover"
                  gradient={post.mediaGradient}
                />
                <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-mono">
                  {post.contentType.toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {post.creatorName}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                      {eligibility.distanceKm}km
                    </span>
                  </div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1 mt-0.5">
                    {post.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {post.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 truncate">
                  <span>{post.stats.likes} likes</span>
                  <span aria-hidden="true">·</span>
                  <span>{post.audienceDistribution.scope}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};
