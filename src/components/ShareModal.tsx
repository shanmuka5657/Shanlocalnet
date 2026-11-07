import React, { useState } from 'react';
import { X, Check, Copy, Code, Mail, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  url?: string;
  postId?: string;
  currentTime?: number;
}

// Always use the canonical production URL so recipients open the specific video
const CANONICAL_BASE = 'https://shanlocalnet.vercel.app';

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  url,
  postId,
  currentTime = 0
}) => {
  const [copied, setCopied] = useState(false);
  const [includeTimestamp, setIncludeTimestamp] = useState(false);
  const [nativeShareDone, setNativeShareDone] = useState(false);

  if (!isOpen) return null;

  // Build a canonical deep-link URL — always points to the specific video
  const base = url
    ? url.split('?')[0]
    : (window.location.hostname === 'localhost'
        ? CANONICAL_BASE                          // dev: use production URL
        : window.location.href.split('?')[0]);    // prod: current origin

  const shareUrl = [
    base,
    postId ? `?post=${encodeURIComponent(postId)}` : '',
    includeTimestamp && currentTime > 0 ? `${postId ? '&' : '?'}t=${Math.floor(currentTime)}` : ''
  ].join('');

  const shareText = `Watch "${title}" on LocalNet 🎬`;
  const encodedUrl  = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  // ── Native Android/iOS share (uses OS share sheet: WhatsApp, Instagram, etc.) ──
  const handleNativeShare = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Capacitor native share sheet (Android / iOS)
        await Share.share({
          title,
          text: shareText,
          url: shareUrl,
          dialogTitle: 'Share this video',
        });
        setNativeShareDone(true);
        setTimeout(() => { setNativeShareDone(false); onClose(); }, 1200);
      } else if (typeof navigator.share === 'function') {
        // Web Share API (mobile Chrome / Safari)
        await navigator.share({ title, text: shareText, url: shareUrl });
        setNativeShareDone(true);
        setTimeout(() => { setNativeShareDone(false); onClose(); }, 1200);
      }
    } catch (err: any) {
      // User cancelled share or share not available — ignore
      if (err?.name !== 'AbortError') {
        console.warn('[Share]', err?.message);
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.getElementById('share-url-input') as HTMLInputElement;
      if (input) { input.select(); document.execCommand('copy'); }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Is native share available?
  const hasNativeShare = Capacitor.isNativePlatform() || typeof navigator.share === 'function';

  const platforms = [
    {
      name: 'WhatsApp',
      color: 'bg-[#25D366] hover:bg-[#20bd5a]',
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.476-.15-.676.15s-.777.978-.952 1.179c-.176.201-.351.226-.652.075s-1.27-.468-2.42-1.493c-.894-.798-1.498-1.784-1.674-2.085s-.019-.464.132-.614c.135-.135.301-.351.451-.526.15-.176.201-.301.301-.501.101-.201.05-.376-.025-.526s-.676-1.629-.927-2.231c-.244-.587-.492-.507-.676-.516l-.577-.01c-.201 0-.526.075-.802.376s-1.053 1.028-1.053 2.507 1.078 2.908 1.228 3.109 2.121 3.239 5.14 4.542c.718.31 1.279.495 1.716.634.721.23 1.378.197 1.897.12.578-.087 1.78-.727 2.031-1.429.251-.702.251-1.304.176-1.429-.075-.125-.276-.201-.577-.351zM12.042 21.688c-1.74 0-3.447-.462-4.947-1.336l-.354-.21-3.674.964.981-3.582-.23-.367c-.958-1.524-1.464-3.284-1.464-5.088 0-5.32 4.327-9.647 9.65-9.647 2.577 0 4.999 1.004 6.822 2.827 1.822 1.822 2.825 4.245 2.825 6.824 0 5.322-4.328 9.649-9.65 9.649zM12.042 0C5.402 0 0 5.402 0 12.042c0 2.12.553 4.188 1.603 6.009L0 24l6.103-1.601c1.761.96 3.754 1.466 5.939 1.466 6.64 0 12.042-5.402 12.042-12.042 0-3.217-1.253-6.241-3.528-8.516C18.282 1.253 15.258 0 12.042 0z" />
        </svg>
      ),
      action: () => window.open(`https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`, '_blank'),
    },
    {
      name: 'Telegram',
      color: 'bg-[#229ED9] hover:bg-[#1d8cc1]',
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.87 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.536-.194 1.006.131.83.94z" />
        </svg>
      ),
      action: () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank'),
    },
    {
      name: 'X (Twitter)',
      color: 'bg-black hover:bg-neutral-800 border border-neutral-700',
      icon: (
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank'),
    },
    {
      name: 'Facebook',
      color: 'bg-[#1877F2] hover:bg-[#1566cf]',
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank'),
    },
    {
      name: 'Email',
      color: 'bg-slate-600 hover:bg-slate-700',
      icon: <Mail className="w-6 h-6 text-white" />,
      action: () => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%0A%0A${encodedUrl}`, '_blank'),
    },
    {
      name: 'Embed',
      color: 'bg-slate-800 hover:bg-slate-900 border border-slate-700',
      icon: <Code className="w-5 h-5 text-white" />,
      action: () => {
        const embedCode = `<iframe width="560" height="315" src="${shareUrl}" title="${title}" frameborder="0" allowfullscreen></iframe>`;
        navigator.clipboard.writeText(embedCode).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      },
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
    >
      <div
        className="relative w-full sm:max-w-lg bg-white dark:bg-[#1f1f1f] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 dark:border-neutral-700 max-h-[92dvh] overflow-hidden flex flex-col text-slate-900 dark:text-white animate-slide-up sm:animate-none safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Pill */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-400/40 dark:bg-neutral-600 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-neutral-800">
          <h3 className="text-base sm:text-lg font-bold">Share</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* ── Native OS Share Button (Android / iOS / mobile web) ── */}
          {hasNativeShare && (
            <div className="px-5 pt-4 pb-2">
              <button
                onClick={handleNativeShare}
                className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-98 shadow-md ${
                  nativeShareDone
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:brightness-110'
                }`}
              >
                {nativeShareDone ? (
                  <>
                    <Check className="w-5 h-5 stroke-[3]" />
                    Shared!
                  </>
                ) : (
                  <>
                    <Share2 className="w-5 h-5" />
                    Share via WhatsApp, Instagram &amp; more…
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-slate-400 dark:text-neutral-500 mt-1.5">
                Opens your phone's share menu
              </p>
            </div>
          )}

          {/* ── Social Platform Buttons ── */}
          <div className="px-5 pt-3 pb-3">
            {!hasNativeShare && (
              <p className="text-xs text-slate-500 dark:text-neutral-400 mb-3 font-medium">Share to</p>
            )}
            <div className="flex gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x">
              {platforms.map((p) => (
                <button
                  key={p.name}
                  onClick={p.action}
                  className="flex flex-col items-center gap-2 flex-shrink-0 group focus:outline-none"
                >
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${p.color} flex items-center justify-center shadow-md group-hover:scale-105 active:scale-95 transition-transform`}>
                    {p.icon}
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-neutral-300 truncate max-w-[56px] text-center">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Copy Link ── */}
          <div className="px-5 pb-5 pt-1 space-y-3">
            <div className="flex items-center gap-2 p-1.5 pl-3.5 bg-slate-50 dark:bg-[#121212] rounded-xl border border-slate-200 dark:border-neutral-700">
              <input
                id="share-url-input"
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 dark:text-neutral-200 outline-none truncate select-all font-mono"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95 ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? <><Check className="w-4 h-4 stroke-[3]" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
              </button>
            </div>

            {/* Start at timestamp */}
            {currentTime > 0 && (
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span>
                  Start at{' '}
                  <span className="font-mono text-slate-900 dark:text-white font-semibold">
                    {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
