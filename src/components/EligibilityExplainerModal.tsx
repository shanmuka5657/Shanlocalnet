import React from 'react';
import { EligibilityResult, Post, AdCampaign } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import { X, CheckCircle2, ShieldCheck, Globe, Zap, AlertTriangle } from 'lucide-react';

interface EligibilityExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  post?: Post | null;
  ad?: AdCampaign | null;
  eligibility: EligibilityResult | null;
}

export const EligibilityExplainerModal: React.FC<EligibilityExplainerModalProps> = ({
  isOpen,
  onClose,
  post,
  ad,
  eligibility
}) => {
  const { viewerLocation } = useLocation();

  if (!isOpen || !eligibility) return null;

  const isEngineA = eligibility.engine === 'ORGANIC_ENTERTAINMENT';
  const title = post ? post.title : ad ? ad.headline : 'Geographical Eligibility Breakdown';
  const publishingCity = post
    ? post.publishingLocation.cityName
    : ad
    ? ad.targetCity
    : 'Origin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90dvh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className={`p-1.5 rounded-xl shrink-0 ${isEngineA ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'}`}>
              {isEngineA ? <Globe className="w-4 h-4 sm:w-5 sm:h-5" /> : <Zap className="w-4 h-4 sm:w-5 sm:h-5" />}
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                {isEngineA ? 'Engine A: Organic' : 'Engine B: Commercial'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Geographical Eligibility Audit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-sm overflow-y-auto">
          {/* Target Content Overview */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Evaluated Content
            </span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5 line-clamp-2">
              {title}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Published in {publishingCity}</span>
              <span aria-hidden="true">·</span>
              <span>Viewer in {viewerLocation.cityName}</span>
            </div>
          </div>

          {/* Engine Rules Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Distribution Engine Policy
            </h4>

            {isEngineA ? (
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                    Organic Distribution Rule
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                    Scope: {post?.audienceDistribution.scope.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-indigo-800 dark:text-indigo-300">
                  {post?.audienceDistribution.scope === 'worldwide'
                    ? 'Creator selected Worldwide reach. Organic entertainment has no geographical ceiling and is delivered across all eligible viewers internationally.'
                    : `Creator set an organic community radius of ${eligibility.allowedRadiusKm} km. Viewers must be within this proximity.`}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-900 dark:text-amber-200">
                    Hyperlocal Commercial Rule (Max 40 km)
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                    Capped: {ad?.selectedRadiusKm ?? 40} km
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  LocalNet policy strictly confines commercial advertisements to a maximum of 40 km. Commercial campaigns exceeding 40 km are rejected by server validation.
                </p>
              </div>
            )}
          </div>

          {/* Distance & Mathematical Validation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block">Haversine Distance</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                {eligibility.distanceKm === Infinity ? 'N/A' : `${eligibility.distanceKm} km`}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block">Allowed Radius</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                {typeof eligibility.allowedRadiusKm === 'number'
                  ? `${eligibility.allowedRadiusKm} km`
                  : eligibility.allowedRadiusKm.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Status Verdict */}
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-200 text-xs">
                Verdict: Eligible to View
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                {eligibility.reason}
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
