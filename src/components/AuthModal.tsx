import React, { useState } from 'react';
import { SupportedLanguage } from '../types/index.ts';
import { getTranslation } from '../lib/i18n.ts';
import { useLocation } from '../context/LocationContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ShieldCheck,
  Languages,
  CheckCircle2,
  X,
  ArrowRight,
  LogOut,
  Sparkles,
  AlertCircle
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
  const { user, loginWithGoogle, logout, loading: authLoading, error: authError, clearError } = useAuth();
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  if (!isOpen) return null;

  const t = (key: string) => getTranslation(language, key);

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
      if (user) {
        onLoginSuccess(user.name, user.phone || '');
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulatedOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setStep('otp');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess('Kurnool Local', phoneNumber);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92dvh] animate-slide-up sm:animate-none safe-area-bottom"
      >
        {/* Mobile Drag Pill */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              Local<span className="text-amber-500">Net</span>
            </span>
            <span className="text-xs text-slate-400">· Kurnool Hub</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* If already signed in */}
          {user ? (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3.5">
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {user.name}
                    </h3>
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email || user.handle}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Continue Browsing</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                  }}
                  disabled={authLoading}
                  className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Welcome to LocalNet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Global entertainment meets verified 40 km local commerce.
                </p>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{authError}</span>
                  </div>
                  <button onClick={clearError} className="text-rose-500 hover:text-rose-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 1-Tap Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-xs sm:text-sm border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center gap-3 transition-all active:scale-[0.99] cursor-pointer"
              >
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"/>
                  </svg>
                )}
                <span>{authLoading ? 'Signing in...' : 'Continue with Google'}</span>
              </button>

              {/* Language Selector */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-amber-500" />
                  Language / భాషను ఎంచుకోండి
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

              {/* Collapsible Mobile OTP alternative */}
              <div className="pt-2 text-center">
                {!showPhoneLogin ? (
                  <button
                    type="button"
                    onClick={() => setShowPhoneLogin(true)}
                    className="text-xs text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 font-medium underline"
                  >
                    Or continue with Mobile Number OTP
                  </button>
                ) : (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3 text-left">
                    {step === 'phone' ? (
                      <form onSubmit={handleSimulatedOtp} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Mobile Number (India)
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                              +91
                            </span>
                            <input
                              type="tel"
                              required
                              value={phoneNumber}
                              onChange={e => setPhoneNumber(e.target.value)}
                              placeholder="94401 23456"
                              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                          <span>Send OTP</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Enter 4-Digit OTP
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            required
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value)}
                            placeholder="• • • •"
                            className="w-full text-center tracking-[0.5em] text-xl font-black font-mono py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all"
                        >
                          Verify & Enter
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
