import React, { useState } from 'react';
import { SupportedLanguage } from '../types/index.ts';
import { getTranslation } from '../lib/i18n.ts';
import { useLocation } from '../context/LocationContext.tsx';
import {
  ShieldCheck,
  MapPin,
  Languages,
  Phone,
  Mail,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onLoginSuccess: (name: string, phone: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  language,
  onSelectLanguage,
  onLoginSuccess
}) => {
  const { viewerLocation, requestLiveGps } = useLocation();

  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [userHandle, setUserHandle] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Food & Biryani',
    'Handlooms',
    'Local Culture'
  ]);

  if (!isOpen) return null;

  const t = (key: string) => getTranslation(language, key);

  const interestsList = [
    'Food & Biryani',
    'Handlooms & Gadwal Sarees',
    'Rayalaseema Heritage',
    'Farming & Agri-Tech',
    'Local Jobs',
    'Kurnool News & Civic',
    'Comedy & Entertainment',
    'Local Shopping Deals'
  ];

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setStep('otp');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('profile');
  };

  const handleCompleteRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess(fullName || 'Kurnool Local', phoneNumber);
    onClose();
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92dvh] animate-slide-up sm:animate-none safe-area-bottom"
      >
        {/* Mobile Drag Pill */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              Local<span className="text-amber-500">Net</span>
            </span>
            <span className="text-xs text-slate-400">· Kurnool Digital Ecosystem</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6">
          
          {/* STEP 1: Phone / OTP Registration */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Join LocalNet Kurnool
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Global entertainment meets verified 40 km local commerce.
                </p>
              </div>

              {/* Language Selector */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-amber-500" />
                  Select Preferred Language / భాషను ఎంచుకోండి
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectLanguage('en')}
                    className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      language === 'en'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectLanguage('te')}
                    className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      language === 'te'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    తెలుగు
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectLanguage('hi')}
                    className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      language === 'hi'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    हिन्दी
                  </button>
                </div>
              </div>

              {/* Mobile Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mobile Number (India)
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="94401 23456"
                    className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>Send Verification OTP</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: OTP Entry */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Enter 4-Digit OTP
                </h3>
                <p className="text-xs text-slate-500">
                  Simulated OTP sent to +91 {phoneNumber}. (Enter any 4 digits, e.g. 5566)
                </p>
              </div>

              <input
                type="text"
                maxLength={4}
                required
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                placeholder="• • • •"
                className="w-full text-center tracking-[1em] text-2xl font-black font-mono py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-md"
              >
                Verify & Continue
              </button>
            </form>
          )}

          {/* STEP 3: Profile & Interests */}
          {step === 'profile' && (
            <form onSubmit={handleCompleteRegistration} className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Personalize Your Profile
                </h3>
                <p className="text-xs text-slate-500">
                  Select your interests to tailor your local Kurnool and global entertainment feed.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Arjun Rayalaseema"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Handle
                  </label>
                  <input
                    type="text"
                    required
                    value={userHandle}
                    onChange={e => setUserHandle(e.target.value)}
                    placeholder="@kurnool_user"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Interests Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Topics & Local Interests
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {interestsList.map(item => {
                    const isSelected = selectedInterests.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => toggleInterest(item)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                        }`}
                      >
                        {item} {isSelected ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 rounded-xl transition-all shadow-md"
              >
                Complete Setup & Enter LocalNet
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
