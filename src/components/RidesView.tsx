import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from '../context/LocationContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { RideListing, VehicleType } from '../types/index.ts';
import { OfferRideModal } from './OfferRideModal.tsx';
import {
  Car, Bike, Truck, MapPin, Clock, Calendar, Users, IndianRupee,
  Star, ShieldCheck, Search, Plus, ArrowRight, RefreshCw,
  Navigation, Info, CheckCircle2, X, AlertCircle, Loader2, Repeat2
} from 'lucide-react';

interface RidesViewProps {
  onRidePosted?: (ride: RideListing) => void;
}

// ── Vehicle helpers ────────────────────────────────────────────────────────
const VEHICLE_ICONS: Record<VehicleType, React.ReactNode> = {
  bike: <Bike className="w-3.5 h-3.5" />,
  auto: <Car className="w-3.5 h-3.5" />,
  car: <Car className="w-3.5 h-3.5" />,
  suv: <Truck className="w-3.5 h-3.5" />,
  van: <Truck className="w-3.5 h-3.5" />,
};

const VEHICLE_COLOR: Record<VehicleType, string> = {
  bike: 'text-orange-500 bg-orange-50 dark:bg-orange-950/30',
  auto: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
  car: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  suv: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
  van: 'text-slate-600 bg-slate-100 dark:bg-slate-800',
};

