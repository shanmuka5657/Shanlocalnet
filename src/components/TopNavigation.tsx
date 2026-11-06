import React, { useState } from 'react';
import { useLocation } from '../context/LocationContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { SupportedLanguage } from '../types/index.ts';
import { getTranslation } from '../lib/i18n.ts';
import {
  MapPin,
  PlusCircle,
  FlaskConical,
  Sun,
  Moon,
  ShieldCheck,
  ShieldAlert,
  Languages,
  Bell,
  MoreVertical,
  X,
  Sparkles,
  Download,
  Search,
  User
} from 'lucide-react';

export type MainNavigationTab = 'home' | 'explore' | 'local' | 'profile' | 'lab';

interface TopNavigationProps {
  currentTab: MainNavigationTab;
  onSelectTab: (tab: MainNavigationTab) => void;
  onOpenCreate: () => void;
  onOpenSearch: () => void;
  onOpenLocationModal: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  language: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  unreadNotificationsCount?: number;
  onOpenNotifications: () => void;
  onOpenAuth?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenCreate,
  onOpenSearch,
  onOpenLocationModal,
  isDarkMode,
  onToggleDarkMode,
  language,
  onSelectLanguage,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onOpenAuth
}) => {
  const { viewerLocation } = useLocation();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const t = (key: string) => getTranslation(language, key);

  const navLinks: { id: MainNavigationTab; label: string }[] = [
    { id: 'home', label: t('navHome') },
    { id: 'explore', label: t('navExplore') },
    { id: 'local', label: t('navLocal') },
    { id: 'profile', label: t('navProfile') }
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors safe-area-top">
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-8 h-14 sm:h-15 flex items-center justify-between gap-1.5 sm:gap-4">

        {/* Left Zone: Brand Wordmark + Location Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
          <button
            onClick={() => onSelectTab('home')}
            className="text-left group cursor-pointer focus:outline-none shrink-0"
          >
            <span className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Local<span className="text-amber-600 dark:text-amber-400">Net</span>
            </span>
          </button>

          {/* Location Selector (Always visible, responsive truncation) */}
          <button
            onClick={onOpenLocationModal}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 shrink min-w-0"
            title="Change Location"
          >
            <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="font-semibold truncate max-w-[68px] min-[360px]:max-w-[85px] sm:max-w-[130px]">
              {viewerLocation.cityName}
            </span>
            {viewerLocation.permissionState === 'granted' ? (
              <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 shrink-0" />
            ) : (
              <ShieldAlert className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500 shrink-0" />
            )}
          </button>
        </div>

        {/* Center Zone: Desktop Navigation Links + Search Pill */}
        <div className="hidden md:flex items-center gap-3 lg:gap-5 flex-1 max-w-xl mx-2">
          {/* Desktop Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 text-xs transition-all border border-slate-200/80 dark:border-slate-700/80 shadow-inner group cursor-pointer text-left"
            title="Search LocalNet (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="truncate text-slate-500 dark:text-slate-400">
              {getTranslation(language, 'searchPlaceholder')}
            </span>
            <kbd className="hidden lg:inline-block ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              Ctrl+K
            </kbd>
          </button>

          <nav className="flex items-center gap-4 lg:gap-5 text-sm font-medium">
            {navLinks.map(link => {
              const isActive = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => onSelectTab(link.id)}
                  className={`whitespace-nowrap shrink-0 transition-colors py-1 relative ${isActive
                    ? 'text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Zone: Controls (Responsive across all screens) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">

          {/* Search Trigger Button (Always visible on mobile, icon on tablet) */}
          <button
            onClick={onOpenSearch}
            className="md:hidden p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-4 h-4 text-amber-500" />
          </button>

          {/* Desktop-only: Language Dropdown */}
          <div className="hidden lg:relative lg:block group">
            <button
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Change Language"
            >
              <Languages className="w-3.5 h-3.5 text-amber-500" />
              <span className="uppercase font-mono text-[11px]">{language}</span>
            </button>

            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-50 min-w-[120px]">
              <button
                onClick={() => onSelectLanguage('en')}
                className={`px-3 py-1.5 text-left text-xs transition-colors ${language === 'en' ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                English
              </button>
              <button
                onClick={() => onSelectLanguage('te')}
                className={`px-3 py-1.5 text-left text-xs transition-colors ${language === 'te' ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                à°¤à±†à°²à±à°—à± (Telugu)
              </button>
              <button
                onClick={() => onSelectLanguage('hi')}
                className={`px-3 py-1.5 text-left text-xs transition-colors ${language === 'hi' ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                à¤¹à¤¿à¤¨à¥à¤¦à¥€ (Hindi)
              </button>
            </div>
          </div>

          {/* Desktop-only: Lab Trigger */}
          <button
            onClick={() => onSelectTab('lab')}
            className={`hidden md:block p-2 rounded-xl text-xs font-medium transition-colors border ${currentTab === 'lab'
              ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            title="Distribution Engine Lab"
          >
            <FlaskConical className="w-4 h-4" />
          </button>

          {/* Notifications Button (Visible on all viewports) */}
          <button
            onClick={onOpenNotifications}
            className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 relative transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* Desktop: Download APK link */}
          <a
            href="/downloads/LocalNet.apk"
            download="LocalNet.apk"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300/60 dark:border-amber-700/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-xl transition-all active:scale-95 shrink-0"
            title="Download LocalNet Android App (APK)"
          >
            <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Get APK</span>
          </a>

          {/* Desktop-only: Theme Switcher */}
          <button
            onClick={onToggleDarkMode}
            className="hidden sm:block p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* User Profile / Google Sign-In Pill */}
          {user ? (
            <button
              onClick={() => onSelectTab('profile')}
              className="relative p-0.5 rounded-full ring-2 ring-amber-500/50 hover:ring-amber-500 transition-all shrink-0 cursor-pointer"
              title={`Signed in as ${user.name}`}
            >
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80'}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white dark:border-slate-900 rounded-full" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Sign in with Google"
            >
              <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}

          {/* Mobile Overflow Menu Button (Houses Language, Theme, and Lab) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors"
            aria-label="Open secondary menu"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Mobile Overflow Drawer / Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 space-y-3 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Settings & Tools</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Language Selector in Drawer */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 font-medium">Language / à°­à°¾à°·:</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  onSelectLanguage('en');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-1 text-xs font-semibold rounded-lg border ${language === 'en'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
              >
                English
              </button>
              <button
                onClick={() => {
                  onSelectLanguage('te');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-1 text-xs font-semibold rounded-lg border ${language === 'te'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
              >
                à°¤à±†à°²à±à°—à±
              </button>
              <button
                onClick={() => {
                  onSelectLanguage('hi');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-1 text-xs font-semibold rounded-lg border ${language === 'hi'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
              >
                à¤¹à¤¿à¤¨à¥à¤¦à¥€
              </button>
            </div>
          </div>

          {/* Direct Mobile APK Download */}
          <div className="pt-1">
            <a
              href="/downloads/LocalNet.apk"
              download="LocalNet.apk"
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-xs font-bold text-white shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Android App (APK - 39.6 MB)</span>
            </a>
          </div>

          {/* Quick Actions Row */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                onToggleDarkMode();
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button
              onClick={() => {
                onSelectTab('lab');
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Engine Lab</span>
            </button>
          </div>
        </div>
      )}

    </header>
  );
};
