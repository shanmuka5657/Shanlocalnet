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
      const [feedRes, reelsRes, campRes, bizRes, mktRes, commRes, jobsRes, srvRes, evtRes, notifRes] =
        await Promise.all([
          fetch(`/api/feed?${query.toString()}`),
          fetch(`/api/reels?${query.toString()}`),
          fetch('/api/campaigns'),
          fetch('/api/businesses'),
          fetch(`/api/marketplace?${query.toString()}`),
          fetch('/api/communities'),
          fetch('/api/jobs'),
          fetch('/api/services'),
          fetch('/api/events'),
          fetch('/api/notifications')
        ]);

      if (feedRes.ok) {
        const feedData = await feedRes.json();
        setFeedPosts(feedData.posts || []);
        setFeedAds(feedData.ads || []);
      }
      if (reelsRes.ok) {
        const reelsData = await reelsRes.json();
        setReelsList(reelsData.reels || []);
      }
      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData.campaigns || []);
      }
      if (bizRes.ok) {
        const bizData = await bizRes.json();
        setBusinesses(bizData.businesses || []);
      }
      if (mktRes.ok) {
        const mktData = await mktRes.json();
        setMarketplaceItems(mktData.marketplace || []);
      }
      if (commRes.ok) {
        const commData = await commRes.json();
        setCommunities(commData.communities || []);
      }
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.jobs || []);
      }
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        setServices(srvData.services || []);
      }
      if (evtRes.ok) {
        const evtData = await evtRes.json();
        setEvents(evtData.events || []);
      }
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications || []);
      }
    } catch (e) {
      console.error('Error fetching LocalNet data', e);
    } finally {
      setIsLoading(false);
    }
  }, [viewerLocation, activeFeedTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

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
        onPostCreated={loadData}
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