const AP_CITIES = [
  'Kurnool', 'Hyderabad', 'Bengaluru', 'Vijayawada', 'Nandyal',
  'Tirupati', 'Guntur', 'Ongole', 'Adoni', 'Cuddapah',
  'Bellary', 'Anantapur', 'Nellore', 'Visakhapatnam', 'Secunderabad',
  'Warangal', 'Chennai', 'Mumbai', 'Rajahmundry', 'Karimnagar',
];

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const d = new Date(dateStr + 'T00:00:00');
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ── Booking Modal ──────────────────────────────────────────────────────────
const BookingModal: React.FC<{
  ride: RideListing;
  onClose: () => void;
  onConfirm: (seats: number) => Promise<void>;
}> = ({ ride, onClose, onConfirm }) => {
  const [seats, setSeats] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setIsBooking(true);
    setError('');
    try {
      await onConfirm(seats);
      setConfirmed(true);
      setTimeout(onClose, 1600);
    } catch (err: any) {
      setError(err.message || 'Booking failed. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm">
      <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />

        {confirmed ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
            <p className="font-black text-slate-900 dark:text-white text-xl">Seat Booked!</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs">
              {seats} seat{seats > 1 ? 's' : ''} with <strong>{ride.driverName}</strong><br />
              {formatDate(ride.departureDate)} at {formatTime(ride.departureTime)}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Confirm Booking</h3>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-1 text-xs">
              <p className="font-bold text-slate-800 dark:text-white text-sm">{ride.fromCity} → {ride.toCity}</p>
              <p className="text-slate-500 dark:text-slate-400">
                {formatDate(ride.departureDate)} at {formatTime(ride.departureTime)}
              </p>
              <p className="text-slate-500 dark:text-slate-400">Driver: {ride.driverName}</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Seats to book:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSeats(s => Math.max(1, s - 1))}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-white hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >−</button>
                <span className="text-base font-black text-slate-900 dark:text-white w-5 text-center">{seats}</span>
                <button
                  onClick={() => setSeats(s => Math.min(ride.availableSeats, s + 1))}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-white hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >+</button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-black text-amber-600">
                  ₹{(seats * ride.pricePerSeat).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={handleConfirm}
                disabled={isBooking}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-sm rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-2"
              >
                {isBooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isBooking ? 'Booking...' : 'Confirm'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Ride Card ──────────────────────────────────────────────────────────────
const RideCard: React.FC<{ ride: RideListing; onBook: (ride: RideListing) => void }> = ({ ride, onBook }) => {
  const isFull = ride.availableSeats === 0 || ride.status === 'full';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Driver Strip */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/60">
        <div className="relative shrink-0">
          <img
            src={ride.driverAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(ride.driverName)}&background=f59e0b&color=0f172a&size=80`}
            alt={ride.driverName}
            className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow"
          />
          {ride.driverVerified && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center border border-white dark:border-slate-900">
              <ShieldCheck className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{ride.driverName}</p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              {ride.driverRating.toFixed(1)}
            </span>
            <span>·</span>
            <span>{ride.driverTotalRides} rides</span>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${VEHICLE_COLOR[ride.vehicleType]}`}>
          {VEHICLE_ICONS[ride.vehicleType]}
          {ride.vehicleType.toUpperCase()}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* Route */}
        <div className="flex items-stretch gap-3">
          <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow" />
            <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 min-h-[18px]" />
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900 shadow" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{ride.fromCity}</p>
              <p className="text-[11px] text-slate-400">{ride.fromArea}</p>
            </div>
            {ride.waypoints.length > 0 && (
              <p className="text-[10px] text-slate-400 italic pl-0.5">
                via {ride.waypoints.join(' → ')}
              </p>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{ride.toCity}</p>
              <p className="text-[11px] text-slate-400">{ride.toArea}</p>
            </div>
          </div>
          <div className="flex flex-col items-end justify-between shrink-0 text-right">
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatTime(ride.departureTime)}</p>
              <p className="text-[10px] text-slate-400">{formatDate(ride.departureDate)}</p>
            </div>
            {ride.estimatedDuration && (
              <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />{ride.estimatedDuration}
              </p>
            )}
          </div>
        </div>

        {/* Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${
            isFull ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
          }`}>
            <Users className="w-3 h-3" />
            {isFull ? 'Full' : `${ride.availableSeats} seat${ride.availableSeats !== 1 ? 's' : ''} left`}
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
            ₹{ride.pricePerSeat}/seat
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]">
            <Car className="w-3 h-3" />{ride.vehicleModel} · {ride.vehicleColor}
          </span>
        </div>

        {/* Preferences */}
        {ride.preferences.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ride.preferences.map(p => (
              <span key={p} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {ride.notes && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed border-l-2 border-amber-400 pl-2.5">
            "{ride.notes}"
          </p>
        )}

        {/* Book Button */}
        <button
          onClick={() => !isFull && onBook(ride)}
          disabled={isFull}
          className={`w-full py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            isFull
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
          }`}
        >
          {isFull ? 'Ride Full' : (
            <>
              Book a Seat
              <span className="px-2 py-0.5 rounded-lg bg-amber-600/30 text-[11px] font-black">
                ₹{ride.pricePerSeat}
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ── Main RidesView ─────────────────────────────────────────────────────────
export const RidesView: React.FC<RidesViewProps> = ({ onRidePosted }) => {
  const { viewerLocation } = useLocation();
  const { user } = useAuth();

  // ── Data state ────────────────────────────────────────────────────────────
  const [rides, setRides] = useState<RideListing[]>([]);
  const [myRides, setMyRides] = useState<RideListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'find' | 'my'>('find');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchSeats, setSearchSeats] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const [bookingRide, setBookingRide] = useState<RideListing | null>(null);

  const driverId = user?.id || 'current_user_1';

  // ── Fetch all rides ───────────────────────────────────────────────────────
  const fetchRides = useCallback(async (params?: {
    from?: string; to?: string; date?: string; seats?: number;
  }) => {
    try {
      const qs = new URLSearchParams();
      if (params?.from) qs.set('from', params.from);
      if (params?.to) qs.set('to', params.to);
      if (params?.date) qs.set('date', params.date);
      if (params?.seats && params.seats > 1) qs.set('seats', String(params.seats));

      const res = await fetch(`/api/rides?${qs.toString()}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setRides(data.rides || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load rides');
    }
  }, []);

  // ── Fetch my rides ────────────────────────────────────────────────────────
  const fetchMyRides = useCallback(async () => {
    try {
      const res = await fetch(`/api/rides/my?driverId=${encodeURIComponent(driverId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setMyRides(data.rides || []);
    } catch { /* non-critical */ }
  }, [driverId]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchRides(), fetchMyRides()]);
      setIsLoading(false);
    };
    load();
  }, [fetchRides, fetchMyRides]);

  // ── Refresh on tab switch ─────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'my') fetchMyRides();
  }, [activeTab, fetchMyRides]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setHasSearched(false);
    await fetchRides();
    await fetchMyRides();
    setIsRefreshing(false);
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    setIsLoading(true);
    setHasSearched(true);
    await fetchRides({ from: searchFrom, to: searchTo, date: searchDate, seats: searchSeats });
    setIsLoading(false);
  };

  const handleClearSearch = async () => {
    setHasSearched(false);
    setSearchFrom('');
    setSearchTo('');
    setSearchDate('');
    setSearchSeats(1);
    setIsLoading(true);
    await fetchRides();
    setIsLoading(false);
  };

  // ── Post a ride ───────────────────────────────────────────────────────────
  const handleRidePosted = async (ride: RideListing) => {
    setMyRides(prev => [ride, ...prev]);
    onRidePosted?.(ride);
    setActiveTab('my');
    await fetchRides(); // Refresh global list so others see it
  };

  // ── Book a seat (live API) ────────────────────────────────────────────────
  const handleConfirmBooking = async (ride: RideListing, seatsBooked: number) => {
    const res = await fetch(`/api/rides/${ride.id}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passengerId: driverId,
        passengerName: user?.name || 'Passenger',
        passengerAvatar: user?.avatar || '',
        seatsBooked,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Booking failed');

    // Update ride in local state immediately
    setRides(prev => prev.map(r => r.id === ride.id ? data.ride : r));
    return data;
  };

  // ── Cancel a ride ─────────────────────────────────────────────────────────
  const handleCancelRide = async (rideId: string) => {
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;
    try {
      const res = await fetch(`/api/rides/${rideId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });
      if (res.ok) {
        setMyRides(prev => prev.map(r => r.id === rideId ? { ...r, status: 'cancelled' } : r));
        setRides(prev => prev.filter(r => r.id !== rideId));
      }
    } catch { /* ignore */ }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shadow">
                <Car className="w-4 h-4 text-slate-950" />
              </div>
              Rides
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 ml-10">
              Carpooling from {viewerLocation.cityName} &amp; beyond
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              title="Refresh rides"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsOfferOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Offer Ride
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-200 dark:border-slate-800 -mx-4 px-4">
          {([
            ['find', 'Find a Ride', rides.length],
            ['my', 'My Rides', myRides.length],
          ] as const).map(([id, label, count]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === id
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px]">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* FIND A RIDE TAB */}
        {activeTab === 'find' && (
          <div className="space-y-3 p-4">
            {/* Search Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-amber-500" /> Search Rides
              </p>

              {/* From / To */}
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500" />
                    <select
                      value={searchFrom}
                      onChange={e => setSearchFrom(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none appearance-none"
                    >
                      <option value="">From (any city)</option>
                      {AP_CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-500" />
                    <select
                      value={searchTo}
                      onChange={e => setSearchTo(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none appearance-none"
                    >
                      <option value="">To (any city)</option>
                      {AP_CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => { const t = searchFrom; setSearchFrom(searchTo); setSearchTo(t); }}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                  title="Swap cities"
                >
                  <Repeat2 className="w-4 h-4" />
                </button>
              </div>

              {/* Date + Seats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    min={todayStr}
                    value={searchDate}
                    onChange={e => setSearchDate(e.target.value)}
                    className="w-full pl-8 pr-2 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div className="relative">
                  <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={searchSeats}
                    onChange={e => setSearchSeats(Number(e.target.value))}
                    className="w-full pl-8 pr-2 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none appearance-none"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSearch}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" /> Search Rides
              </button>

              {hasSearched && (
                <button
                  onClick={handleClearSearch}
                  className="w-full py-1.5 text-xs text-slate-400 hover:text-amber-500 transition-colors flex items-center justify-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear filters · Show all rides
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
                <button onClick={handleRefresh} className="ml-auto font-bold hover:underline">Retry</button>
              </div>
            )}

            {/* Loading */}
            {isLoading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <p className="text-xs text-slate-400">Loading rides...</p>
              </div>
            ) : (
              <>
                {/* Results header */}
                {rides.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {hasSearched ? `${rides.length} ride${rides.length !== 1 ? 's' : ''} found` : `${rides.length} available ride${rides.length !== 1 ? 's' : ''}`}
                    </p>
                    <p className="text-[10px] text-slate-400">Earliest departure first</p>
                  </div>
                )}

                {/* Ride cards */}
                {rides.length === 0 ? (
                  <div className="py-14 flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Car className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="font-bold text-slate-600 dark:text-slate-400">
                      {hasSearched ? 'No rides match your search' : 'No rides available yet'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-xs">
                      {hasSearched
                        ? 'Try different cities or dates, or offer a ride yourself!'
                        : 'Be the first to offer a ride and help fellow travellers.'}
                    </p>
                    <button
                      onClick={() => setIsOfferOpen(true)}
                      className="mt-2 px-5 py-2.5 bg-amber-500 text-slate-950 font-black text-sm rounded-xl shadow"
                    >
                      + Offer a Ride
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rides.map(ride => (
                      <RideCard key={ride.id} ride={ride} onBook={r => setBookingRide(r)} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* How it works */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> How Rides Work
              </p>
              <div className="space-y-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                <p>🚗 <strong>Drivers</strong> post their journey with seats, timing &amp; price</p>
                <p>🔍 <strong>Passengers</strong> search and book available seats instantly</p>
                <p>💰 <strong>Split the cost</strong> — cheaper than bus, faster than train</p>
                <p>✅ <strong>Live seats</strong> — bookings update in real-time for all users</p>
              </div>
            </div>
          </div>
        )}

        {/* MY RIDES TAB */}
        {activeTab === 'my' && (
          <div className="p-4 space-y-3">
            <button
              onClick={() => setIsOfferOpen(true)}
              className="w-full py-3 border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-2xl text-amber-600 dark:text-amber-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Offer a New Ride
            </button>

            {myRides.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Navigation className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="font-bold text-slate-600 dark:text-slate-400">No rides posted yet</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Share your journey, help fellow travellers, and split fuel costs.
                </p>
              </div>
            ) : (
              myRides.map(ride => (
                <div key={ride.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {ride.fromCity} <ArrowRight className="inline w-3.5 h-3.5 text-slate-400" /> {ride.toCity}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDate(ride.departureDate)} at {formatTime(ride.departureTime)}
                        {ride.vehicleModel && ` · ${ride.vehicleModel}`}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      ride.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                        : ride.status === 'full' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {ride.status === 'active' ? 'Active' : ride.status === 'full' ? 'Full' : ride.status === 'completed' ? 'Done' : 'Cancelled'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{ride.bookedSeats}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">Booked</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{ride.availableSeats}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">Left</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-2.5">
                      <p className="text-sm font-black text-amber-600">
                        ₹{(ride.bookedSeats * ride.pricePerSeat).toLocaleString('en-IN')}
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">Earned</p>
                    </div>
                  </div>

                  {ride.status === 'active' && (
                    <button
                      onClick={() => handleCancelRide(ride.id)}
                      className="w-full py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      Cancel Ride
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <OfferRideModal
        isOpen={isOfferOpen}
        onClose={() => setIsOfferOpen(false)}
        onRidePosted={handleRidePosted}
      />

      {bookingRide && (
        <BookingModal
          ride={bookingRide}
          onClose={() => setBookingRide(null)}
          onConfirm={async (seats) => {
            await handleConfirmBooking(bookingRide, seats);
          }}
        />
      )}
    </div>
  );
};
