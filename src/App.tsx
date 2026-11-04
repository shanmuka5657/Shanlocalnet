/**
 * LocalNet Main Application Entry
 * Global Entertainment. Local Commerce.
 * Launch Market: Kurnool, Andhra Pradesh, India
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LocationProvider, useLocation } from './context/LocationContext.tsx';
import { TopNavigation, MainNavigationTab } from './components/TopNavigation.tsx';
import { BottomNavBar } from './components/BottomNavBar.tsx';
import { HomeFeed } from './components/HomeFeed.tsx';
import { ReelsView } from './components/ReelsView.tsx';
import { ExploreView } from './components/ExploreView.tsx';
import { LocalHubView } from './components/LocalHubView.tsx';
import { BusinessAdHub } from './components/BusinessAdHub.tsx';
import { DistributionEngineLab } from './components/DistributionEngineLab.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { LocationModal } from './components/LocationModal.tsx';
import { CreateModal } from './components/CreateModal.tsx';
import { NotificationsModal } from './components/NotificationsModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import {
  INITIAL_POSTS,
  INITIAL_AD_CAMPAIGNS,
  INITIAL_BUSINESSES,
  INITIAL_MARKETPLACE,
  INITIAL_COMMUNITIES,
  INITIAL_JOBS,
  INITIAL_SERVICES,
  INITIAL_EVENTS,
  INITIAL_NOTIFICATIONS
} from './lib/mockData.ts';
import {
  evaluateOrganicEligibility,
  evaluateCommercialEligibility,
  calculateHaversineDistance
} from './lib/geo.ts';
import { getStoredUserPosts, saveStoredUserPost } from './lib/engagementStorage.ts';
import {
  Post,
  AdCampaign,
  BusinessProfile,
  MarketplaceListing,
  CommunityGroup,
  JobListing,
  LocalServiceProvider,
  LocalEvent,
  NotificationItem,
  EligibilityResult,
  SupportedLanguage
} from './types/index.ts';

function LocalNetContent() {
  const { viewerLocation } = useLocation();

  // Navigation state (5 primary destinations)
  const [currentTab, setCurrentTab] = useState<MainNavigationTab>('home');
  const [activeFeedTab, setActiveFeedTab] = useState<'global' | 'around_me' | 'following'>('global');
  const [isFullScreenReelsOpen, setIsFullScreenReelsOpen] = useState(false);
  const [selectedReelIndex, setSelectedReelIndex] = useState(0);

  // Modals state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Pause any playing videos when switching navigation tabs
  useEffect(() => {
    document.querySelectorAll('video').forEach((v) => {
      if (!v.paused) v.pause();
    });
  }, [currentTab]);

  // Language state (en, te, hi)
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    try {
      return (localStorage.getItem('localnet_lang') as SupportedLanguage) || 'en';
    } catch {
      return 'en';
    }
  });

  const handleSelectLanguage = (lang: SupportedLanguage) => {
    setLanguage(lang);
    localStorage.setItem('localnet_lang', lang);
  };

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('localnet_theme') === 'dark' ||
        (!('localnet_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('localnet_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('localnet_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // Ecosystem Data
  const [feedPosts, setFeedPosts] = useState<{ post: Post; eligibility: EligibilityResult }[]>([]);
  const [feedAds, setFeedAds] = useState<{ ad: AdCampaign; eligibility: EligibilityResult }[]>([]);
  const [reelsList, setReelsList] = useState<{ reel: Post; eligibility: EligibilityResult }[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<{
    item: MarketplaceListing;
    distanceKm: number;
    isWithinDeliveryRadius: boolean;
  }[]>([]);
  const [communities, setCommunities] = useState<CommunityGroup[]>([]);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [services, setServices] = useState<LocalServiceProvider[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch ecosystem data whenever location or feed tab updates
  const loadData = useCallback(async () => {
    setIsLoading(true);

    const mergeWithStoredUserPosts = (
      posts: { post: Post; eligibility: EligibilityResult }[],
      reels: { reel: Post; eligibility: EligibilityResult }[]
    ) => {
      const userPosts = getStoredUserPosts();
      if (userPosts.length === 0) return { posts, reels };

      const existingPostIds = new Set(posts.map(p => p.post.id));
      const newPostEntries: { post: Post; eligibility: EligibilityResult }[] = [];
      const newReelEntries: { reel: Post; eligibility: EligibilityResult }[] = [];

      for (const up of userPosts) {
        if (!existingPostIds.has(up.id)) {
          const el = evaluateOrganicEligibility(viewerLocation, up);
          newPostEntries.push({ post: up, eligibility: el });
          if (up.contentType === 'reel' || up.contentType === 'video') {
            newReelEntries.push({ reel: up, eligibility: el });
          }
        }
      }

      const existingReelIds = new Set(reels.map(r => r.reel.id));
      return {
        posts: [...newPostEntries, ...posts],
        reels: [...newReelEntries.filter(r => !existingReelIds.has(r.reel.id)), ...reels]
      };
    };

    const fallbackToLocalData = () => {
      const organicEvaluated = INITIAL_POSTS.map(p => ({
        post: p,
        eligibility: evaluateOrganicEligibility(viewerLocation, p)
      })).filter(item => {
        if (activeFeedTab === 'around_me') {
          return item.eligibility.isEligible && item.eligibility.distanceKm <= 40;
        }
        if (activeFeedTab === 'following') {
          return item.post.creatorId === 'creator_arjun';
        }
        return item.eligibility.isEligible;
      });

      const adsEvaluated = INITIAL_AD_CAMPAIGNS.map(ad => ({
        ad,
        eligibility: evaluateCommercialEligibility(viewerLocation, ad)
      })).filter(item => item.eligibility.isEligible);

      const reelsEvaluated = INITIAL_POSTS
        .filter(p => p.contentType === 'reel' || p.contentType === 'video')
        .map(p => ({
          reel: p,
          eligibility: evaluateOrganicEligibility(viewerLocation, p)
        }))
        .filter(item => item.eligibility.isEligible);

      const merged = mergeWithStoredUserPosts(organicEvaluated, reelsEvaluated);
      setFeedPosts(merged.posts);
      setFeedAds(activeFeedTab === 'around_me' || activeFeedTab === 'global' ? adsEvaluated : []);
      setReelsList(merged.reels);
      setCampaigns(INITIAL_AD_CAMPAIGNS);
      setBusinesses(INITIAL_BUSINESSES);
      setMarketplaceItems(INITIAL_MARKETPLACE.map(item => {
        const dist = calculateHaversineDistance(
          viewerLocation.coords.latitude,
          viewerLocation.coords.longitude,
          item.coordinates.latitude,
          item.coordinates.longitude
        );
        return {
          item,
          distanceKm: dist,
          isWithinDeliveryRadius: dist <= item.maxDeliveryRadiusKm
        };
      }));
      setCommunities(INITIAL_COMMUNITIES);
      setJobs(INITIAL_JOBS);
      setServices(INITIAL_SERVICES);
      setEvents(INITIAL_EVENTS);
      setNotifications(INITIAL_NOTIFICATIONS);
    };

    setIsLoading(true);
    const query = new URLSearchParams({
      lat: viewerLocation.coords.latitude.toString(),
      lon: viewerLocation.coords.longitude.toString(),
      city: viewerLocation.cityName,
      country: viewerLocation.country,
      countryCode: viewerLocation.countryCode,
      verified: viewerLocation.isVerified ? 'true' : 'false',
      permission: viewerLocation.permissionState,
      tab: activeFeedTab
    });

    try {
      // 1. Single unified ecosystem call (instant load, no lambda queuing, no-cache)
      const initRes = await fetch(`/api/init?${query.toString()}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      const isJson = initRes.headers.get('content-type')?.includes('application/json');

      if (initRes.ok && isJson) {
        const data = await initRes.json();
        const merged = mergeWithStoredUserPosts(data.posts || [], data.reels || []);
        setFeedPosts(merged.posts);
        setFeedAds(data.ads || []);
        setReelsList(merged.reels);
        setCampaigns(data.campaigns || []);
        setBusinesses(data.businesses || []);
        setMarketplaceItems(data.marketplace || []);
        setCommunities(data.communities || []);
        setJobs(data.jobs || []);
        setServices(data.services || []);
        setEvents(data.events || []);
        setNotifications(data.notifications || []);
        setIsLoading(false);
        return;
      }
    } catch {
      // Graceful fallback to local data if serverless cold-start times out
    }

    fallbackToLocalData();
    setIsLoading(false);
  }, [viewerLocation, activeFeedTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handlePostCreated = (newPost?: Post) => {
    if (newPost) {
      saveStoredUserPost(newPost);
      const eligibility = evaluateOrganicEligibility(viewerLocation, newPost);
      setFeedPosts(prev => [{ post: newPost, eligibility }, ...prev.filter(p => p.post.id !== newPost.id)]);
      if (newPost.contentType === 'reel' || newPost.contentType === 'video') {
        setReelsList(prev => [{ reel: newPost, eligibility }, ...prev.filter(r => r.reel.id !== newPost.id)]);
      }
    }
    loadData();
  };

  // Deep link handler: ?post=xxx or ?reel=xxx + OpenGraph dynamic title updates
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const deepPostId = params.get('post') || params.get('reel');
      if (deepPostId) {
        const reelIdx = reelsList.findIndex(r => r.reel.id === deepPostId);
        if (reelIdx !== -1) {
          setSelectedReelIndex(reelIdx);
          setIsFullScreenReelsOpen(true);
          const matchedReel = reelsList[reelIdx]?.reel;
          if (matchedReel) {
            document.title = `${matchedReel.title} — LocalNet`;
          }
        } else {
          const feedMatch = feedPosts.find(p => p.post.id === deepPostId);
          if (feedMatch) {
            document.title = `${feedMatch.post.title} — LocalNet`;
            setTimeout(() => {
              const el = document.getElementById(`feed-post-${deepPostId}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 500);
          }
        }
      }
    } catch {}
  }, [reelsList, feedPosts]);

  return (
    <div className={`w-full max-w-full min-h-screen min-h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-amber-500/20 selection:text-amber-900 ${isFullScreenReelsOpen ? 'p-0 m-0 overflow-hidden' : 'pb-20 md:pb-0 overflow-x-hidden'}`}>

      {/* Top Bar Navigation (Hidden during full-screen Reels playback) */}
      {!isFullScreenReelsOpen && (
        <TopNavigation
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenCreate={() => setIsCreateModalOpen(true)}
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          language={language}
          onSelectLanguage={handleSelectLanguage}
          unreadNotificationsCount={unreadCount}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />
      )}

      {/* Main View Container */}
      <main className={isFullScreenReelsOpen ? "w-full h-full p-0 m-0" : "w-full max-w-7xl mx-auto flex-1 px-0 sm:px-2 md:px-4"}>

        {/* 1. HOME FEED (Screen 2: Global, Around Me, Following + Shorts Carousel) */}
        {currentTab === 'home' && !isFullScreenReelsOpen && (
          <HomeFeed
            posts={feedPosts}
            ads={feedAds}
            reels={reelsList}
            activeFeedTab={activeFeedTab}
            onChangeFeedTab={setActiveFeedTab}
            onOpenCreate={() => setIsCreateModalOpen(true)}
            onOpenLocationModal={() => setIsLocationModalOpen(true)}
            onOpenReels={(index?: number) => {
              document.querySelectorAll('video').forEach((v) => {
                if (!v.paused) v.pause();
              });
              setSelectedReelIndex(index ?? 0);
              setIsFullScreenReelsOpen(true);
            }}
            language={language}
          />
        )}

        {/* REELS FULL-SCREEN VERTICAL SWIPE EXPERIENCE (Option B: 100vw x 100dvh, Touch Swipe, Sound, Controls) */}
        {isFullScreenReelsOpen && (
          <ReelsView
            reels={reelsList}
            initialIndex={selectedReelIndex}
            onOpenCreate={() => setIsCreateModalOpen(true)}
            onClose={() => setIsFullScreenReelsOpen(false)}
          />
        )}

        {/* 2. EXPLORE (Screen 5: Categories, Radius Slider, Map/List) */}
        {currentTab === 'explore' && !isFullScreenReelsOpen && (
          <ExploreView
            posts={feedPosts}
            ads={feedAds}
            businesses={businesses}
            onOpenLocationModal={() => setIsLocationModalOpen(true)}
            onOpenCreate={() => setIsCreateModalOpen(true)}
          />
        )}

        {/* 3. LOCAL HUB (Screen 6: Marketplace, Businesses, Communities, Jobs, Services, Events, Offers) */}
        {currentTab === 'local' && !isFullScreenReelsOpen && (
          <LocalHubView
            marketplace={marketplaceItems}
            businesses={businesses}
            communities={communities}
            jobs={jobs}
            services={services}
            events={events}
            language={language}
            onOpenLocationModal={() => setIsLocationModalOpen(true)}
            onRefreshData={loadData}
          />
        )}

        {/* 4. PROFILE (Screen 14: Multi-Role Switcher, Creator Studio, Language) */}
        {currentTab === 'profile' && !isFullScreenReelsOpen && (
          <ProfileView
            posts={feedPosts.map(p => p.post)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            onOpenLocationModal={() => setIsLocationModalOpen(true)}
            language={language}
            onSelectLanguage={handleSelectLanguage}
            onOpenLab={() => setCurrentTab('lab')}
          />
        )}

        {/* 5. ENGINE VERIFICATION LAB */}
        {currentTab === 'lab' && !isFullScreenReelsOpen && (
          <DistributionEngineLab />
        )}
      </main>

      {/* Mobile Bottom Navigation (5 destinations - Hidden during full-screen Reels playback) */}
      {!isFullScreenReelsOpen && (
        <BottomNavBar
          currentTab={currentTab}
          onSelectTab={tab => {
            setIsFullScreenReelsOpen(false);
            setCurrentTab(tab);
          }}
          onOpenCreate={() => setIsCreateModalOpen(true)}
          language={language}
        />
      )}

      {/* Dynamic Viewer Location Switcher Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* Content Creation Studio Modal */}
      <CreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Notifications Drawer Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />

      {/* Welcome & OTP Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        language={language}
        onSelectLanguage={handleSelectLanguage}
        onLoginSuccess={() => loadData()}
      />

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LocationProvider>
        <LocalNetContent />
      </LocationProvider>
    </ErrorBoundary>
  );
}
