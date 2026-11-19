import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Headphones,
  HelpCircle,
  Layers,
  Mic,
  Moon,
  PenTool,
  RotateCcw,
  Sun,
} from 'lucide-react';
import {LevelSheet} from './components/LevelSheet';
import {OfflineIndicator, PWAInstallButton} from './components/PWAInstallButton';
import {PracticeStage} from './components/PracticeStage';
import {WordbookPanel} from './components/WordbookPanel';
import type {MobileView, PracticeMode, VocabMap} from './types/vocab';
import {buildLevelsFromCustomJson, buildLevelsFromRaw} from './utils/vocab';

const STORAGE_KEYS = {
  xp: 'dxp',
  theme: 'gth',
  mastered: 'deutsch_a1_mastered_v1',
  progress: 'deutsch_a1_progress_v1',
} as const;

const PRACTICE_MODES: Array<{
  id: PracticeMode;
  label: string;
  shortLabel: string;
  icon: React.FC<{className?: string}>;
}> = [
  {id: 'listen', label: 'শুনুন ও পড়ুন', shortLabel: 'শুনুন', icon: Headphones},
  {id: 'speak', label: 'বলা (Speaking)', shortLabel: 'বলুন', icon: Mic},
  {id: 'write', label: 'লেখা (Writing)', shortLabel: 'লিখুন', icon: PenTool},
  {id: 'quiz', label: 'কুইজ', shortLabel: 'কুইজ', icon: HelpCircle},
];

function loadInitialTheme(): 'dark' | 'light' {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  return 'light';
}

function loadSavedXp(): number {
  try {
    const val = Number(localStorage.getItem(STORAGE_KEYS.xp));
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

function loadSavedMastered(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mastered);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function loadSavedProgress(): {level: number; index: number} {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.progress);
    if (!raw) return {level: 1, index: 0};
    const parsed = JSON.parse(raw);
    return {
      level: Number(parsed?.level) > 0 ? Number(parsed.level) : 1,
      index: Number(parsed?.index) >= 0 ? Number(parsed.index) : 0,
    };
  } catch {
    return {level: 1, index: 0};
  }
}

