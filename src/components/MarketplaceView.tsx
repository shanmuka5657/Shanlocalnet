import React, { useState } from 'react';
import { MarketplaceListing } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import {
  ShoppingBag,
  MapPin,
  ShieldCheck,
  Phone,
  Tag,
  CheckCircle2,
  XCircle,
  Truck
} from 'lucide-react';

interface MarketplaceViewProps {
  items: {
    item: MarketplaceListing;
    distanceKm: number;
    isWithinDeliveryRadius: boolean;
  }[];
  onOpenLocationModal: () => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  items,
  onOpenLocationModal
}) => {
  const { viewerLocation } = useLocation();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [inquiryModalItem, setInquiryModalItem] = useState<MarketplaceListing | null>(null);
  const [inquirySent, setInquirySent] = useState(false);

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'Handicrafts & Fashion', label: 'Handloom & Fashion' },
    { id: 'Food & Groceries', label: 'Farm Produce & Food' },
    { id: 'Electronics', label: 'Tech & Electronics' }
  ];

  const filteredItems = items.filter(entry => {
    if (selectedCategory === 'all') return true;
    return entry.item.category === selectedCategory;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <ShoppingBag className="w-4 h-4" />
            <span>Hyperlocal Marketplace</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Local Goods & Artisan Produce in {viewerLocation.cityName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Commerce is strictly delivered within verified 40 km radius limits.
          </p>
        </div>

        <button
          onClick={onOpenLocationModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition-colors shrink-0"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-500" />
          <span>Change Location</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-colors ${
              selectedCategory === c.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid of Listings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredItems.map(({ item, distanceKm, isWithinDeliveryRadius }) => (
          <div
            key={item.id}
            className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
              isWithinDeliveryRadius
                ? 'border-slate-200/80 dark:border-slate-800 hover:shadow-md'
                : 'border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            {/* Visual Cover Header */}
            <div className={`h-40 bg-gradient-to-br ${item.coverGradient} p-4 flex flex-col justify-between text-white relative`}>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider">
                  {item.category}
                </span>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                  isWithinDeliveryRadius
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}>
                  {distanceKm} km away
                </span>
              </div>

              <div>
                <span className="text-2xl font-black font-mono">
                  ₹{item.price.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                  {item.title}
                </h3>
                
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                  {item.description}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-medium">
                    {item.sellerName}
                    {item.sellerVerified && (
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </span>
                  <span>{item.cityName}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Truck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Delivery ≤ {item.maxDeliveryRadiusKm}km</span>
                </div>

                <button
                  onClick={() => {
                    setInquiryModalItem(item);
                    setInquirySent(false);
                  }}
                  disabled={!isWithinDeliveryRadius}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    isWithinDeliveryRadius
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isWithinDeliveryRadius ? 'Buy / Inquire' : 'Out of 40km Range'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Inquiry Dialog */}
      {inquiryModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Connect with {inquiryModalItem.sellerName}
            </h3>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {inquiryModalItem.title}
              </p>
              <p className="text-amber-600 dark:text-amber-400 font-bold font-mono text-sm">
                ₹{inquiryModalItem.price.toLocaleString()}
              </p>
              <p className="text-slate-500">
                Seller Contact: {inquiryModalItem.contactPhone}
              </p>
            </div>

            {inquirySent ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Inquiry dispatched! Seller will contact you within your local area.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  defaultValue={`Hi ${inquiryModalItem.sellerName}, I am in ${viewerLocation.cityName} and would like to order "${inquiryModalItem.title}". Is it available for immediate delivery?`}
                  className="w-full p-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setInquiryModalItem(null)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setInquirySent(true)}
                    className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm"
                  >
                    Send Order Message
                  </button>
                </div>
              </div>
            )}

            {inquirySent && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setInquiryModalItem(null)}
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
