import React, { useState } from 'react';
import { useLocation } from '../context/LocationContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { RideListing, VehicleType } from '../types/index.ts';
import {
  X, MapPin, Calendar, Clock, Users, IndianRupee,
  Car, Bike, Truck, CheckCircle2, AlertCircle, ChevronDown, ArrowRight
} from 'lucide-react';

interface OfferRideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRidePosted: (ride: RideListing) => void;
}

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: React.ReactNode; seats: number }[] = [
  { type: 'bike', label: 'Bike 🏍️', icon: <Bike className="w-4 h-4" />, seats: 1 },
  { type: 'auto', label: 'Auto 🛺', icon: <Car className="w-4 h-4" />, seats: 3 },
  { type: 'car', label: 'Car 🚗', icon: <Car className="w-4 h-4" />, seats: 4 },
  { type: 'suv', label: 'SUV 🚙', icon: <Truck className="w-4 h-4" />, seats: 6 },
  { type: 'van', label: 'Van 🚐', icon: <Truck className="w-4 h-4" />, seats: 8 },
];

const PREFERENCE_OPTIONS = [
  '🚭 No smoking', '👩 Women only', '👨 Men only', '🧳 Luggage OK',
  '👜 Light luggage only', '🎵 Music OK', '🐾 Pets allowed', '❄️ AC only',
  '🍽️ No eating', '🌙 Night drive OK',
];

const AP_CITIES = [
  'Kurnool', 'Hyderabad', 'Bengaluru', 'Vijayawada', 'Nandyal',
  'Tirupati', 'Guntur', 'Ongole', 'Adoni', 'Cuddapah',
  'Bellary', 'Anantapur', 'Nellore', 'Visakhapatnam', 'Rajahmundry',
  'Secunderabad', 'Warangal', 'Karimnagar', 'Chennai', 'Mumbai',
];

