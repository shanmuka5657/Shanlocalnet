import React, { useState } from 'react';
import { VideoOverlay } from './types.ts';
import {
  X,
  Type,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Sparkles
} from 'lucide-react';

interface TextOverlayEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  videoDuration: number;
  onAddTextOverlay: (overlay: Omit<VideoOverlay, 'id'>) => void;
  initialOverlay?: VideoOverlay | null;
}

const FONT_PRESETS = [
  { id: 'sans', name: 'Modern Sans', style: 'font-sans' },
  { id: 'serif', name: 'Classic Serif', style: 'font-serif' },
  { id: 'mono', name: 'Typewriter', style: 'font-mono' },
  { id: 'impact', name: 'Bold Impact', style: 'font-black tracking-tight uppercase' },
  { id: 'glow', name: 'Neon Glow', style: 'font-bold tracking-wide' }
];

const STYLE_TEMPLATES = [
  {
    id: 'pill_dark',
    name: 'Pill Dark',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    textShadow: 'none'
  },
  {
    id: 'pill_amber',
    name: 'Amber Gold',
    color: '#0f172a',
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    textShadow: 'none'
  },
  {
    id: 'neon_red',
    name: 'Neon Red',
    color: '#ffffff',
    backgroundColor: 'transparent',
    borderRadius: 0,
    textShadow: '0 0 10px #ef4444, 0 0 20px #ef4444'
  },
  {
    id: 'outline',
    name: 'Subtitle Clean',
    color: '#ffffff',
    backgroundColor: 'transparent',
    borderRadius: 0,
    textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)'
  }
];

export const TextOverlayEditor: React.FC<TextOverlayEditorProps> = ({
  isOpen,
  onClose,
  currentTime,
  videoDuration,
  onAddTextOverlay,
  initialOverlay
}) => {
  const [text, setText] = useState<string>(initialOverlay?.content || '');
  const [textColor, setTextColor] = useState<string>(initialOverlay?.style?.color || '#ffffff');
  const [bgColor, setBgColor] = useState<string>(initialOverlay?.style?.backgroundColor || 'rgba(0,0,0,0.75)');
  const [fontSize, setFontSize] = useState<number>(initialOverlay?.style?.fontSize || 22);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(initialOverlay?.style?.textAlign || 'center');
  const [isBold, setIsBold] = useState<boolean>(true);
  const [textShadow, setTextShadow] = useState<string>(initialOverlay?.style?.textShadow || 'none');
  const [borderRadius, setBorderRadius] = useState<number>(initialOverlay?.style?.borderRadius ?? 8);
  const [durationSec, setDurationSec] = useState<number>(
    initialOverlay ? (initialOverlay.endTime - initialOverlay.startTime) : 8
  );

  if (!isOpen) return null;

  const handleApply = () => {
    if (!text.trim()) return;

    const start = initialOverlay ? initialOverlay.startTime : Math.max(0, Math.min(currentTime, Math.max(0, videoDuration - 1)));
    const end = Math.min(videoDuration, start + durationSec);

    onAddTextOverlay({
      type: 'text',
      label: text.slice(0, 14),
      content: text,
      startTime: Number(start.toFixed(1)),
      endTime: Number(end.toFixed(1)),
      position: initialOverlay?.position || { x: 50, y: 70 }, // Lower-third by default
      size: initialOverlay?.size || { width: 80, height: 18 },
      rotation: initialOverlay?.rotation || 0,
      opacity: initialOverlay?.opacity || 1.0,
      zIndex: initialOverlay?.zIndex || 20,
      style: {
        color: textColor,
        backgroundColor: bgColor,
        fontSize,
        fontWeight: isBold ? 800 : 500,
        textAlign,
        borderRadius,
        textShadow
      },
      animation: {
        entrance: 'pop',
        exit: 'fade'
      }
    });

    setText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Add Styled Text Overlay</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Live Text Preview Box */}
          <div className="min-h-24 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
            <div
              style={{
                color: textColor,
                backgroundColor: bgColor,
                fontSize: `${fontSize}px`,
                fontWeight: isBold ? 800 : 500,
                textAlign,
                borderRadius: `${borderRadius}px`,
                textShadow,
                padding: bgColor !== 'transparent' ? '6px 16px' : '0'
              }}
              className="max-w-full break-words select-none leading-snug"
            >
              {text || 'Type your caption here...'}
            </div>
          </div>

          {/* Text Input */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter text (e.g., Grand Opening, 50% OFF, Visit Today)..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white placeholder-slate-500 text-sm outline-none resize-none"
            autoFocus
          />

          {/* Style Presets */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-400 font-semibold">Quick Text Styles:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STYLE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setTextColor(tpl.color);
                    setBgColor(tpl.backgroundColor);
                    setBorderRadius(tpl.borderRadius);
                    setTextShadow(tpl.textShadow);
                  }}
                  className="px-2 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500 text-xs text-white text-center font-medium transition-colors"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Formatting Controls */}
          <div className="flex items-center justify-between gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            {/* Alignment */}
            <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setTextAlign('left')}
                className={`p-1.5 rounded ${textAlign === 'left' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTextAlign('center')}
                className={`p-1.5 rounded ${textAlign === 'center' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTextAlign('right')}
                className={`p-1.5 rounded ${textAlign === 'right' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bold Toggle */}
            <button
              type="button"
              onClick={() => setIsBold(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                isBold ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
              Bold
            </button>

            {/* Font Size */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Size:</span>
              <input
                type="range"
                min="14"
                max="38"
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="w-20 accent-amber-500 h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          {/* Color Choices */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">Text Color:</span>
            <div className="flex items-center gap-2">
              {['#ffffff', '#f59e0b', '#ef4444', '#10b981', '#38bdf8', '#000000'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTextColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full border ${textColor === c ? 'ring-2 ring-amber-400 scale-110' : 'border-slate-700'}`}
                />
              ))}
            </div>
          </div>

          {/* Apply Button */}
          <button
            type="button"
            disabled={!text.trim()}
            onClick={handleApply}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Add Text to Video ({durationSec}s Duration)
          </button>
        </div>
      </div>
    </div>
  );
};
