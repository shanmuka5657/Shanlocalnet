import React from 'react';
import { MainNavigationTab } from './TopNavigation.tsx';
import { Home, Compass, Plus, Store, User } from 'lucide-react';
import { SupportedLanguage } from '../types/index.ts';
import { getTranslation } from '../lib/i18n.ts';
import { triggerHaptic } from '../lib/haptics.ts';

interface BottomNavBarProps {
  currentTab: MainNavigationTab;
  onSelectTab: (tab: MainNavigationTab) => void;
  onOpenCreate: () => void;
  language: SupportedLanguage;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  onSelectTab,
  onOpenCreate,
  language
}) => {
  const t = (key: string) => getTranslation(language, key);

  const handleTabClick = (tab: MainNavigationTab) => {
    triggerHaptic('light');
    onSelectTab(tab);
  };

  const handleCreateClick = () => {
    triggerHaptic('heavy');
    onOpenCreate();
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-area-bottom shadow-lg">
      <div className="w-full grid grid-cols-5 items-center h-14 sm:h-16 px-1">
        
        {/* 1. Home */}
        <button
          onClick={() => handleTabClick('home')}
          className={`w-full min-h-[44px] flex flex-col items-center justify-center py-1 transition-colors ${
            currentTab === 'home'
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          aria-label={t('navHome')}
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">
            {t('navHome')}
          </span>
        </button>

        {/* 2. Explore */}
        <button
          onClick={() => handleTabClick('explore')}
          className={`w-full min-h-[44px] flex flex-col items-center justify-center py-1 transition-colors ${
            currentTab === 'explore'
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          aria-label={t('navExplore')}
        >
          <Compass className="w-5 h-5 shrink-0" />
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">
            {t('navExplore')}
          </span>
        </button>

        {/* 3. Create (Elevated Action trigger) */}
        <button
          onClick={handleCreateClick}
          className="w-full min-h-[44px] flex flex-col items-center justify-center py-1 group"
          aria-label={t('navCreate')}
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-600 group-hover:bg-amber-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform -mt-2">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 text-amber-600 dark:text-amber-400 font-bold truncate max-w-full">
            {t('navCreate')}
          </span>
        </button>

        {/* 4. Local (Local Hub) */}
        <button
          onClick={() => handleTabClick('local')}
          className={`w-full min-h-[44px] flex flex-col items-center justify-center py-1 transition-colors ${
            currentTab === 'local'
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          aria-label={t('navLocal')}
        >
          <Store className="w-5 h-5 shrink-0" />
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">
            {t('navLocal')}
          </span>
        </button>

        {/* 5. Profile */}
        <button
          onClick={() => handleTabClick('profile')}
          className={`w-full min-h-[44px] flex flex-col items-center justify-center py-1 transition-colors ${
            currentTab === 'profile'
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          aria-label={t('navProfile')}
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">
            {t('navProfile')}
          </span>
        </button>

      </div>
    </nav>
  );
};
