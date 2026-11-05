import React, { useRef, useState, useEffect } from 'react';
import { VideoOverlay } from './types.ts';
import { FILTER_PRESETS } from './FilterAudioControls.tsx';
import { X, RotateCw, Maximize2, Trash2, Sparkles, MapPin, Ticket, ShoppingBag } from 'lucide-react';

interface StudioCanvasProps {
  videoUrl: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onTogglePlay: () => void;
  overlays: VideoOverlay[];
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
  onUpdateOverlay: (id: string, updates: Partial<VideoOverlay>) => void;
  onDeleteOverlay: (id: string) => void;
  activeFilterId: string;
  brightness: number;
  contrast: number;
  saturation: number;
  playbackSpeed: number;
  originalAudioVolume: number;
  isOriginalAudioMuted: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  videoUrl,
  currentTime,
  duration,
  isPlaying,
  onTimeUpdate,
  onTogglePlay,
  overlays,
  selectedOverlayId,
  onSelectOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  activeFilterId,
  brightness,
  contrast,
  saturation,
  playbackSpeed,
  originalAudioVolume,
  isOriginalAudioMuted,
  videoRef
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interaction dragging states
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; origPosX: number; origPosY: number; origWidth: number; origRotation: number }>({
    startX: 0,
    startY: 0,
    origPosX: 50,
    origPosY: 50,
    origWidth: 50,
    origRotation: 0
  });

  // Calculate composite CSS filter string
  const activePreset = FILTER_PRESETS.find(p => p.id === activeFilterId);
  const presetFilter = activePreset && activePreset.id !== 'normal' ? activePreset.cssFilter : '';
  const fineFilter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
  const finalCssFilter = [presetFilter, fineFilter].filter(Boolean).join(' ');

  // Synchronize playback speed and audio
  useEffect(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.playbackRate = playbackSpeed;
      vid.volume = isOriginalAudioMuted ? 0 : originalAudioVolume;
      vid.muted = isOriginalAudioMuted;
    }
  }, [playbackSpeed, originalAudioVolume, isOriginalAudioMuted]);

  // Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent, overlay: VideoOverlay) => {
    e.stopPropagation();
    onSelectOverlay(overlay.id);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPosX: overlay.position.x,
      origPosY: overlay.position.y,
      origWidth: overlay.size.width,
      origRotation: overlay.rotation || 0
    };
    setIsDragging(true);
  };

  const handleResizeStart = (e: React.PointerEvent, overlay: VideoOverlay) => {
    e.stopPropagation();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPosX: overlay.position.x,
      origPosY: overlay.position.y,
      origWidth: overlay.size.width,
      origRotation: overlay.rotation || 0
    };
    setIsResizing(true);
  };

  const handleRotateStart = (e: React.PointerEvent, overlay: VideoOverlay) => {
    e.stopPropagation();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPosX: overlay.position.x,
      origPosY: overlay.position.y,
      origWidth: overlay.size.width,
      origRotation: overlay.rotation || 0
    };
    setIsRotating(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!selectedOverlayId) return;
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (!overlay || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    if (isDragging) {
      const deltaXPercent = ((e.clientX - dragStartRef.current.startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStartRef.current.startY) / rect.height) * 100;

      const newX = Math.max(5, Math.min(95, dragStartRef.current.origPosX + deltaXPercent));
      const newY = Math.max(5, Math.min(95, dragStartRef.current.origPosY + deltaYPercent));

      onUpdateOverlay(selectedOverlayId, {
        position: { x: Number(newX.toFixed(1)), y: Number(newY.toFixed(1)) }
      });
    } else if (isResizing) {
      const deltaXPercent = ((e.clientX - dragStartRef.current.startX) / rect.width) * 100;
      const newWidth = Math.max(15, Math.min(95, dragStartRef.current.origWidth + deltaXPercent));

      onUpdateOverlay(selectedOverlayId, {
        size: { ...overlay.size, width: Number(newWidth.toFixed(1)) }
      });
    } else if (isRotating) {
      const deltaY = e.clientY - dragStartRef.current.startY;
      const newRot = (dragStartRef.current.origRotation + deltaY * 0.8) % 360;

      onUpdateOverlay(selectedOverlayId, {
        rotation: Math.round(newRot)
      });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => onSelectOverlay(null)}
      className="relative w-full max-w-[340px] aspect-[9/16] mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 touch-none select-none flex items-center justify-center"
    >
      {/* Underlying Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={() => {
          if (videoRef.current) {
            onTimeUpdate(videoRef.current.currentTime);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        style={{ filter: finalCssFilter }}
        className="w-full h-full object-cover cursor-pointer"
      />

      {/* Render Active Overlays */}
      {overlays.map(overlay => {
        // Evaluate Visibility according to Multi-Layer Timeline Engine
        const isVisible = currentTime >= overlay.startTime && currentTime <= overlay.endTime;
        if (!isVisible) return null;

        const isSelected = overlay.id === selectedOverlayId;

        return (
          <div
            key={overlay.id}
            onPointerDown={(e) => handlePointerDown(e, overlay)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectOverlay(overlay.id);
            }}
            style={{
              left: `${overlay.position.x}%`,
              top: `${overlay.position.y}%`,
              width: `${overlay.size.width}%`,
              transform: `translate(-50%, -50%) rotate(${overlay.rotation || 0}deg)`,
              opacity: overlay.opacity ?? 1,
              zIndex: overlay.zIndex || 10
            }}
            className={`absolute flex items-center justify-center cursor-move transition-shadow ${
              isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black/50 shadow-2xl' : 'hover:ring-1 hover:ring-white/40'
            }`}
          >
            {/* 1. TEXT OVERLAY */}
            {overlay.type === 'text' && (
              <div
                style={{
                  color: overlay.style?.color || '#ffffff',
                  backgroundColor: overlay.style?.backgroundColor || 'rgba(0,0,0,0.7)',
                  fontSize: `${(overlay.style?.fontSize || 20) * 0.75}px`,
                  fontWeight: overlay.style?.fontWeight || 700,
                  textAlign: overlay.style?.textAlign || 'center',
                  borderRadius: `${overlay.style?.borderRadius || 6}px`,
                  textShadow: overlay.style?.textShadow || 'none',
                  padding: overlay.style?.backgroundColor !== 'transparent' ? '4px 10px' : '0'
                }}
                className="w-full break-words leading-tight"
              >
                {overlay.content}
              </div>
            )}

            {/* 2. IMAGE OR STICKER OVERLAY */}
            {(overlay.type === 'image' || overlay.type === 'emoji' || overlay.type === 'sticker') && overlay.assetUrl && (
              <img
                src={overlay.assetUrl}
                alt={overlay.label || 'Overlay'}
                style={{
                  borderRadius: `${overlay.style?.borderRadius ?? (overlay.type === 'image' ? 12 : 0)}px`,
                  border: overlay.style?.borderWidth ? `${overlay.style.borderWidth}px solid ${overlay.style.borderColor}` : 'none',
                  boxShadow: overlay.style?.boxShadow || 'none'
                }}
                className="w-full h-auto object-contain pointer-events-none drop-shadow-lg"
              />
            )}

            {/* 3. PRICE TAG OVERLAY */}
            {overlay.type === 'price' && overlay.metadata && (
              <div className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-xl border border-yellow-300 flex items-center justify-between gap-1 pointer-events-none">
                <div className="flex flex-col text-left truncate">
                  <span className="text-[10px] font-bold uppercase truncate max-w-[120px]">
                    {overlay.metadata.productName || 'Special Item'}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-black">₹{overlay.metadata.discountPrice}</span>
                    {overlay.metadata.originalPrice > overlay.metadata.discountPrice && (
                      <span className="text-[9px] line-through opacity-70">₹{overlay.metadata.originalPrice}</span>
                    )}
                  </div>
                </div>
                {overlay.metadata.discountPercent > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-black text-white uppercase">
                    {overlay.metadata.discountPercent}% OFF
                  </span>
                )}
              </div>
            )}

            {/* 4. MERCHANT DISCOUNT BADGE */}
            {overlay.type === 'merchant' && overlay.metadata?.presetType === 'discount' && (
              <div className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-2xl flex items-center justify-center gap-1.5 border border-yellow-300 pointer-events-none animate-pulse">
                <span>🔥 {overlay.metadata.badgeText || overlay.content}</span>
              </div>
            )}

            {/* 5. MERCHANT STORE LOCATION PILL */}
            {overlay.type === 'merchant' && overlay.metadata?.presetType === 'store' && (
              <div className="w-full px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-amber-500/70 shadow-xl flex items-center gap-2 pointer-events-none text-left">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex flex-col truncate">
                  <span className="text-[11px] font-bold text-white truncate">{overlay.metadata.storeName}</span>
                  <span className="text-[9px] text-slate-400 truncate">{overlay.metadata.storeAddress}</span>
                </div>
              </div>
            )}

            {/* 6. CLAIM COUPON OVERLAY */}
            {overlay.type === 'coupon' && (
              <div className="w-full px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl flex items-center justify-between gap-2 border border-emerald-400 pointer-events-none">
                <div className="flex items-center gap-1.5 truncate">
                  <Ticket className="w-4 h-4 text-yellow-300 shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="text-[10px] font-black truncate">{overlay.content}</span>
                    <span className="text-[8px] font-mono text-emerald-100">Code: {overlay.metadata?.couponCode}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-yellow-400 text-slate-950 font-black text-[9px]">
                  Claim
                </span>
              </div>
            )}

            {/* Selection Controls (Delete, Resize, Rotate) */}
            {isSelected && (
              <>
                {/* Delete button (Top-Right) */}
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onDeleteOverlay(overlay.id);
                  }}
                  className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-transform cursor-pointer z-30"
                  title="Remove this element"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Resize handle (Bottom-Right) */}
                <div
                  onPointerDown={(e) => handleResizeStart(e, overlay)}
                  className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md cursor-se-resize hover:scale-110 z-30"
                  title="Drag to resize"
                >
                  <Maximize2 className="w-3 h-3" />
                </div>

                {/* Rotate handle (Bottom-Left) */}
                <div
                  onPointerDown={(e) => handleRotateStart(e, overlay)}
                  className="absolute -bottom-2 -left-2 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-md cursor-grab hover:scale-110 z-30"
                  title="Drag to rotate"
                >
                  <RotateCw className="w-3 h-3" />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
