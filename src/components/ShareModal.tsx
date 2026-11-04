import React, { useState } from 'react';
import { X, Check, Copy, Code, Mail } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  url?: string;
  postId?: string;
  currentTime?: number;
}

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

  if (!isOpen) return null;

  const baseUrl = url || window.location.href.split('?')[0];
  const shareUrl = `${baseUrl}${postId ? `?post=${encodeURIComponent(postId)}` : ''}${
    includeTimestamp && currentTime > 0 ? `&t=${Math.floor(currentTime)}` : ''
  }`;

  const shareText = `${title}${description ? ` - ${description.slice(0, 100)}` : ''}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const input = document.getElementById('share-url-input') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  const platforms = [
    {
      name: 'WhatsApp',
      color: 'bg-[#25D366] hover:bg-[#20bd5a]',
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.476-.15-.676.15s-.777.978-.952 1.179c-.176.201-.351.226-.652.075s-1.27-.468-2.42-1.493c-.894-.798-1.498-1.784-1.674-2.085s-.019-.464.132-.614c.135-.135.301-.351.451-.526.15-.176.201-.301.301-.501.101-.201.05-.376-.025-.526s-.676-1.629-.927-2.231c-.244-.587-.492-.507-.676-.516l-.577-.01c-.201 0-.526.075-.802.376s-1.053 1.028-1.053 2.507 1.078 2.908 1.228 3.109 2.121 3.239 5.14 4.542c.718.31 1.279.495 1.716.634.721.23 1.378.197 1.897.12.578-.087 1.78-.727 2.031-1.429.251-.702.251-1.304.176-1.429-.075-.125-.276-.201-.577-.351zM12.042 21.688c-1.74 0-3.447-.462-4.947-1.336l-.354-.21-3.674.964.981-3.582-.23-.367c-.958-1.524-1.464-3.284-1.464-5.088 0-5.32 4.327-9.647 9.65-9.647 2.577 0 4.999 1.004 6.822 2.827 1.822 1.822 2.825 4.245 2.825 6.824 0 5.322-4.328 9.649-9.65 9.649zM12.042 0C5.402 0 0 5.402 0 12.042c0 2.12.553 4.188 1.603 6.009L0 24l6.103-1.601c1.761.96 3.754 1.466 5.939 1.466 6.64 0 12.042-5.402 12.042-12.042 0-3.217-1.253-6.241-3.528-8.516C18.282 1.253 15.258 0 12.042 0z" />
        </svg>
      ),
      action: () => {
        window.open(`https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`, '_blank');
      }
    },
    {
      name: 'Facebook',
      color: 'bg-[#1877F2] hover:bg-[#1566cf]',
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      action: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
      }
    },
    {
      name: 'X (Twitter)',
      color: 'bg-black hover:bg-neutral-800 border border-neutral-700',
      icon: (
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      action: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank');
      }
    },
    {
      name: 'Telegram',
      color: 'bg-[#229ED9] hover:bg-[#1d8cc1]',
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.87 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.536-.194 1.006.131.83.94z" />
        </svg>
      ),
      action: () => {
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
      }
    },
    {
      name: 'LinkedIn',
      color: 'bg-[#0A66C2] hover:bg-[#095196]',
      icon: (
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
      ),
      action: () => {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank');
      }
    },
    {
      name: 'Reddit',
      color: 'bg-[#FF4500] hover:bg-[#e03d00]',
      icon: (
        <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      ),
      action: () => {
        window.open(`https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`, '_blank');
      }
    },
    {
      name: 'Email',
      color: 'bg-slate-600 hover:bg-slate-700',
      icon: <Mail className="w-6 h-6 text-white" />,
      action: () => {
        window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%0A%0A${encodedUrl}`, '_blank');
      }
    },
    {
      name: 'Embed',
      color: 'bg-slate-800 hover:bg-slate-900 border border-slate-700',
      icon: <Code className="w-5 h-5 text-white" />,
      action: () => {
        const embedCode = `<iframe width="560" height="315" src="${shareUrl}" title="${title}" frameborder="0" allowfullscreen></iframe>`;
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-700 overflow-hidden flex flex-col text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (YouTube Style) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-neutral-800">
          <h3 className="text-base sm:text-lg font-bold">Share</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platforms Horizontal Row */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x">
            {platforms.map((p) => (
              <button
                key={p.name}
                onClick={p.action}
                className="flex flex-col items-center gap-2 flex-shrink-0 group focus:outline-none"
              >
                <div
                  className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full ${p.color} flex items-center justify-center shadow-md group-hover:scale-108 active:scale-95 transition-transform duration-200`}
                >
                  {p.icon}
                </div>
                <span className="text-[11px] font-medium text-slate-600 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white truncate max-w-[64px] text-center">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Link Input & Copy Box (YouTube Style) */}
        <div className="px-5 pb-5 pt-2 space-y-3">
          <div className="flex items-center gap-2 p-1.5 pl-3.5 bg-slate-50 dark:bg-[#121212] rounded-xl border border-slate-200 dark:border-neutral-700 focus-within:border-blue-500 transition-colors">
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
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Start at timestamp checkbox (like YouTube) */}
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
                  {Math.floor(currentTime / 60)}:
                  {Math.floor(currentTime % 60) < 10 ? '0' : ''}
                  {Math.floor(currentTime % 60)}
                </span>
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
};

