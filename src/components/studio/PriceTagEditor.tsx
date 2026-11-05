import React, { useState } from 'react';
import { VideoOverlay } from './types.ts';
import {
  X,
  Tag,
  Check,
  Percent,
  Clock,
  Sparkles,
  ShoppingBag
} from 'lucide-react';

interface PriceTagEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  videoDuration: number;
  onAddPriceTag: (overlay: Omit<VideoOverlay, 'id'>) => void;
}

const TAG_STYLES = [
  {
    id: 'gold_badge',
    name: 'Festive Gold',
    bg: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950',
    border: 'border-yellow-400'
  },
  {
    id: 'red_sale',
    name: 'Red Flash Sale',
    bg: 'bg-gradient-to-r from-red-600 to-rose-600 text-white',
    border: 'border-red-400'
  },
  {
    id: 'dark_neon',
    name: 'Dark Emerald',
    bg: 'bg-slate-950 text-emerald-400 border border-emerald-500/50',
    border: 'border-emerald-500'
  }
];

export const PriceTagEditor: React.FC<PriceTagEditorProps> = ({
  isOpen,
  onClose,
  currentTime,
  videoDuration,
  onAddPriceTag
}) => {
  const [productName, setProductName] = useState('');
  const [originalPrice, setOriginalPrice] = useState<string>('999');
  const [offerPrice, setOfferPrice] = useState<string>('499');
  const [expiryText, setExpiryText] = useState('Today Only');
  const [selectedStyle, setSelectedStyle] = useState(TAG_STYLES[0]);
  const [durationSec, setDurationSec] = useState<number>(8);

  if (!isOpen) return null;

  const origNum = Number(originalPrice) || 0;
  const offerNum = Number(offerPrice) || 0;
  const discountPercent = origNum > offerNum && origNum > 0
    ? Math.round(((origNum - offerNum) / origNum) * 100)
    : 0;

  const handleApply = () => {
    if (!offerPrice) return;

    const start = Math.max(0, Math.min(currentTime, Math.max(0, videoDuration - 1)));
    const end = Math.min(videoDuration, start + durationSec);

    onAddPriceTag({
      type: 'price',
      label: productName || `₹${offerPrice}`,
      content: productName || 'Special Offer',
      startTime: Number(start.toFixed(1)),
      endTime: Number(end.toFixed(1)),
      position: { x: 50, y: 78 }, // Bottom center
      size: { width: 75, height: 16 },
      rotation: 0,
      opacity: 1.0,
      zIndex: 25,
      animation: {
        entrance: 'pop',
        exit: 'fade',
        loop: 'pulse'
      },
      metadata: {
        productName: productName || 'Product Offer',
        originalPrice: origNum,
        discountPrice: offerNum,
        discountPercent,
        expiryText,
        styleId: selectedStyle.id
      }
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Create Price & Offer Tag</h3>
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
          {/* Live Price Tag Preview */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
            <div className={`px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 border ${selectedStyle.bg} ${selectedStyle.border}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold opacity-80 uppercase tracking-wider truncate max-w-[140px]">
                  {productName || 'Special Item'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black">₹{offerPrice || '0'}</span>
                  {origNum > offerNum && (
                    <span className="text-xs line-through opacity-70 font-medium">
                      ₹{originalPrice}
                    </span>
                  )}
                </div>
              </div>

              {discountPercent > 0 && (
                <div className="px-2 py-1 rounded-lg bg-black/30 backdrop-blur-sm text-[11px] font-black uppercase tracking-tight flex items-center gap-0.5">
                  <Percent className="w-3 h-3" />
                  {discountPercent}% OFF
                </div>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">
                Product / Item Name (Optional):
              </label>
              <input
                type="text"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="e.g., Dum Biryani / Cotton Shirt / Hair Spa"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">
                  Original Price (₹):
                </label>
                <input
                  type="number"
                  value={originalPrice}
                  onChange={e => setOriginalPrice(e.target.value)}
                  placeholder="999"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-amber-400 mb-1 block">
                  Offer Price (₹):
                </label>
                <input
                  type="number"
                  value={offerPrice}
                  onChange={e => setOfferPrice(e.target.value)}
                  placeholder="499"
                  className="w-full bg-slate-950 border border-amber-500/60 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">
                Expiry Badge / Urgency Tag:
              </label>
              <div className="flex items-center gap-1.5">
                {['Today Only', 'Weekend Special', 'Limited Stock', 'Festive Offer'].map(txt => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => setExpiryText(txt)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                      expiryText === txt
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {txt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">
                Visual Badge Style:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TAG_STYLES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStyle(s)}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedStyle.id === s.id
                        ? 'border-amber-400 ring-2 ring-amber-400/40'
                        : 'border-slate-800 opacity-60'
                    } ${s.bg}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <button
            type="button"
            disabled={!offerPrice}
            onClick={handleApply}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Add Price Tag to Video
          </button>
        </div>
      </div>
    </div>
  );
};

