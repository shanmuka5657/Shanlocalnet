import React, { useState, useRef, useEffect } from 'react';
import { Music, Play, Pause, X, Check, Flame, Disc3, Volume2 } from 'lucide-react';
import { AudioTrackMetadata } from '../types/index.ts';
import { CURATED_AUDIO_TRACKS } from '../lib/audioLibrary.ts';

interface AudioTrackPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrack: AudioTrackMetadata | null;
  onSelectTrack: (track: AudioTrackMetadata | null) => void;
}

export const AudioTrackPickerModal: React.FC<AudioTrackPickerModalProps> = ({
  isOpen,
  onClose,
  selectedTrack,
  onSelectTrack
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'trending' | 'regional' | 'acoustic' | 'ambient'>('all');
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Stop audio on unmount or close
  useEffect(() => {
    if (!isOpen && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPreviewingTrackId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredTracks = CURATED_AUDIO_TRACKS.filter(t => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'regional') return t.category === 'regional' || t.category === 'folk';
    return t.category === activeCategory;
  });

  const togglePreview = (track: AudioTrackMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingTrackId === track.id) {
      // Pause
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPreviewingTrackId(null);
    } else {
      // Play new
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      const audio = new Audio(track.audioUrl);
      audio.volume = 0.8;
      audio.onended = () => setPreviewingTrackId(null);
      audio.onerror = () => setPreviewingTrackId(null);
      audio.play().catch(() => setPreviewingTrackId(null));
      audioPreviewRef.current = audio;
      setPreviewingTrackId(track.id);
    }
  };

  const handleSelect = (track: AudioTrackMetadata | null) => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    setPreviewingTrackId(null);
    onSelectTrack(track);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Disc3 className="w-5 h-5 animate-spin [animation-duration:8s]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Choose Audio Track
              </h3>
              <p className="text-xs text-slate-400">
                Trending regional beats & background music for reels
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (audioPreviewRef.current) audioPreviewRef.current.pause();
              setPreviewingTrackId(null);
              onClose();
            }}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Beats' },
            { id: 'trending', label: '🔥 Trending' },
            { id: 'regional', label: '🥁 Rayalaseema & Folk' },
            { id: 'acoustic', label: '🎸 Acoustic & Lo-Fi' },
            { id: 'ambient', label: '🌿 Ambient Flute' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {/* Default: Original Video Audio */}
          <div
            onClick={() => handleSelect(null)}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              !selectedTrack
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Original Audio</p>
                <p className="text-[11px] text-slate-400">Keep original captured video sound</p>
              </div>
            </div>
            {!selectedTrack && (
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </div>

          {/* Curated Tracks */}
          {filteredTracks.map(track => {
            const isSelected = selectedTrack?.id === track.id;
            const isPreviewing = previewingTrackId === track.id;

            return (
              <div
                key={track.id}
                onClick={() => handleSelect(track)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500 shadow-md shadow-amber-500/10'
                    : 'bg-slate-800/40 border-slate-800/80 hover:border-amber-500/40 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  {/* Artwork & Play button overlay */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700 bg-slate-800 group/art">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => togglePreview(track, e)}
                      className={`absolute inset-0 flex items-center justify-center transition-all ${
                        isPreviewing
                          ? 'bg-amber-500 text-slate-950 opacity-100'
                          : 'bg-black/50 text-white opacity-80 group-hover/art:opacity-100'
                      }`}
                      title={isPreviewing ? 'Pause preview' : 'Play preview snippet'}
                    >
                      {isPreviewing ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Title & Artist */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-bold truncate ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                        {track.title}
                      </p>
                      {track.category === 'trending' && (
                        <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {track.artist} · {track.durationSeconds}s
                    </p>
                    {track.useCount && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        {track.useCount.toLocaleString()} reels created
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Selection Radio / Button */}
                <div className="flex items-center gap-2 shrink-0">
                  {isSelected ? (
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700">
                      Select
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Royalty-free licensed for LocalNet creators</span>
          <button
            onClick={() => {
              if (audioPreviewRef.current) audioPreviewRef.current.pause();
              setPreviewingTrackId(null);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
