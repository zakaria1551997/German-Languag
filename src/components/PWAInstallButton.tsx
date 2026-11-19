import React, {useState} from 'react';
import {Check, Copy, Download, ExternalLink, PlusSquare, Share, Smartphone, WifiOff, X} from 'lucide-react';
import {useOnlineStatus, usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  showFallbackInfo?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  showFallbackInfo = false,
}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    return null;
  }

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  };

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{compact ? 'ইনস্টল' : 'অ্যাপ ইনস্টল করুন'}</span>
      </button>
    );
  }

  if (isIOS || showFallbackInfo) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <Smartphone className="w-4 h-4 shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          <span>{compact ? 'ইনস্টল' : 'মোবাইলে ইনস্টল'}</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowGuide(false);
            }}
          >
            <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-6 pb-8 sm:pb-6 shadow-2xl">
              <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-4 sm:hidden" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id="install-guide-title"
                    className="text-lg font-bold text-slate-900 dark:text-slate-50"
                  >
                    মোবাইলে ইনস্টল করুন
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    হোম স্ক্রিনে যুক্ত করলে এটি অফলাইনেও ফুল-স্ক্রিন অ্যাপ হিসেবে চলবে।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="বন্ধ করুন"
                  className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isInIframe && (
                <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 p-3.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                  প্রিভিউ ফ্রেমের ভেতর থেকে ব্রাউজার সরাসরি ইনস্টল করতে দেয় না। নিচের বাটন থেকে নতুন ট্যাবে (Chrome/Safari) খুলে ইনস্টল করুন।
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold whitespace-nowrap transition-colors"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>নতুন ট্যাবে খুলুন</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>কপি হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 shrink-0" />
                      <span>লিঙ্ক কপি</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-5 space-y-3.5 text-sm text-slate-700 dark:text-slate-300">
                {isIOS ? (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <p className="pt-0.5 leading-relaxed">
                        Safari ব্রাউজারের নিচের <strong className="font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1">Share <Share className="w-3.5 h-3.5 inline" /></strong> বাটনে ট্যাপ করুন।
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <p className="pt-0.5 leading-relaxed">
                        নিচে স্ক্রল করে <strong className="font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1">Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline" /></strong> চাপুন এবং <strong className="font-semibold text-slate-900 dark:text-white">Add</strong> সিলেক্ট করুন।
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <p className="pt-0.5 leading-relaxed">
                        Android <strong className="font-semibold text-slate-900 dark:text-white">Chrome</strong>-এ লিঙ্কটি খুলুন এবং উপরের <strong className="font-semibold text-slate-900 dark:text-white">ইনস্টল</strong> বাটনে ট্যাপ করুন।
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <p className="pt-0.5 leading-relaxed">
                        অথবা Chrome মেনু (<strong className="font-semibold text-slate-900 dark:text-white">⋮</strong>) থেকে <strong className="font-semibold text-slate-900 dark:text-white">Add to Home screen</strong> → <strong className="font-semibold text-slate-900 dark:text-white">Install</strong> চাপুন।
                      </p>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full min-h-[46px] rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 lg:bottom-4 left-4 right-4 sm:right-auto z-40 inline-flex items-center gap-2.5 rounded-xl bg-amber-600 text-white px-4 py-2.5 text-xs font-semibold shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>অফলাইন মোড — সংরক্ষিত সব শব্দ ও অনুশীলন চালু আছে।</span>
    </div>
  );
};
