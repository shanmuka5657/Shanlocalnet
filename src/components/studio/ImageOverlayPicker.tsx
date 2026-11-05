import React, { useState, useRef } from 'react';
import { VideoOverlay } from './types.ts';
import {
  X,
  Image as ImageIcon,
  Check,
  Sliders,
  Sparkles,
  Layers
} from 'lucide-react';

interface ImageOverlayPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  videoDuration: number;
  onAddImageOverlay: (overlay: Omit<VideoOverlay, 'id'>) => void;
}

export const ImageOverlayPicker: React.FC<ImageOverlayPickerProps> = ({
  isOpen,
  onClose,
  currentTime,
  videoDuration,
  onAddImageOverlay
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [borderRadius, setBorderRadius] = useState<number>(16);
  const [borderWidth, setBorderWidth] = useState<number>(2);
  const [borderColor, setBorderColor] = useState<string>('#f59e0b');
  const [hasShadow, setHasShadow] = useState<boolean>(true);
  const [opacity, setOpacity] = useState<number>(1.0);
  const [durationSec, setDurationSec] = useState<number>(6); // Default 6 seconds visible

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (!selectedImage) return;

    const start = Math.max(0, Math.min(currentTime, Math.max(0, videoDuration - 1)));
    const end = Math.min(videoDuration, start + durationSec);

    onAddImageOverlay({
      type: 'image',
      label: 'Photo Overlay',
      assetUrl: selectedImage,
      startTime: Number(start.toFixed(1)),
      endTime: Number(end.toFixed(1)),
      position: { x: 50, y: 35 }, // Center-top by default
      size: { width: 45, height: 45 },
      rotation: 0,
      opacity,
      zIndex: 10,
      style: {
        borderRadius,
        borderColor: borderWidth > 0 ? borderColor : 'transparent',
        borderWidth,
        boxShadow: hasShadow ? '0 8px 24px rgba(0,0,0,0.6)' : 'none'
      },
      animation: {
        entrance: 'pop',
        exit: 'fade'
      }
    });

    setSelectedImage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Insert Picture Inside Video</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
          {!selectedImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-slate-950/40"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ImageIcon className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">Choose Picture from Gallery</p>
                <p className="text-xs text-slate-400 mt-1">
                  Food photos, products, logos, before & after shots, or proof
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Picture Preview */}
              <div className="relative aspect-video max-h-48 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden p-2">
                <img
                  src={selectedImage}
                  alt="Overlay Preview"
                  style={{
                    borderRadius: `${borderRadius}px`,
                    border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none',
                    boxShadow: hasShadow ? '0 8px 24px rgba(0,0,0,0.6)' : 'none',
                    opacity
                  }}
                  className="max-h-full max-w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-black/70 text-xs text-slate-300 hover:text-white"
                >
                  Change Photo
                </button>
              </div>

              {/* Style Controls */}
              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex flex-col gap-3 text-xs">
                {/* Visible Duration */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Display Duration:</span>
                  <div className="flex items-center gap-1.5">
                    {[3, 6, 10, 15].map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setDurationSec(sec)}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          durationSec === sec
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Corner Radius */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Corners:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBorderRadius(0)}
                      className={`px-2 py-1 rounded-md ${borderRadius === 0 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}
                    >
                      Square
                    </button>
                    <button
                      type="button"
                      onClick={() => setBorderRadius(16)}
                      className={`px-2 py-1 rounded-md ${borderRadius === 16 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}
                    >
                      Rounded
                    </button>
                    <button
                      type="button"
                      onClick={() => setBorderRadius(999)}
                      className={`px-2 py-1 rounded-md ${borderRadius === 999 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}
                    >
                      Circle
                    </button>
                  </div>
                </div>

                {/* Border & Shadow */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Border Accent:</span>
                  <div className="flex items-center gap-1.5">
                    {['#f59e0b', '#ffffff', '#ef4444', '#10b981', '#000000'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setBorderColor(c);
                          if (borderWidth === 0) setBorderWidth(2);
                        }}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full border ${borderColor === c && borderWidth > 0 ? 'ring-2 ring-amber-400 scale-110' : 'border-slate-700'}`}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setBorderWidth(borderWidth === 0 ? 2 : 0)}
                      className={`px-2 py-0.5 rounded text-[10px] ${borderWidth === 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {borderWidth === 0 ? 'No Border' : 'Border On'}
                    </button>
                  </div>
                </div>

                {/* Transparency */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-20">Opacity: {Math.round(opacity * 100)}%</span>
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={opacity}
                    onChange={e => setOpacity(Number(e.target.value))}
                    className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={handleApply}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Insert Picture into Video (at {currentTime.toFixed(1)}s)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

