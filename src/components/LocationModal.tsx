import React from 'react';
import { useLocation } from '../context/LocationContext.tsx';
import { CITY_PRESETS } from '../lib/geo.ts';
import { MapPin, Navigation, ShieldCheck, ShieldAlert, X, Globe, Radio } from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose }) => {
  const {
    viewerLocation,
    currentCityPreset,
    isLoadingGps,
    gpsError,
    setCityPreset,
    requestLiveGps,
    setPermissionState
  } = useLocation();

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90dvh] animate-slide-up sm:animate-none safe-area-bottom"
      >
        {/* Mobile Drag Pill */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
              <span>Dynamic Viewer Location</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Determines eligible organic content and 40 km commercial commerce
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Resolved Location Card */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
              <div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Active Verified Position
                </span>
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {viewerLocation.cityName}, {viewerLocation.country}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                  Approx. Lat: {viewerLocation.coords.latitude.toFixed(4)}° · Lon: {viewerLocation.coords.longitude.toFixed(4)}°
                </p>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-1.5 self-stretch sm:self-auto justify-between sm:justify-start pt-1 sm:pt-0 border-t sm:border-t-0 border-amber-200/60 dark:border-amber-900/40">
                {viewerLocation.permissionState === 'granted' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified GPS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Permission Denied
                  </span>
                )}
                <span className="text-[10px] text-slate-400">
                  {viewerLocation.permissionState === 'granted'
                    ? 'Eligible for 40km commerce'
                    : 'Worldwide entertainment only'}
                </span>
              </div>
            </div>

            {/* GPS action button */}
            <div className="mt-4 pt-3 border-t border-amber-200/50 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <button
                onClick={requestLiveGps}
                disabled={isLoadingGps}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 rounded-xl transition-all shadow-sm disabled:opacity-50 w-full sm:w-auto"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLoadingGps ? 'animate-spin' : ''}`} />
                {isLoadingGps ? 'Querying GPS Hardware...' : 'Detect Device Live GPS'}
              </button>

              {/* Permission toggle for test simulation */}
              <div className="flex items-center justify-between sm:justify-end gap-1.5 text-xs text-slate-500">
                <span>Simulate:</span>
                <button
                  onClick={() => setPermissionState(viewerLocation.permissionState === 'granted' ? 'denied' : 'granted')}
                  className="px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:border-amber-500 transition-colors"
                >
                  {viewerLocation.permissionState === 'granted' ? 'Deny Permission' : 'Grant Permission'}
                </button>
              </div>
            </div>

            {gpsError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">
                {gpsError}
              </p>
            )}
          </div>

          {/* Quick Preset Cities */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Switch Test City
              </h4>
              <span className="text-[11px] text-slate-400">
                Instantly changes local commerce feed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CITY_PRESETS.map(city => {
                const isSelected = viewerLocation.cityName.includes(city.name);
                return (
                  <button
                    key={city.name}
                    onClick={() => {
                      setCityPreset(city);
                    }}
                    className={`text-left p-3 rounded-2xl border transition-all flex flex-col justify-between ${isSelected
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm ring-1 ring-amber-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Radio className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`} />
                        {city.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase">
                        {city.countryCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {city.tagline}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Privacy & Anti-Surveillance Explainer */}
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              Privacy & Geospatial Integrity Standard
            </p>
            <p>
              LocalNet does not reveal your precise coordinates to other users. Only verified city and distance boundaries (such as 10 km or 40 km) are calculated server-side using the Haversine great-circle formula.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
