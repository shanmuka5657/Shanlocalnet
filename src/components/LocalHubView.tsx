import React, { useState } from 'react';
import {
  MarketplaceListing,
  BusinessProfile,
  CommunityGroup,
  JobListing,
  LocalServiceProvider,
  LocalEvent,
  CartItem,
  OrderRecord,
  SupportedLanguage
} from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import { getTranslation } from '../lib/i18n.ts';
import {
  ShoppingBag,
  Store,
  Users,
  Briefcase,
  Wrench,
  Calendar,
  Percent,
  MapPin,
  ShieldCheck,
  Star,
  CheckCircle2,
  Phone,
  Truck,
  ShoppingCart,
  X,
  CreditCard
} from 'lucide-react';

interface LocalHubViewProps {
  marketplace: { item: MarketplaceListing; distanceKm: number; isWithinDeliveryRadius: boolean }[];
  businesses: BusinessProfile[];
  communities: CommunityGroup[];
  jobs: JobListing[];
  services: LocalServiceProvider[];
  events: LocalEvent[];
  language: SupportedLanguage;
  onOpenLocationModal: () => void;
  onRefreshData: () => void;
}

export type LocalHubModule =
  | 'marketplace'
  | 'businesses'
  | 'communities'
  | 'jobs'
  | 'services'
  | 'events'
  | 'offers';