export default function App() {
  const defaultLevels = useMemo(() => buildLevelsFromRaw(), []);
  const [vocabMap, setVocabMap] = useState<VocabMap>(defaultLevels);
  const [isCustomDeck, setIsCustomDeck] = useState(false);

  const initialProgress = useMemo(() => loadSavedProgress(), []);
  const [activeLevel, setActiveLevel] = useState<number>(() =>
    defaultLevels[initialProgress.level] ? initialProgress.level : 1
  );
  const [wordIndex, setWordIndex] = useState<number>(() => {
    const lvl = defaultLevels[initialProgress.level] || defaultLevels[1];
    return initialProgress.index < lvl.words.length ? initialProgress.index : 0;
  });

  const [mode, setMode] = useState<PracticeMode>('listen');
  const [mobileView, setMobileView] = useState<MobileView>('listen');
  const [xp, setXp] = useState<number>(loadSavedXp);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(loadSavedMastered);
  const [theme, setTheme] = useState<'dark' | 'light'>(loadInitialTheme);
  const [levelSheetOpen, setLevelSheetOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [xpToast, setXpToast] = useState<{id: number; amount: number} | null>(null);

  const levelList = useMemo(
    () =>
      Object.values(vocabMap).sort((a, b) => a.level - b.level),
    [vocabMap]
  );

  const allWords = useMemo(
    () => levelList.flatMap((lvl) => lvl.words),
    [levelList]
  );

  const currentLevelObj = vocabMap[activeLevel] || levelList[0];
  const safeIndex = Math.min(wordIndex, Math.max(0, currentLevelObj.words.length - 1));
  const currentWord = currentLevelObj.words[safeIndex];

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.dataset.theme = 'dark';
    } else {
      root.classList.remove('dark');
      root.dataset.theme = 'light';
    }
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'dark' ? '#0B101B' : '#1D4ED8');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Persist level & word progress (only for default deck)
  useEffect(() => {
    if (isCustomDeck) return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.progress,
        JSON.stringify({level: activeLevel, index: safeIndex})
      );
    } catch {
      // Ignore
    }
  }, [activeLevel, safeIndex, isCustomDeck]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAwardXp = useCallback(
    (points: number, markMastered = false) => {
      setHasInteracted(true);
      if (points > 0) {
        setXp((prev) => {
          const next = prev + points;
          try {
            localStorage.setItem(STORAGE_KEYS.xp, String(next));
          } catch {
            // Ignore
          }
          return next;
        });
        const toastId = Date.now();
        setXpToast({id: toastId, amount: points});
        window.setTimeout(() => {
          setXpToast((curr) => (curr?.id === toastId ? null : curr));
        }, 1200);
      }

      if (markMastered && currentWord) {
        setMasteredIds((prev) => {
          if (prev.has(currentWord.id)) return prev;
          const next = new Set(prev);
          next.add(currentWord.id);
          try {
            localStorage.setItem(STORAGE_KEYS.mastered, JSON.stringify(Array.from(next)));
          } catch {
            // Ignore
          }
          return next;
        });
      }
    },
    [currentWord]
  );

  const handleNextWord = useCallback(() => {
    setHasInteracted(true);
    const totalInLevel = currentLevelObj.words.length;
    if (safeIndex + 1 < totalInLevel) {
      setWordIndex(safeIndex + 1);
      return;
    }
    const nextLevelPos = levelList.findIndex((l) => l.level === currentLevelObj.level) + 1;
    if (nextLevelPos < levelList.length) {
      setActiveLevel(levelList[nextLevelPos].level);
      setWordIndex(0);
    } else {
      setWordIndex(0);
    }
  }, [currentLevelObj, safeIndex, levelList]);

  const handlePrevWord = useCallback(() => {
    setHasInteracted(true);
    if (safeIndex > 0) {
      setWordIndex(safeIndex - 1);
      return;
    }
    const prevLevelPos = levelList.findIndex((l) => l.level === currentLevelObj.level) - 1;
    if (prevLevelPos >= 0) {
      const prevLvl = levelList[prevLevelPos];
      setActiveLevel(prevLvl.level);
      setWordIndex(Math.max(0, prevLvl.words.length - 1));
    }
  }, [currentLevelObj, safeIndex, levelList]);

  const handleSwitchMode = (nextMode: PracticeMode) => {
    setHasInteracted(true);
    setMode(nextMode);
    setMobileView(nextMode);
  };

  const handleSelectLevel = (levelNumber: number) => {
    setActiveLevel(levelNumber);
    setWordIndex(0);
  };

  const handleSelectWord = (levelNumber: number, index: number) => {
    setHasInteracted(true);
    setActiveLevel(levelNumber);
    setWordIndex(index);
    setMobileView(mode);
  };

  const handleImportJson = (jsonText: string) => {
    const customMap = buildLevelsFromCustomJson(jsonText);
    const firstKey = Object.keys(customMap)
      .map(Number)
      .sort((a, b) => a - b)[0];
    setVocabMap(customMap);
    setIsCustomDeck(true);
    setActiveLevel(firstKey);
    setWordIndex(0);
  };

  const handleResetDefaultDeck = () => {
    setVocabMap(defaultLevels);
    setIsCustomDeck(false);
    setActiveLevel(1);
    setWordIndex(0);
  };

  const progressPercent = ((safeIndex + 1) / Math.max(1, currentLevelObj.words.length)) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FB] dark:bg-[#0B101B] text-slate-900 dark:text-slate-100">
      {/* Top Bar: Compact 48px on Mobile, Clean 3-Zone Contract on Desktop */}
      <header className="sticky top-0 z-30 pt-safe bg-white/90 dark:bg-[#0B101B]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 md:h-16 flex items-center justify-between gap-4 md:gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              setMobileView(mode);
              window.scrollTo({top: 0, behavior: 'smooth'});
            }}
            className="font-display-de text-base md:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Deutsch A1
          </button>

          {/* Zone 2: Desktop Mode Navigation Links (4 concise single-line links) */}
          <nav
            aria-label="অনুশীলনের ধাপ"
            className="hidden md:flex items-center gap-6"
          >
            {PRACTICE_MODES.map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSwitchMode(item.id)}
                  className={`relative py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 right-0 -bottom-[17px] h-0.5 bg-blue-700 dark:bg-blue-400 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action (Install App on mobile/desktop) */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton compact showFallbackInfo />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-20 md:py-6">
        {/* Workspace Utility Toolbar (Level Selector + Progress + Theme + Reset) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setLevelSheetOpen(true)}
              className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#131A2A] border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 text-sm font-semibold text-slate-900 dark:text-white transition-colors min-w-0 max-w-full"
            >
              <Layers className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap shrink-0">লেভেল {currentLevelObj.level}</span>
              <span className="text-slate-400 hidden sm:inline" aria-hidden="true">·</span>
              <span className="text-slate-500 dark:text-slate-400 font-normal truncate hidden sm:inline">
                {currentLevelObj.title}
              </span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap pl-1">
              <span>{allWords.length} শব্দ</span>
              <span aria-hidden="true">·</span>
              <span>{levelList.length} লেভেল</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-blue-700 dark:text-blue-400">{xp} XP</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setWordIndex(0)}
              aria-label="লেভেল শুরু থেকে"
              title="লেভেল শুরু থেকে"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-[#131A2A] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'লাইট থিম চালু করুন' : 'ডার্ক থিম চালু করুন'}
              title={theme === 'dark' ? 'লাইট থিম' : 'ডার্ক থিম'}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-[#131A2A] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Two-Column Educational Sandbox Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          {/* Primary Practice Column */}
          <div className={mobileView === 'words' ? 'hidden md:block' : 'block'}>
            {/* Slim Progress Bar & Prev/Next Stepper */}
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrevWord}
                aria-label="আগের শব্দ"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-[#131A2A] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-mono tabular-nums">
                  <span>
                    শব্দ {safeIndex + 1} / {currentLevelObj.words.length}
                  </span>
                  <span className="lg:hidden font-semibold text-blue-700 dark:text-blue-400">
                    {xp} XP
                  </span>
                </div>
                <div
                  className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(progressPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-blue-700 dark:bg-blue-500 transition-transform duration-300 origin-left"
                    style={{transform: `scaleX(${Math.max(0.02, progressPercent / 100)})`}}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextWord}
                aria-label="পরের শব্দ"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-[#131A2A] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Active Practice Stage */}
            <PracticeStage
              mode={mode}
              word={currentWord}
              allWords={allWords}
              isMastered={masteredIds.has(currentWord.id)}
              onAwardXp={handleAwardXp}
              onNext={handleNextWord}
              onPrev={handlePrevWord}
              autoSpeakEnabled={hasInteracted}
            />

            {/* Subtle Keyboard Shortcut Reference on Desktop */}
            <p className="hidden md:block mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
              কিবোর্ড শর্টকাট: Space (উচ্চারণ) · ← / → (আগের/পরের শব্দ) · 1–4 (কুইজ অপশন) · Enter (পরবর্তী)
            </p>
          </div>

          {/* Right Deck on Desktop / Stacked on Tablet / Dedicated View on Mobile */}
          <div className={mobileView === 'words' ? 'block' : 'hidden md:block'}>
            <WordbookPanel
              currentLevel={currentLevelObj}
              allLevels={levelList}
              currentWordId={currentWord.id}
              masteredIds={masteredIds}
              xp={xp}
              totalWordsCount={allWords.length}
              onSelectWord={handleSelectWord}
              onOpenLevelSheet={() => setLevelSheetOpen(true)}
            />
          </div>
        </div>
      </main>

      {/* Mobile Ergonomic Thumb-Zone Bottom Tab Bar (56px height) */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B101B]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 pb-safe"
      >
        <div className="grid grid-cols-5 h-14 items-center">
          {PRACTICE_MODES.map((item) => {
            const Icon = item.icon;
            const active = mobileView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSwitchMode(item.id)}
                className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
                  active
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[11px] font-semibold mt-0.5 leading-none whitespace-nowrap">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileView('words')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
              mobileView === 'words'
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-5 h-5" aria-hidden="true" />
            <span className="text-[11px] font-semibold mt-0.5 leading-none whitespace-nowrap">
              তালিকা
            </span>
          </button>
        </div>
      </nav>

      {/* Level Switcher & Custom JSON Bottom Sheet */}
      <LevelSheet
        open={levelSheetOpen}
        levels={levelList}
        activeLevel={currentLevelObj.level}
        masteredIds={masteredIds}
        isCustomDeck={isCustomDeck}
        onSelectLevel={handleSelectLevel}
        onImportJson={handleImportJson}
        onResetDefaultDeck={handleResetDefaultDeck}
        onClose={() => setLevelSheetOpen(false)}
      />

      {/* XP Earned Toast */}
      {xpToast && (
        <div
          key={xpToast.id}
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-8 z-50 px-5 py-2 rounded-xl bg-emerald-600 text-white font-mono tabular-nums text-sm font-bold shadow-lg pointer-events-none"
        >
          +{xpToast.amount} XP
        </div>
      )}

      {/* Offline Status Banner */}
      <OfflineIndicator />
    </div>
  );
}
