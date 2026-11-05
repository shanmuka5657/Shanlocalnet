import React, { useState, useRef, useEffect } from 'react';
import { CustomStickerItem } from './types.ts';
import {
  X,
  Paintbrush,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Upload,
  Check,
  Sparkles,
  FolderHeart,
  Palette
} from 'lucide-react';

interface CustomEmojiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (dataUrl: string, isDrawn?: boolean) => void;
}

const STORAGE_KEY = 'localnet_saved_stickers';

const COLOR_PALETTE = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ffffff', // White
  '#000000', // Black
  '#eab308'  // Gold
];

export const CustomEmojiDrawer: React.FC<CustomEmojiDrawerProps> = ({
  isOpen,
  onClose,
  onSelectSticker
}) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'upload' | 'saved'>('draw');

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [brushColor, setBrushColor] = useState<string>('#f59e0b');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Undo / Redo history
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Saved stickers
  const [savedStickers, setSavedStickers] = useState<CustomStickerItem[]>(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen || activeTab !== 'draw') return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Transparent canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialData]);
      setHistoryIndex(0);
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Drawing Handlers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    }

    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImage);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(history[newIdx], 0, 0);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(history[newIdx], 0, 0);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cleared = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cleared);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Export drawn sticker
  const handleSaveAndApplyDrawn = (saveToCollection = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');

    if (saveToCollection) {
      const newItem: CustomStickerItem = {
        id: `sticker_${Date.now()}`,
        dataUrl,
        createdAt: Date.now(),
        isDrawn: true,
        name: `Emoji ${savedStickers.length + 1}`
      };
      const updated = [newItem, ...savedStickers];
      setSavedStickers(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
      } catch { }
    }

    onSelectSticker(dataUrl, true);
    onClose();
  };

  // Upload sticker from phone gallery
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        const newItem: CustomStickerItem = {
          id: `upload_${Date.now()}`,
          dataUrl,
          createdAt: Date.now(),
          isDrawn: false,
          name: file.name
        };
        const updated = [newItem, ...savedStickers];
        setSavedStickers(updated);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
        } catch { }

        onSelectSticker(dataUrl, false);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = savedStickers.filter(s => s.id !== id);
    setSavedStickers(filtered);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch { }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Custom Emoji & Sticker Studio</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 p-1.5 bg-slate-950/60 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('draw')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === 'draw'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            Draw Emoji
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === 'upload'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Photo
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === 'saved'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <FolderHeart className="w-3.5 h-3.5" />
            My Stickers ({savedStickers.length})
          </button>
        </div>

        {/* Tab 1: Draw Emoji Canvas */}
        {activeTab === 'draw' && (
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
            {/* Transparent Grid Canvas */}
            <div className="relative mx-auto rounded-xl overflow-hidden border-2 border-dashed border-amber-500/40 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
              <canvas
                ref={canvasRef}
                width={320}
                height={320}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                className="touch-none cursor-crosshair block w-64 h-64 sm:w-72 sm:h-72"
              />
            </div>

            {/* Canvas Actions Bar */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEraser(false)}
                  className={`p-2 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors ${!isEraser
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:bg-slate-800'
                    }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  Brush
                </button>
                <button
                  type="button"
                  onClick={() => setIsEraser(true)}
                  className={`p-2 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors ${isEraser
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'text-slate-400 hover:bg-slate-800'
                    }`}
                >
                  <Eraser className="w-4 h-4" />
                  Eraser
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={historyIndex <= 0}
                  onClick={handleUndo}
                  className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800"
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={historyIndex >= history.length - 1}
                  onClick={handleRedo}
                  className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800"
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-2 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40"
                  title="Clear All"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Brush Size Slider */}
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs text-slate-400 w-16">Size: {brushSize}px</span>
              <input
                type="range"
                min="2"
                max="28"
                value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
                className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Color Palette */}
            {!isEraser && (
              <div className="flex items-center gap-1.5 flex-wrap px-1">
                {COLOR_PALETTE.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBrushColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${brushColor === color ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
                      }`}
                  />
                ))}
              </div>
            )}

            {/* Use Sticker Button */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleSaveAndApplyDrawn(true)}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Add to Short & Save
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Upload Photo to Sticker */}
        {activeTab === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Upload from Phone Gallery</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Select any photo, logo, dish, product, or sticker from your device to place inside your video.
              </p>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleUploadImage}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Choose Photo from Device
            </button>
          </div>
        )}

        {/* Tab 3: My Stickers Collection */}
        {activeTab === 'saved' && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            {savedStickers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <FolderHeart className="w-12 h-12 mb-2 text-slate-600" />
                <p className="text-sm font-medium">No saved custom emojis yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Draw an emoji or upload a photo to save it here for instant reuse in all your future shorts.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {savedStickers.map(stk => (
                  <div
                    key={stk.id}
                    onClick={() => {
                      onSelectSticker(stk.dataUrl, stk.isDrawn);
                      onClose();
                    }}
                    className="group relative aspect-square rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 p-2 cursor-pointer transition-all flex items-center justify-center overflow-hidden"
                  >
                    <img
                      src={stk.dataUrl}
                      alt="Custom Sticker"
                      className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-md"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSaved(stk.id, e)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete sticker"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