export const LocalHubView: React.FC<LocalHubViewProps> = ({
  marketplace,
  businesses,
  communities,
  jobs,
  services,
  events,
  language,
  onOpenLocationModal,
  onRefreshData
}) => {
  const { viewerLocation, getDistanceTo } = useLocation();

  const [activeModule, setActiveModule] = useState<LocalHubModule>('marketplace');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<OrderRecord | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({
    comm_kurnool_city: true
  });
  const [appliedJobs, setAppliedJobs] = useState<Record<string, boolean>>({});
  const [registeredEvents, setRegisteredEvents] = useState<Record<string, boolean>>({});

  const [contactSubject, setContactSubject] = useState<{
    name: string;
    phone: string;
    type: 'business' | 'service';
  } | null>(null);

  const t = (key: string) => getTranslation(language, key);

  const addToCart = (listing: MarketplaceListing) => {
    setCart(prev => {
      const existing = prev.find(i => i.listing.id === listing.id);
      if (existing) {
        return prev.map(i =>
          i.listing.id === listing.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { listing, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (listingId: string) => {
    setCart(prev => prev.filter(i => i.listing.id !== listingId));
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.listing.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          deliveryCity: viewerLocation.cityName,
          deliveryAddress: 'Main Road, Kurnool (Verified 40km delivery radius)',
          coords: viewerLocation.coords
        })
      });

      const data = await res.json();
      if (res.ok) {
        setOrderSuccess(data.order);
        setCart([]);
      } else {
        alert(data.error || 'Failed to place order');
      }
    } catch (e: any) {
      alert(e.message || 'Checkout failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleJoinCommunity = async (commId: string) => {
    setJoinedCommunities(prev => ({ ...prev, [commId]: !prev[commId] }));
    await fetch('/api/communities/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityId: commId })
    });
  };

  const handleApplyJob = async (jobId: string) => {
    setAppliedJobs(prev => ({ ...prev, [jobId]: true }));
    await fetch('/api/jobs/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
  };

  const handleRegisterEvent = async (eventId: string) => {
    setRegisteredEvents(prev => ({ ...prev, [eventId]: true }));
    await fetch('/api/events/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
  };

  const modules = [
    { id: 'marketplace', label: t('marketplace'), icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'businesses', label: t('businesses'), icon: <Store className="w-4 h-4" /> },
    { id: 'communities', label: t('communities'), icon: <Users className="w-4 h-4" /> },
    { id: 'jobs', label: t('jobs'), icon: <Briefcase className="w-4 h-4" /> },
    { id: 'services', label: t('services'), icon: <Wrench className="w-4 h-4" /> },
    { id: 'events', label: t('events'), icon: <Calendar className="w-4 h-4" /> },
    { id: 'offers', label: t('offers'), icon: <Percent className="w-4 h-4" /> }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-2.5 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6">
      
      {/* Ecosystem Header Card */}
      <div className="w-full bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-1.5 text-amber-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
            <Store className="w-3.5 h-3.5" />
            <span>Local Digital Ecosystem · Kurnool Launch</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {t('localHubTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-amber-100/80 max-w-xl leading-relaxed">
            {t('localHubSubtitle')} <span className="font-bold underline text-white">{viewerLocation.cityName}</span>. Connect with verified shops, artisans, services, and neighborhood communities within 40 km.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0">
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-bold"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{t('cart')}</span>
            {cart.length > 0 && (
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-amber-400 text-slate-950 rounded-full flex items-center justify-center text-[10px] font-black">
                {cart.length}
              </span>
            )}
          </button>

          <button
            onClick={onOpenLocationModal}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-2 text-xs font-bold bg-white text-slate-900 hover:bg-amber-50 rounded-xl transition-all shadow-sm shrink-0"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-600" />
            <span className="truncate max-w-[100px]">{viewerLocation.cityName}</span>
          </button>
        </div>
      </div>

      {/* Module Selector Segmented Navigation Bar */}
      <div className="w-full flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto no-scrollbar shadow-inner">
        {modules.map(mod => {
          const isActive = activeModule === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id as LocalHubModule)}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {mod.icon}
              <span>{mod.label}</span>
            </button>
          );
        })}
      </div>

      {/* MODULE 1: MARKETPLACE */}
      {activeModule === 'marketplace' && (
        <div className="w-full space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                Kurnool Artisans & Local Marketplace
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Direct weaver prices, stone-ground organic spices, and cookware.
              </p>
            </div>
            <span className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              <span>≤ 40km Local Delivery</span>
            </span>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {marketplace.map(({ item, distanceKm, isWithinDeliveryRadius }) => (
              <div
                key={item.id}
                className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-w-0"
              >
                <div className={`h-32 sm:h-36 bg-gradient-to-br ${item.coverGradient} p-3.5 flex flex-col justify-between text-white relative`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-black/50 text-[10px] font-semibold truncate max-w-[70%]">
                      {item.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-slate-900 shrink-0">
                      {distanceKm} km
                    </span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black font-mono">
                    ₹{item.price.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                      <span className="flex items-center gap-1 truncate">
                        <span className="truncate">{item.sellerName}</span>
                        {item.sellerVerified && <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      </span>
                      <span className="shrink-0">⭐ {item.rating || 4.8}</span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      Delivery ≤ {item.maxDeliveryRadiusKm}km
                    </span>
                    <button
                      onClick={() => addToCart(item)}
                      disabled={!isWithinDeliveryRadius}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 ${
                        isWithinDeliveryRadius
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                      }`}
                    >
                      {isWithinDeliveryRadius ? '+ Add to Cart' : 'Out of 40km'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE 2: BUSINESSES */}
      {activeModule === 'businesses' && (
        <div className="w-full space-y-3 sm:space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-500" />
              Verified Businesses in {viewerLocation.cityName}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Verified storefronts, phone contacts, and operating hours.
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {businesses.map(biz => {
              const distanceKm = getDistanceTo(biz.coordinates.latitude, biz.coordinates.longitude);
              return (
                <div
                  key={biz.id}
                  className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-sm space-y-3 flex flex-col justify-between min-w-0"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1 truncate">
                          <span className="truncate">{biz.name}</span>
                          {biz.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {biz.category} · {biz.city}
                        </p>
                      </div>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {distanceKm} km
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                      {biz.description}
                    </p>

                    <div className="mt-2.5 text-[11px] text-slate-500 space-y-0.5">
                      <p className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span>{biz.rating} ({biz.reviewCount} reviews)</span>
                      </p>
                      <p className="truncate">{biz.address}</p>
                      <p className="text-slate-400 truncate">🕒 {biz.openingHours}</p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <a
                      href={`tel:${biz.phone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors truncate"
                    >
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[110px]">{biz.phone}</span>
                    </a>

                    <button
                      onClick={() => setContactSubject({ name: biz.name, phone: biz.phone, type: 'business' })}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm shrink-0"
                    >
                      Enquiry
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODULE 3: COMMUNITIES */}
      {activeModule === 'communities' && (
        <div className="w-full space-y-3 sm:space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-500" />
              Kurnool Neighborhood & Special Interest Communities
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Civic discussions, farmer crop advisories, foodie spots, and student networks.
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {communities.map(comm => {
              const isJoined = joinedCommunities[comm.id];
              return (
                <div
                  key={comm.id}
                  className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3 flex flex-col justify-between min-w-0"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          {comm.category}
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-0.5 truncate">
                          {comm.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Admin: {comm.adminName} · {comm.city}
                        </p>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                        {comm.membersCount.toLocaleString()} members
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed line-clamp-2">
                      {comm.description}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 truncate">
                      {comm.recentPostsCount} active discussions
                    </span>

                    <button
                      onClick={() => handleJoinCommunity(comm.id)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 ${
                        isJoined
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800'
                      }`}
                    >
                      {isJoined ? 'Joined ✓' : 'Join Group'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODULE 4: JOBS */}
      {activeModule === 'jobs' && (
        <div className="w-full space-y-3 sm:space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-blue-500" />
              Local Jobs & Employment in {viewerLocation.cityName}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Hospitality, agriculture coordination, retail, and local gig opportunities.
            </p>
          </div>

          <div className="w-full space-y-3">
            {jobs.map(job => {
              const hasApplied = appliedJobs[job.id];
              return (
                <div
                  key={job.id}
                  className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-2.5 min-w-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {job.title}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {job.companyName} · {job.city} · <span className="font-semibold text-slate-700 dark:text-slate-300">{job.jobType}</span>
                      </p>
                    </div>

                    <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {job.salaryRange}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {job.applicantsCount} applicants
                    </span>

                    <button
                      onClick={() => handleApplyJob(job.id)}
                      disabled={hasApplied}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 ${
                        hasApplied
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                      }`}
                    >
                      {hasApplied ? 'Applied ✓' : 'Apply Now'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODULE 5: SERVICES */}
      {activeModule === 'services' && (
        <div className="w-full space-y-3 sm:space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-amber-500" />
              Verified Local Service Providers (≤ 40km)
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Electricians, plumbers, and tutors operating within 40 km service limits.
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {services.map(srv => {
              const distanceKm = getDistanceTo(srv.coordinates.latitude, srv.coordinates.longitude);
              return (
                <div
                  key={srv.id}
                  className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-sm flex flex-col justify-between space-y-3 min-w-0"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1 truncate">
                          <span className="truncate">{srv.name}</span>
                          {srv.verified && <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {srv.serviceCategory} · {srv.city}
                        </p>
                      </div>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {distanceKm} km
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                      {srv.description}
                    </p>

                    <div className="mt-2.5 text-[11px] text-slate-500 space-y-0.5">
                      <p className="font-semibold text-amber-600 dark:text-amber-400">
                        ⭐ {srv.rating} ({srv.reviewCount} reviews) · {srv.experienceYears}y exp
                      </p>
                      <p className="font-mono text-slate-700 dark:text-slate-300">
                        {srv.hourlyRate}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <a
                      href={`tel:${srv.phone}`}
                      className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 hover:text-amber-600 flex items-center gap-1 truncate"
                    >
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[100px]">{srv.phone}</span>
                    </a>

                    <button
                      onClick={() => setContactSubject({ name: srv.name, phone: srv.phone, type: 'service' })}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl transition-colors shrink-0"
                    >
                      Book
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODULE 6: EVENTS */}
      {activeModule === 'events' && (
        <div className="w-full space-y-3 sm:space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-rose-500" />
              Local Events & Cultural Happenings in Kurnool
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Heritage walks, handloom silk expos, and community agricultural fairs.
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {events.map(evt => {
              const isRegistered = registeredEvents[evt.id];
              return (
                <div
                  key={evt.id}
                  className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between min-w-0"
                >
                  <div className={`h-32 sm:h-36 bg-gradient-to-br ${evt.coverGradient} p-4 flex flex-col justify-between text-white`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-black/50 text-[10px] font-bold uppercase truncate max-w-[70%]">
                        {evt.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white text-slate-900 text-xs font-bold font-mono shrink-0">
                        {evt.isFree ? 'FREE' : `₹${evt.price}`}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight line-clamp-2">
                      {evt.title}
                    </h3>
                  </div>

                  <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5 text-xs">
                      <p className="font-semibold text-amber-600 dark:text-amber-400">
                        📅 {evt.date} · 🕒 {evt.time}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-1">
                        📍 {evt.venue}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {evt.description}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {evt.registeredCount + (isRegistered ? 1 : 0)} attending
                      </span>

                      <button
                        onClick={() => handleRegisterEvent(evt.id)}
                        disabled={isRegistered}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 ${
                          isRegistered
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                        }`}
                      >
                        {isRegistered ? 'Registered ✓' : 'Register'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODULE 7: OFFERS */}
      {activeModule === 'offers' && (
        <div className="w-full space-y-3 sm:space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-rose-500" />
              Hyperlocal Deals & Verified Merchant Coupons
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Exclusive redeemable vouchers from stores within 40 km of {viewerLocation.cityName}.
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="w-full bg-gradient-to-br from-amber-500 to-rose-600 rounded-2xl sm:rounded-3xl p-5 text-white shadow-md space-y-2 min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-[9px] sm:text-[10px] font-bold uppercase">
                Weekend Food Deal · Kurnool Only
              </span>
              <h3 className="text-lg sm:text-xl font-black">
                Flat 20% OFF on Clay Pot Dum Biryani
              </h3>
              <p className="text-xs text-white/90">
                Royal Rayalaseema Ruchulu · Old Bus Stand Road. Show this coupon code at counter.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-xl bg-white text-slate-950 font-mono font-black text-xs sm:text-sm tracking-wider">
                  KURNOOL20
                </span>
                <span className="text-[11px] text-white/80">Valid till Sunday</span>
              </div>
            </div>

            <div className="w-full bg-gradient-to-br from-purple-700 to-indigo-900 rounded-2xl sm:rounded-3xl p-5 text-white shadow-md space-y-2 min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-[9px] sm:text-[10px] font-bold uppercase">
                Artisan Weaver Festival
              </span>
              <h3 className="text-lg sm:text-xl font-black">
                Buy 1 Gadwal Saree, Get Handloom Dupatta Free
              </h3>
              <p className="text-xs text-white/90">
                Rayalaseema Weavers Hub · Gandhi Bazaar Silk Street. Handcrafted by 120+ local family looms.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-xl bg-white text-slate-950 font-mono font-black text-xs sm:text-sm tracking-wider">
                  GADWALFREE
                </span>
                <span className="text-[11px] text-white/80">In-Store Only</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CART & CHECKOUT MODAL DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85dvh]">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                <span>LocalNet Cart (≤ 40 km Delivery)</span>
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {orderSuccess ? (
                <div className="text-center py-6 space-y-2.5">
                  <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500 mx-auto" />
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Order Placed Successfully!
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {orderSuccess.id}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Dispatched to verified local merchants in {orderSuccess.deliveryCity}. Arriving within 40 km delivery window.
                  </p>
                  <button
                    onClick={() => {
                      setOrderSuccess(null);
                      setIsCartOpen(false);
                    }}
                    className="mt-3 px-5 py-2 text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl"
                  >
                    Done
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <ShoppingBag className="w-10 h-10 mx-auto opacity-50" />
                  <p className="text-xs font-semibold">Your cart is currently empty.</p>
                  <p className="text-[11px]">Add handloom textiles, clay cookware, or organic farm spices!</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cart.map(item => (
                      <div
                        key={item.listing.id}
                        className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {item.listing.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            ₹{item.listing.price.toLocaleString()} × {item.quantity} · {item.listing.sellerName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            ₹{(item.listing.price * item.quantity).toLocaleString()}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.listing.id)}
                            className="text-rose-500 hover:text-rose-700 font-bold p-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                      <span>Total Amount:</span>
                      <span className="font-mono">₹{cartTotal.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-amber-800 dark:text-amber-300">
                      🚚 Verified delivery to: {viewerLocation.cityName} (Within 40 km limit)
                    </p>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={isCheckingOut}
                    className="w-full py-2.5 sm:py-3 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{isCheckingOut ? 'Confirming with Merchants...' : `Confirm Order (₹${cartTotal.toLocaleString()})`}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact / Enquiry Modal */}
      {contactSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              Connect with {contactSubject.name}
            </h3>
            <p className="text-xs text-slate-500">
              Verified Phone: <a href={`tel:${contactSubject.phone}`} className="font-mono font-bold text-amber-600 underline">{contactSubject.phone}</a>
            </p>
            <textarea
              rows={3}
              defaultValue={`Hi, I found your ${contactSubject.type} on LocalNet in ${viewerLocation.cityName} and would like more information.`}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setContactSubject(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('Message dispatched to business!');
                  setContactSubject(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-xl"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
