import React, { useRef } from 'react';
import { VideoOverlay } from './types.ts';
import {
  Play,
  Pause,
  Trash2,
  Copy,
  Scissors,
  Layers,
  Sparkles,
  Tag,
  Type,
  Image as ImageIcon,
  Music,
  Zap
} from 'lucide-react';
import { snapTimeToNearestBeat } from '../../lib/beatDetector.ts';

interface StudioTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  trimStart: number;
  trimEnd: number;
  onUpdateTrim: (start: number, end: number) => void;
  overlays: VideoOverlay[];
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
  onUpdateOverlay: (id: string, updates: Partial<VideoOverlay>) => void;
  onDeleteOverlay: (id: string) => void;
  onDuplicateOverlay: (id: string) => void;
  // Auto Audio Beat Sync Props
  beatMarkers?: number[];
  dropMarkers?: number[];
  bpm?: number;
  isBeatSyncActive?: boolean;
  isAnalyzingBeats?: boolean;
  onToggleBeatSync?: () => void;
  onAutoSnapAllToBeats?: () => void;
}

export const StudioTimeline: React.FC<StudioTimelineProps> = ({
  duration,
  currentTime,
  onSeek,
  isPlaying,
  onTogglePlay,
  trimStart,
  trimEnd,
  onUpdateTrim,
  overlays,
  selectedOverlayId,
  onSelectOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  onDuplicateOverlay,
  beatMarkers = [],
  dropMarkers = [],
  bpm,
  isBeatSyncActive = false,
  isAnalyzingBeats = false,
  onToggleBeatSync,
  onAutoSnapAllToBeats
}) => {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const trimDragRef = useRef<'start' | 'end' | null>(null);

  const safeDuration = Math.max(0.1, duration);
  const progressPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  const handleTrimHandleDown = (e: React.PointerEvent, type: 'start' | 'end') => {
    e.stopPropagation();
    trimDragRef.current = type;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Trim handle dragging
    if (trimDragRef.current && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const time = (x / rect.width) * safeDuration;
      if (trimDragRef.current === 'start') {
        const newStart = Math.max(0, Math.min(time, trimEnd - 0.5));
        onUpdateTrim(Number(newStart.toFixed(2)), trimEnd);
        onSeek(newStart);
      } else {
        const newEnd = Math.max(trimStart + 0.5, Math.min(time, safeDuration));
        onUpdateTrim(trimStart, Number(newEnd.toFixed(2)));
        onSeek(newEnd);
      }
    }
  };

  const handleTimelinePointerUp = () => {
    trimDragRef.current = null;
  };

  // Timeline click to seek with Beat Snapping
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetPercent = Math.max(0, Math.min(1, clickX / rect.width));
    let targetTime = targetPercent * safeDuration;

    if (isBeatSyncActive && beatMarkers && beatMarkers.length > 0) {
      const snap = snapTimeToNearestBeat(targetTime, beatMarkers, 0.25);
      if (snap.isSnapped) {
        targetTime = snap.snappedTime;
      }
    }

    onSeek(targetTime);
  };

  const getOverlayColor = (type: string) => {
    switch (type) {
      case 'text':
        return 'bg-cyan-500/80 border-cyan-400 text-cyan-950';
      case 'image':
        return 'bg-emerald-500/80 border-emerald-400 text-emerald-950';
      case 'emoji':
      case 'sticker':
        return 'bg-amber-500/80 border-amber-400 text-amber-950';
      case 'price':
        return 'bg-yellow-400 border-yellow-300 text-slate-950 font-black';
      case 'merchant':
      case 'coupon':
        return 'bg-rose-500/80 border-rose-400 text-white';
      default:
        return 'bg-indigo-500/80 border-indigo-400 text-white';
    }
  };

  return (
    <div className="w-full bg-slate-950/90 border-t border-slate-800 p-2 sm:p-3 flex flex-col gap-2 select-none">
      {/* Timeline Controls Header */}
      <div className="flex items-center justify-between text-xs font-semibold px-1 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow transition-colors shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <div className="font-mono text-white text-xs">
            <span className="text-amber-400">{currentTime.toFixed(1)}s</span>
            <span className="text-slate-500"> / {safeDuration.toFixed(1)}s</span>
          </div>

          {/* Auto Audio Beat Sync Badge & Trigger */}
          {onToggleBeatSync && (
            <button
              type="button"
              onClick={onToggleBeatSync}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                isBeatSyncActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20 ring-1 ring-amber-400/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Toggle Audio Beat Sync & Snap-to-Rhythm"
            >
              <Music className={`w-3 h-3 ${isBeatSyncActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{isAnalyzingBeats ? 'Analyzing...' : bpm ? `${bpm} BPM` : 'Beat Sync'}</span>
              {isBeatSyncActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          )}

          {/* Snap All Layers to Beat */}
          {isBeatSyncActive && onAutoSnapAllToBeats && overlays.length > 0 && (
            <button
              type="button"
              onClick={onAutoSnapAllToBeats}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow transition-all active:scale-95"
              title="Auto-align all text and stickers to the nearest music beat"
            >
              <Zap className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">Snap Layers</span>
            </button>
          )}
        </div>

        {/* Selected Overlay Actions */}
        {selectedOverlayId && (
          <div className="flex items-center gap-1.5 animate-in fade-in shrink-0">
            <span className="text-[11px] text-slate-400 truncate max-w-[90px] sm:max-w-[120px]">
              {overlays.find(o => o.id === selectedOverlayId)?.label || 'Layer'}
            </span>
            <button
              type="button"
              onClick={() => onDuplicateOverlay(selectedOverlayId)}
              className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
              title="Duplicate layer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteOverlay(selectedOverlayId)}
              className="p-1 rounded bg-red-950/60 text-red-400 hover:text-red-300"
              title="Delete layer (leaves video intact)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Interactive Timeline Ruler & Playhead */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        onPointerMove={handleTimelinePointerMove}
        onPointerUp={handleTimelinePointerUp}
        onPointerLeave={handleTimelinePointerUp}
        className="relative w-full h-8 bg-slate-900 rounded-lg cursor-pointer overflow-visible border border-slate-800"
      >
        {/* Video Filmstrip Base */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 opacity-60" />

        {/* Auto Audio Beat Sync Visual Grid (Glowing rhythm bars & drops) */}
        {isBeatSyncActive && beatMarkers && beatMarkers.length > 0 && (
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {beatMarkers.map((beatTime, idx) => {
              const beatPercent = (beatTime / safeDuration) * 100;
              if (beatPercent < 0 || beatPercent > 100) return null;
              const isDrop = dropMarkers && dropMarkers.length > 0 ? dropMarkers.includes(beatTime) : (idx % 4 === 0);

              return (
                <div
                  key={`beat-${idx}`}
                  style={{ left: `${beatPercent}%` }}
                  className={`absolute bottom-0 w-0.5 transition-all ${
                    isDrop
                      ? 'top-0 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] z-15'
                      : 'top-2 bg-amber-400/40 z-10'
                  }`}
                >
                  {isDrop && (
                    <div className="w-1.5 h-1.5 -ml-0.5 rounded-full bg-amber-300 shadow" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Trimming Active Region with Draggable Handles */}
        <div
          style={{
            left: `${(trimStart / safeDuration) * 100}%`,
            width: `${((trimEnd - trimStart) / safeDuration) * 100}%`
          }}
          className="absolute top-0 bottom-0 bg-amber-500/10 z-20"
        >
          {/* Trim Start Handle */}
          <div
            onPointerDown={(e) => handleTrimHandleDown(e, 'start')}
            className="absolute left-0 top-0 bottom-0 w-4 -translate-x-1/2 cursor-ew-resize z-30 flex items-center justify-center group select-none"
            title="Drag to set trim start"
          >
            <div className="w-2 h-6 bg-amber-400 group-active:bg-amber-300 rounded-sm shadow-md flex flex-col items-center justify-center gap-0.5 border border-amber-500">
              <div className="w-0.5 h-1.5 bg-amber-900 rounded-full" />
              <div className="w-0.5 h-1.5 bg-amber-900 rounded-full" />
            </div>
            {trimStart > 0 && (
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-amber-400 whitespace-nowrap pointer-events-none">
                {trimStart.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Trim End Handle */}
          <div
            onPointerDown={(e) => handleTrimHandleDown(e, 'end')}
            className="absolute right-0 top-0 bottom-0 w-4 translate-x-1/2 cursor-ew-resize z-30 flex items-center justify-center group select-none"
            title="Drag to set trim end"
          >
            <div className="w-2 h-6 bg-amber-400 group-active:bg-amber-300 rounded-sm shadow-md flex flex-col items-center justify-center gap-0.5 border border-amber-500">
              <div className="w-0.5 h-1.5 bg-amber-900 rounded-full" />
              <div className="w-0.5 h-1.5 bg-amber-900 rounded-full" />
            </div>
            {trimEnd < safeDuration && (
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-amber-400 whitespace-nowrap pointer-events-none">
                {trimEnd.toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        {/* Playhead Vertical Line */}
        <div
          style={{ left: `${progressPercent}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-30 pointer-events-none"
        >
          <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-amber-400 rounded-full shadow-lg" />
        </div>

        {/* Time Markers */}
        <div className="absolute inset-0 flex justify-between px-2 items-center text-[9px] text-slate-500 font-mono pointer-events-none z-25">
          <span>0s</span>
          <span>{(safeDuration * 0.25).toFixed(1)}s</span>
          <span>{(safeDuration * 0.5).toFixed(1)}s</span>
          <span>{(safeDuration * 0.75).toFixed(1)}s</span>
          <span>{safeDuration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Multi-Layer Visual Tracks */}
      <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto px-0.5">
        {overlays.length === 0 ? (
          <div className="text-center py-2 text-[11px] text-slate-500 italic">
            No active overlays yet. Add Text, Emojis, Pictures, or Price Tags above.
          </div>
        ) : (
          overlays.map(overlay => {
            const isSelected = overlay.id === selectedOverlayId;
            const startPercent = (overlay.startTime / safeDuration) * 100;
            const widthPercent = Math.max(8, ((overlay.endTime - overlay.startTime) / safeDuration) * 100);

            return (
              <div
                key={overlay.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOverlay(overlay.id);
                }}
                className={`relative w-full h-7 rounded-md bg-slate-900/60 border transition-all cursor-pointer ${
                  isSelected ? 'border-amber-400 ring-1 ring-amber-400/40 bg-slate-900' : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Visual Track Bar */}
                <div
                  style={{
                    left: `${startPercent}%`,
                    width: `${widthPercent}%`
                  }}
                  className={`absolute top-0.5 bottom-0.5 rounded px-2 flex items-center justify-between text-[10px] font-bold border truncate shadow ${getOverlayColor(
                    overlay.type
                  )}`}
                >
                  <span className="truncate">{overlay.label || overlay.type}</span>
                  <span className="text-[8px] opacity-80 font-mono hidden sm:inline">
                    {overlay.startTime.toFixed(1)}s - {overlay.endTime.toFixed(1)}s
                  </span>
                </div>

                {/* Adjust Start Time Handle (When Selected) with Snap to Beat */}
                {isSelected && (
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, overlay.endTime - 0.5)}
                    step="0.05"
                    value={overlay.startTime}
                    onChange={(e) => {
                      e.stopPropagation();
                      let newStart = Number(e.target.value);
                      if (isBeatSyncActive && beatMarkers && beatMarkers.length > 0) {
                        const snap = snapTimeToNearestBeat(newStart, beatMarkers, 0.2);
                        if (snap.isSnapped) {
                          newStart = snap.snappedTime;
                        }
                      }
                      onUpdateOverlay(overlay.id, { startTime: newStart });
                    }}
                    className="absolute inset-0 opacity-0 cursor-ew-resize"
                    title={isBeatSyncActive ? "Slide to change timing (Snapping to audio beats)" : "Slide to change timing"}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

