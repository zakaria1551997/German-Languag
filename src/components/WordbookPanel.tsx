import React, {useMemo, useState} from 'react';
import {Check, Layers, Search, Volume2, X} from 'lucide-react';
import type {VocabLevel, VocabWord} from '../types/vocab';
import {speakGerman} from '../utils/tts';

interface WordbookPanelProps {
  currentLevel: VocabLevel;
  allLevels: VocabLevel[];
  currentWordId: string;
  masteredIds: Set<string>;
  xp: number;
  totalWordsCount: number;
  onSelectWord: (levelNumber: number, wordIndex: number) => void;
  onOpenLevelSheet: () => void;
}

export const WordbookPanel: React.FC<WordbookPanelProps> = ({
  currentLevel,
  allLevels,
  currentWordId,
  masteredIds,
  xp,
  totalWordsCount,
  onSelectWord,
  onOpenLevelSheet,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'level' | 'all'>('level');

  const masteredInLevel = useMemo(
    () => currentLevel.words.filter((w) => masteredIds.has(w.id)).length,
    [currentLevel.words, masteredIds]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (scope === 'level') {
      return currentLevel.words
        .map((word, index) => ({word, level: currentLevel.level, index}))
        .filter(
          ({word}) =>
            !q ||
            word.de.toLowerCase().includes(q) ||
            word.en.toLowerCase().includes(q) ||
            word.bn.toLowerCase().includes(q)
        );
    }

    const results: Array<{word: VocabWord; level: number; index: number}> = [];
    for (const lvl of allLevels) {
      for (let idx = 0; idx < lvl.words.length; idx++) {
        const w = lvl.words[idx];
        if (
          !q ||
          w.de.toLowerCase().includes(q) ||
          w.en.toLowerCase().includes(q) ||
          w.bn.toLowerCase().includes(q)
        ) {
          results.push({word: w, level: lvl.level, index: idx});
          if (results.length >= 120) return results;
        }
      }
    }
    return results;
  }, [query, scope, currentLevel, allLevels]);

  return (
    <aside className="rounded-3xl bg-white dark:bg-[#131A2A] border border-slate-200/90 dark:border-slate-800 p-5 flex flex-col">
      {/* Unboxed Quantitative Summary */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            বর্তমান অগ্রগতি
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
              {xp} XP
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              · {masteredIds.size}/{totalWordsCount} শেখা
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLevelSheet}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          <Layers className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
          <span>লেভেল {currentLevel.level}</span>
        </button>
      </div>

      {/* Level Title & Scope Switcher */}
      <div className="pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            শব্দতালিকা ({masteredInLevel}/{currentLevel.words.length})
          </h3>

          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 shrink-0">
            <button
              type="button"
              onClick={() => setScope('level')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                scope === 'level'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              এই লেভেল
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                scope === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              সব লেভেল
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="mt-3 relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="জার্মান, ইংরেজি বা বাংলায় খুঁজুন…"
            aria-label="শব্দ খুঁজুন"
            className="w-full min-h-[44px] pl-10 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="সার্চ মুছুন"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Tap List Rows */}
      <div className="mt-3 -mx-2 max-h-[52vh] lg:max-h-[460px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
        {filteredItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            কোনো শব্দ পাওয়া যায়নি।
          </p>
        ) : (
          filteredItems.map(({word, level, index}) => {
            const isActive = word.id === currentWordId;
            const isDone = masteredIds.has(word.id);

            return (
              <div
                key={`${level}-${word.id}`}
                className={`flex items-center gap-2 px-2 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-blue-50/90 dark:bg-blue-950/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectWord(level, index)}
                  className="flex-1 min-w-0 text-left py-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-display-de text-sm font-bold truncate ${
                        isActive
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {word.de}
                    </span>
                    {isDone && (
                      <Check
                        className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                        aria-label="শেখা হয়েছে"
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                    {word.bn}
                    {word.en ? ` · ${word.en}` : ''}
                    {scope === 'all' ? ` · L${level}` : ''}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => speakGerman(word.sp, {rate: 0.9})}
                  aria-label={`${word.sp} উচ্চারণ শুনুন`}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
