import React from 'react';
import { FilterPreset } from './types.ts';
import {
  Sparkles,
  Sliders,
  Volume2,
  VolumeX,
  Gauge,
  Music2,
  X
} from 'lucide-react';

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'normal', name: 'Normal', cssFilter: 'none', previewColor: '#64748b' },
  { id: 'vibrant', name: 'Vibrant', cssFilter: 'saturate(1.5) contrast(1.1)', previewColor: '#f59e0b' },
  { id: 'warm', name: 'Warm Sunset', cssFilter: 'sepia(0.3) saturate(1.3) hue-rotate(-10deg)', previewColor: '#f97316' },
  { id: 'cool', name: 'Cool Teal', cssFilter: 'saturate(1.2) hue-rotate(15deg) contrast(1.05)', previewColor: '#06b6d4' },
  { id: 'vintage', name: 'Vintage 90s', cssFilter: 'sepia(0.5) contrast(0.9) brightness(1.1)', previewColor: '#d97706' },
  { id: 'cinematic', name: 'Cinematic', cssFilter: 'contrast(1.25) saturate(1.15) brightness(0.95)', previewColor: '#8b5cf6' },
  { id: 'bw', name: 'Noir B&W', cssFilter: 'grayscale(1) contrast(1.3)', previewColor: '#475569' }
];

interface FilterAudioControlsProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilter: string;
  onSelectFilter: (filterId: string) => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  originalAudioVolume: number;
  onChangeOriginalAudioVolume: (vol: number) => void;
  isOriginalAudioMuted: boolean;
  onToggleMuteOriginalAudio: () => void;
  backgroundMusicTitle?: string;
  onOpenMusicPicker: () => void;
  onRemoveMusic: () => void;
  brightness: number;
  onChangeBrightness: (val: number) => void;
  contrast: number;
  onChangeContrast: (val: number) => void;
  saturation: number;
  onChangeSaturation: (val: number) => void;
}

export const FilterAudioControls: React.FC<FilterAudioControlsProps> = ({
  isOpen,
  onClose,
  activeFilter,
  onSelectFilter,
  playbackSpeed,
  onChangeSpeed,
  originalAudioVolume,
  onChangeOriginalAudioVolume,
  isOriginalAudioMuted,
  onToggleMuteOriginalAudio,
  backgroundMusicTitle,
  onOpenMusicPicker,
  onRemoveMusic,
  brightness,
  onChangeBrightness,
  contrast,
  onChangeContrast,
  saturation,
  onChangeSaturation
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Video Filters, Speed & Audio</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-5 overflow-y-auto">
          {/* Section 1: Color Filters */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Color Filters & Cinematic Presets:</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {FILTER_PRESETS.map(f => (
                <button
                  key={f.id}
                  onClick={() => onSelectFilter(f.id)}
                  className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 border transition-all ${
                    activeFilter === f.id
                      ? 'border-amber-400 bg-amber-500/10 text-amber-300 ring-2 ring-amber-400/30'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div
                    style={{ backgroundColor: f.previewColor }}
                    className="w-7 h-7 rounded-full shadow-inner"
                  />
                  <span className="truncate max-w-full">{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Speed Controls */}
          <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Gauge className="w-4 h-4 text-amber-400" />
                <span>Playback Speed:</span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">{playbackSpeed}x</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0.5, 1.0, 2.0].map(s => (
                <button
                  key={s}
                  onClick={() => onChangeSpeed(s)}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    playbackSpeed === s
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {s === 0.5 ? '0.5x Slow-mo' : s === 1.0 ? '1.0x Normal' : '2.0x Fast'}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Audio Management */}
          <div className="flex flex-col gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>Original Video Audio:</span>
              </div>
              <button
                onClick={onToggleMuteOriginalAudio}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                  isOriginalAudioMuted
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {isOriginalAudioMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                {isOriginalAudioMuted ? 'Muted' : 'Sound On'}
              </button>
            </div>

            {!isOriginalAudioMuted && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 w-16">
                  Volume: {Math.round(originalAudioVolume * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={originalAudioVolume}
                  onChange={e => onChangeOriginalAudioVolume(Number(e.target.value))}
                  className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            )}

            {/* Background Music Attachment */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music2 className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-300 truncate max-w-[170px]">
                  {backgroundMusicTitle || 'No Background Music'}
                </span>
              </div>
              {backgroundMusicTitle ? (
                <button
                  onClick={onRemoveMusic}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-950/40 rounded"
                >
                  Remove
                </button>
              ) : (
                <button
                  onClick={onOpenMusicPicker}
                  className="text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 px-3 py-1 rounded-lg shadow"
                >
                  Pick Music
                </button>
              )}
            </div>
          </div>

          {/* Section 4: Fine Light Tuning */}
          <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
            <span className="font-bold text-slate-300">Fine Adjustments:</span>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-20">Brightness:</span>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={brightness}
                onChange={e => onChangeBrightness(Number(e.target.value))}
                className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-500 w-8">{Math.round(brightness * 100)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-20">Contrast:</span>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={contrast}
                onChange={e => onChangeContrast(Number(e.target.value))}
                className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-500 w-8">{Math.round(contrast * 100)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-20">Saturation:</span>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.05"
                value={saturation}
                onChange={e => onChangeSaturation(Number(e.target.value))}
                className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-500 w-8">{Math.round(saturation * 100)}%</span>
            </div>
          </div>

          {/* Done Button */}
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm shadow"
          >
            Apply Adjustments
          </button>
        </div>
      </div>
    </div>
  );
};
