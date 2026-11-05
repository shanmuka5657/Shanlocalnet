import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Image as ImageIcon,
  Check,
  Upload,
  Sparkles,
  Camera,
  Layers
} from 'lucide-react';

interface PosterGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoDuration: number;
  initialPosterUrl?: string;
  initialTimestamp?: number;
  onConfirmPoster: (posterDataUrl: string, timestamp: number) => void;
}

export const PosterGeneratorModal: React.FC<PosterGeneratorModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  videoDuration,
  initialPosterUrl,
  initialTimestamp = 0.5,
  onConfirmPoster
}) => {
  const [selectedTimestamp, setSelectedTimestamp] = useState<number>(initialTimestamp);
  const [currentPosterUrl, setCurrentPosterUrl] = useState<string>(initialPosterUrl || '');
  const [isCustomUpload, setIsCustomUpload] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-extract frame when timestamp slider moves
  const extractFrameAtTime = (time: number) => {
    setSelectedTimestamp(time);
    setIsCustomUpload(false);
    setIsExtracting(true);

    const vid = videoRef.current;
    if (!vid) return;

    vid.currentTime = time;
    vid.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const targetW = 480;
        const targetH = Math.round((targetW * (vid.videoHeight || 1920)) / (vid.videoWidth || 1080));
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(vid, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/webp', 0.82);
          setCurrentPosterUrl(dataUrl);
        }
      } catch (e) {
        console.warn('Poster extraction error:', e);
      } finally {
        setIsExtracting(false);
      }
    };
  };

  useEffect(() => {
    if (isOpen && videoUrl) {
      extractFrameAtTime(initialTimestamp);
    }
  }, [isOpen, videoUrl]);

  if (!isOpen) return null;

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCurrentPosterUrl(reader.result);
        setIsCustomUpload(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!currentPosterUrl) return;
    onConfirmPoster(currentPosterUrl, selectedTimestamp);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Hidden video element for seeking frames */}
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted
          crossOrigin="anonymous"
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Select Video Cover Frame</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto items-center">
          {/* Cover Preview (9:16 Aspect Ratio) */}
          <div className="relative w-44 aspect-[9/16] rounded-xl bg-slate-950 border-2 border-amber-500/60 overflow-hidden shadow-2xl flex items-center justify-center">
            {currentPosterUrl ? (
              <img
                src={currentPosterUrl}
                alt="Selected Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-slate-500 text-xs flex flex-col items-center gap-1">
                <Sparkles className="w-6 h-6 animate-spin text-amber-400" />
                <span>Extracting Cover...</span>
              </div>
            )}

            {isExtracting && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-xs">
                <Sparkles className="w-6 h-6 animate-pulse text-amber-400" />
              </div>
            )}

            <div className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] text-white/90 text-center font-mono font-bold">
              {isCustomUpload ? 'Custom Photo Cover' : `Frame: ${selectedTimestamp.toFixed(1)}s`}
            </div>
          </div>

          {/* Frame Scrubber Slider */}
          <div className="w-full flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400">Drag to choose frame:</span>
              <span className="text-amber-400 font-mono">{selectedTimestamp.toFixed(1)}s / {videoDuration.toFixed(1)}s</span>
            </div>

            <input
              type="range"
              min="0"
              max={Math.max(0.1, videoDuration)}
              step="0.2"
              value={selectedTimestamp}
              onChange={e => extractFrameAtTime(Number(e.target.value))}
              className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Or Upload Custom Poster */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleCustomUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            Upload Custom Image from Phone Gallery
          </button>

          {/* Save Button */}
          <button
            type="button"
            disabled={!currentPosterUrl}
            onClick={handleSave}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Set as Video Cover
          </button>
        </div>
      </div>
    </div>
  );
};
