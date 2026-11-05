import React, { useState } from 'react';
import { VideoOverlay } from './types.ts';
import {
  X,
  Store,
  Percent,
  MapPin,
  Ticket,
  ShoppingBag,
  Check,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface MerchantPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  videoDuration: number;
  onAddMerchantOverlay: (overlay: Omit<VideoOverlay, 'id'>) => void;
}

export const MerchantPresetsModal: React.FC<MerchantPresetsModalProps> = ({
  isOpen,
  onClose,
  currentTime,
  videoDuration,
  onAddMerchantOverlay
}) => {
  const [activeType, setActiveType] = useState<'discount' | 'store' | 'coupon'>('discount');

  // Discount Badge state
  const [selectedDiscount, setSelectedDiscount] = useState<string>('50% OFF');
  const [discountLabel, setDiscountLabel] = useState<string>('MEGA SALE');

  // Store Address state
  const [storeName, setStoreName] = useState<string>('Grand Sweets & Bakery');
  const [storeArea, setStoreArea] = useState<string>('Near Clock Tower, Kurnool');

  // Coupon state
  const [couponCode, setCouponCode] = useState<string>('LOCAL20');
  const [couponBenefit, setCouponBenefit] = useState<string>('Flat 20% Discount');

  if (!isOpen) return null;

  const handleApplyDiscount = () => {
    const start = Math.max(0, Math.min(currentTime, Math.max(0, videoDuration - 1)));
    const end = Math.min(videoDuration, start + 8);

    onAddMerchantOverlay({
      type: 'merchant',
      label: `${selectedDiscount} Badge`,
      content: `${discountLabel} • ${selectedDiscount}`,
      startTime: Number(start.toFixed(1)),
      endTime: Number(end.toFixed(1)),
      position: { x: 50, y: 22 }, // Top center
      size: { width: 70, height: 14 },
      rotation: -2,
      opacity: 1.0,
      zIndex: 30,
      animation: {
        entrance: 'bounce',
        exit: 'fade',
        loop: 'pulse'
      },
      metadata: {
        presetType: 'discount',
        discountPercent: parseInt(selectedDiscount) || 50,
        badgeText: `${discountLabel}: ${selectedDiscount}`
      }
    });

    onClose();
  };

  const handleApplyStore = () => {
    const start = 0; // Show store throughout or from current
    const end = videoDuration;

    onAddMerchantOverlay({
      type: 'merchant',
      label: 'Store Location Pill',
      content: storeName,
      startTime: Number(start.toFixed(1)),
      endTime: Number(end.toFixed(1)),
      position: { x: 50, y: 88 }, // Bottom
      size: { width: 85, height: 12 },
      rotation: 0,
      opacity: 1.0,
      zIndex: 25,
      animation: {
        entrance: 'slide-up',
        exit: 'fade'
      },
      metadata: {
        presetType: 'store',
        storeName,
        storeAddress: storeArea
      }
    });

    onClose();
  };

  const handleApplyCoupon = () => {
    const start = Math.max(0, Math.min(currentTime, Math.max(0, videoDuration - 1)));
    const end = Math.min(videoDuration, start + 10);

    onAddMerchantOverlay({
      type: 'coupon',
      label: `Coupon: ${couponCode}`,
      content: couponBenefit,
      startTime: Number(start.toFixed(1)),
      endTime: Number(end.toFixed(1)),
      position: { x: 50, y: 72 },
      size: { width: 80, height: 14 },
      rotation: 0,
      opacity: 1.0,
      zIndex: 30,
      animation: {
        entrance: 'pop',
        exit: 'fade',
        loop: 'glow'
      },
      metadata: {
        presetType: 'coupon',
        couponCode,
        couponBenefit
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
            <Store className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Merchant 1-Tap Selling Presets</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="grid grid-cols-3 p-1.5 bg-slate-950/60 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveType('discount')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeType === 'discount'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            Discount Badge
          </button>
          <button
            onClick={() => setActiveType('store')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeType === 'store'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Store Address
          </button>
          <button
            onClick={() => setActiveType('coupon')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeType === 'coupon'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            Claim Coupon
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Discount Badge */}
          {activeType === 'discount' && (
            <div className="flex flex-col gap-4">
              {/* Preview */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <div className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-sm uppercase tracking-wider shadow-2xl flex items-center gap-2 border border-yellow-300 animate-pulse">
                  <span>🔥 {discountLabel}:</span>
                  <span className="text-base text-yellow-200">{selectedDiscount}</span>
                </div>
              </div>

              {/* Discount Options */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-slate-400 font-semibold">Select Discount:</span>
                <div className="grid grid-cols-4 gap-2">
                  {['10% OFF', '20% OFF', '30% OFF', '50% OFF', 'BUY 1 GET 1', 'FLAT ₹200 OFF', 'FREE DELIVERY', 'FESTIVE SALE'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDiscount(d)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                        selectedDiscount === d
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1 block">Banner Title:</label>
                <input
                  type="text"
                  value={discountLabel}
                  onChange={e => setDiscountLabel(e.target.value)}
                  placeholder="MEGA SALE / LIMITED OFFER"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none uppercase"
                />
              </div>

              <button
                type="button"
                onClick={handleApplyDiscount}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Add Discount Badge to Short
              </button>
            </div>
          )}

          {/* Store Address */}
          {activeType === 'store' && (
            <div className="flex flex-col gap-4">
              {/* Preview */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <div className="px-4 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-amber-500/60 shadow-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-white truncate max-w-[160px]">{storeName}</span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[160px]">{storeArea}</span>
                  </div>
                  <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                    Directions
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Shop / Business Name:</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder="e.g. Hyderabad Biryani House"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Local Address / Landmark:</label>
                  <input
                    type="text"
                    value={storeArea}
                    onChange={e => setStoreArea(e.target.value)}
                    placeholder="e.g. Near Collector Office, Kurnool"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyStore}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Attach Store Location Pill
              </button>
            </div>
          )}

          {/* Claim Coupon */}
          {activeType === 'coupon' && (
            <div className="flex flex-col gap-4">
              {/* Preview */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl flex items-center justify-between gap-3 border border-emerald-400">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-yellow-300" />
                    <div className="flex flex-col">
                      <span className="text-xs font-black">{couponBenefit}</span>
                      <span className="text-[10px] text-emerald-100 font-mono">Use code: {couponCode}</span>
                    </div>
                  </div>
                  <button className="px-2.5 py-1 rounded-lg bg-yellow-400 text-slate-950 font-black text-xs hover:bg-yellow-300 shadow">
                    Claim
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Coupon Offer Description:</label>
                  <input
                    type="text"
                    value={couponBenefit}
                    onChange={e => setCouponBenefit(e.target.value)}
                    placeholder="e.g. Flat 20% Discount / ₹100 Off on Min ₹500"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Promo Code:</label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    placeholder="LOCAL20"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyCoupon}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Add Interactive Coupon Button
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