export const OfferRideModal: React.FC<OfferRideModalProps> = ({ isOpen, onClose, onRidePosted }) => {
  const { viewerLocation } = useLocation();
  const { user } = useAuth();

  const [fromCity, setFromCity] = useState(viewerLocation.cityName || 'Kurnool');
  const [fromArea, setFromArea] = useState('');
  const [toCity, setToCity] = useState('');
  const [toArea, setToArea] = useState('');
  const [waypoints, setWaypoints] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [totalSeats, setTotalSeats] = useState(3);
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Tomorrow as min date
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const togglePref = (pref: string) => {
    setSelectedPrefs(prev =>
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!toCity) return setError('Please select a destination city.');
    if (!departureDate) return setError('Please pick a departure date.');
    if (!departureTime) return setError('Please pick a departure time.');
    if (!pricePerSeat || Number(pricePerSeat) < 1) return setError('Please set a valid price per seat.');
    if (!vehicleModel) return setError('Please enter your vehicle model.');

    setIsSubmitting(true);

    try {
      const newRide: RideListing = {
        id: `ride_${Date.now()}`,
        driverId: user?.id || 'current_user_1',
        driverName: user?.name || 'You',
        driverAvatar: user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
        driverRating: 5.0,
        driverTotalRides: 0,
        driverVerified: false,
        fromCity,
        fromArea: fromArea || fromCity,
        fromLat: viewerLocation.coords.latitude,
        fromLon: viewerLocation.coords.longitude,
        toCity,
        toArea: toArea || toCity,
        toLat: 0,
        toLon: 0,
        waypoints: waypoints.split(',').map(w => w.trim()).filter(Boolean),
        departureDate,
        departureTime,
        estimatedDuration: 'TBD',
        distanceKm: 0,
        totalSeats,
        availableSeats: totalSeats,
        pricePerSeat: Number(pricePerSeat),
        vehicleType,
        vehicleModel,
        vehicleColor: vehicleColor || 'Not specified',
        vehicleNumber: vehicleNumber || undefined,
        preferences: selectedPrefs,
        notes,
        status: 'active',
        createdAt: new Date().toISOString(),
        bookedSeats: 0,
      };

      // Try API — fallback to local
      try {
        const res = await fetch('/api/rides/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRide),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ride?.id) newRide.id = data.ride.id;
        }
      } catch { /* offline fallback */ }

      setSuccess(true);
      onRidePosted(newRide);
      setTimeout(onClose, 1400);
    } catch (err: any) {
      setError(err.message || 'Failed to post ride. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94dvh] overflow-hidden"
      >
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-500" /> Offer a Ride
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Share your journey, split fuel costs</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Ride posted! Passengers can now book seats.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Route Section */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" /> Route
              </p>

              <div className="relative pl-4 space-y-2">
                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-500 to-rose-500" />
                <div className="absolute left-[-3px] top-2 w-2 h-2 rounded-full bg-emerald-500" />
                <div className="absolute left-[-3px] bottom-2 w-2 h-2 rounded-full bg-rose-500" />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={fromCity}
                    onChange={e => setFromCity(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    {AP_CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input
                    type="text"
                    value={fromArea}
                    onChange={e => setFromArea(e.target.value)}
                    placeholder="Area / Landmark"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <input
                  type="text"
                  value={waypoints}
                  onChange={e => setWaypoints(e.target.value)}
                  placeholder="Stops along the way (comma separated, e.g. Nandyal, Ongole)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    required
                    value={toCity}
                    onChange={e => setToCity(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="">Destination City</option>
                    {AP_CITIES.filter(c => c !== fromCity).map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input
                    type="text"
                    value={toArea}
                    onChange={e => setToArea(e.target.value)}
                    placeholder="Area / Drop point"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Date, Time, Seats, Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" /> Date
                </label>
                <input
                  type="date"
                  required
                  min={minDateStr}
                  value={departureDate}
                  onChange={e => setDepartureDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Departure
                </label>
                <input
                  type="time"
                  required
                  value={departureTime}
                  onChange={e => setDepartureTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-amber-500" /> Seats to offer
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setTotalSeats(s => Math.max(1, s - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30">−</button>
                  <span className="text-sm font-bold text-slate-900 dark:text-white w-6 text-center">{totalSeats}</span>
                  <button type="button" onClick={() => setTotalSeats(s => Math.min(VEHICLE_OPTIONS.find(v => v.type === vehicleType)?.seats || 8, s + 1))}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30">+</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-amber-500" /> Price / seat
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">₹</span>
                  <input
                    type="number"
                    required
                    min={1}
                    value={pricePerSeat}
                    onChange={e => setPricePerSeat(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Vehicle Type</label>
              <div className="grid grid-cols-5 gap-1.5">
                {VEHICLE_OPTIONS.map(v => (
                  <button
                    key={v.type}
                    type="button"
                    onClick={() => { setVehicleType(v.type); setTotalSeats(Math.min(totalSeats, v.seats)); }}
                    className={`p-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 border transition-all ${
                      vehicleType === v.type
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {v.icon}
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="grid grid-cols-3 gap-2">
              <input
                required
                type="text"
                value={vehicleModel}
                onChange={e => setVehicleModel(e.target.value)}
                placeholder="Model (e.g. Swift)"
                className="col-span-2 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <input
                type="text"
                value={vehicleColor}
                onChange={e => setVehicleColor(e.target.value)}
                placeholder="Color"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <input
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="Number plate (optional)"
                className="col-span-3 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none font-mono tracking-wide"
              />
            </div>

            {/* Preferences */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Preferences</label>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_OPTIONS.map(pref => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => togglePref(pref)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                      selectedPrefs.includes(pref)
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-400'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any message for passengers (e.g. 'Will stop at Nandyal for 15 mins')..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            />

            {/* Submit */}
            <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded-xl">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || success}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Car className="w-4 h-4" />
                {isSubmitting ? 'Posting...' : 'Post Ride'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
