import React, {useRef, useState} from 'react';
import {Check, RotateCcw, Upload, X} from 'lucide-react';
import type {VocabLevel} from '../types/vocab';

interface LevelSheetProps {
  open: boolean;
  levels: VocabLevel[];
  activeLevel: number;
  masteredIds: Set<string>;
  isCustomDeck: boolean;
  onSelectLevel: (levelNumber: number) => void;
  onImportJson: (jsonText: string) => void;
  onResetDefaultDeck: () => void;
  onClose: () => void;
}

export const LevelSheet: React.FC<LevelSheetProps> = ({
  open,
  levels,
  activeLevel,
  masteredIds,
  isCustomDeck,
  onSelectLevel,
  onImportJson,
  onResetDefaultDeck,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      setUploadError(null);
      const text = await file.text();
      onImportJson(text);
      onClose();
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'ফাইলটি সঠিক JSON নয়। ফরম্যাট: [{"de":"Hallo","en":"hello","bn":"হ্যালো","level":1}]'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-xl max-h-[86vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#131A2A] border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Grab handle on mobile */}
        <div className="pt-3 sm:hidden">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="level-sheet-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              লেভেল নির্বাচন ও কাস্টম ফাইল
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              মোট {levels.length}টি লেভেল · যেকোনো লেভেলে ট্যাপ করে শুরু করুন
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Custom JSON Import Controls */}
        <div className="px-6 py-3.5 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold whitespace-nowrap transition-colors"
            >
              <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>JSON ফাইল আপলোড</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            {isCustomDeck && (
              <button
                type="button"
                onClick={() => {
                  onResetDefaultDeck();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>ডিফল্ট ৪৭ লেভেল</span>
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {`[{"de":"Hallo","en":"hello","bn":"হ্যালো","level":1}]`}
          </span>
          {uploadError && (
            <p className="w-full text-xs font-semibold text-rose-600 dark:text-rose-400">
              {uploadError}
            </p>
          )}
        </div>

        {/* Scrollable Level List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-safe">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {levels.map((lvl) => {
              const isSelected = lvl.level === activeLevel;
              const masteredCount = lvl.words.filter((w) => masteredIds.has(w.id)).length;
              const pct = Math.round((masteredCount / Math.max(1, lvl.words.length)) * 100);

              return (
                <button
                  key={lvl.level}
                  type="button"
                  onClick={() => {
                    onSelectLevel(lvl.level);
                    onClose();
                  }}
                  className={`flex items-center justify-between gap-3 min-h-[60px] px-4 py-3 rounded-2xl border text-left transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/90 dark:bg-blue-950/40'
                      : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold text-sm whitespace-nowrap ${
                          isSelected
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        লেভেল {lvl.level}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        · {lvl.words.length} শব্দ
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {lvl.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {pct}%
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
