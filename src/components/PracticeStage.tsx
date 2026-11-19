import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Gauge,
  Mic,
  Play,
  Radio,
  Square,
  Volume2,
  XCircle,
} from 'lucide-react';
import {useSpeechPractice} from '../hooks/useSpeechPractice';
import type {PracticeMode, VocabWord} from '../types/vocab';
import {speakGerman} from '../utils/tts';
import {isExactAnswerMatch, shuffleArray} from '../utils/vocab';
import {AudioWaveform} from './AudioWaveform';

interface PracticeStageProps {
  mode: PracticeMode;
  word: VocabWord;
  allWords: VocabWord[];
  isMastered: boolean;
  onAwardXp: (points: number, markMastered?: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  autoSpeakEnabled: boolean;
}

const GENDER_META = {
  der: {label: 'der · পুংলিঙ্গ', color: 'text-blue-700 dark:text-blue-400'},
  die: {label: 'die · স্ত্রীলিঙ্গ', color: 'text-rose-600 dark:text-rose-400'},
  das: {label: 'das · ক্লীবলিঙ্গ', color: 'text-emerald-700 dark:text-emerald-400'},
  plural: {label: 'die · বহুবচন', color: 'text-amber-700 dark:text-amber-400'},
} as const;

const GERMAN_CHARS = ['ä', 'ö', 'ü', 'ß'] as const;

export const PracticeStage: React.FC<PracticeStageProps> = ({
  mode,
  word,
  allWords,
  isMastered,
  onAwardXp,
  onNext,
  onPrev,
  autoSpeakEnabled,
}) => {
  const [meaningVisible, setMeaningVisible] = useState(false);
  const [isSpeakingAudio, setIsSpeakingAudio] = useState(false);

  // Write mode state
  const [answerInput, setAnswerInput] = useState('');
  const [writeOutcome, setWriteOutcome] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Quiz mode state
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  // Touch swipe tracking for Listen mode
  const touchStartXRef = useRef<number | null>(null);

  // Speech & Microphone engine
  const speech = useSpeechPractice(`${word.id}-${mode}`);

  // Reset per-word interactive states when word or mode changes
  useEffect(() => {
    setMeaningVisible(false);
    setAnswerInput('');
    setWriteOutcome('idle');
    setSelectedQuizId(null);

    if (mode === 'write') {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus({preventScroll: true});
      }, 60);
      return () => window.clearTimeout(timer);
    }

    if (mode === 'listen' && autoSpeakEnabled) {
      speakGerman(word.sp, {
        rate: 0.9,
        onStart: () => setIsSpeakingAudio(true),
        onEnd: () => setIsSpeakingAudio(false),
      });
    }
  }, [word.id, word.sp, mode, autoSpeakEnabled]);

  const quizOptions = useMemo(() => {
    if (mode !== 'quiz') return [];
    const distractors = shuffleArray(
      allWords.filter((item) => item.de !== word.de && item.bn !== word.bn)
    ).slice(0, 3);
    return shuffleArray([...distractors, word]);
  }, [mode, word, allWords]);

  const handlePlayAudio = (text: string, rate = 0.9) => {
    speakGerman(text, {
      rate,
      onStart: () => setIsSpeakingAudio(true),
      onEnd: () => setIsSpeakingAudio(false),
    });
  };

  const handleCheckWrite = () => {
    if (writeOutcome !== 'idle') {
      onNext();
      return;
    }
    if (!answerInput.trim()) {
      inputRef.current?.focus();
      return;
    }
    const ok = isExactAnswerMatch(answerInput, word.targets);
    setWriteOutcome(ok ? 'correct' : 'wrong');
    if (ok) {
      onAwardXp(15, true);
    }
    handlePlayAudio(word.sp, 0.9);
  };

  const handleInsertGermanChar = (char: string) => {
    const el = inputRef.current;
    if (!el) {
      setAnswerInput((prev) => prev + char);
      return;
    }
    const start = el.selectionStart ?? answerInput.length;
    const end = el.selectionEnd ?? answerInput.length;
    const nextVal = answerInput.slice(0, start) + char + answerInput.slice(end);
    setAnswerInput(nextVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  };

  const handlePickQuiz = (option: VocabWord) => {
    if (selectedQuizId !== null) return;
    setSelectedQuizId(option.id);
    const isCorrect = option.de === word.de;
    if (isCorrect) {
      onAwardXp(10, true);
    }
    handlePlayAudio(word.sp, 0.9);
  };

  // Keyboard shortcuts (Space to speak, 1-4 for quiz, Enter/Right for next)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (mode === 'quiz' && selectedQuizId === null && /^[1-4]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const opt = quizOptions[idx];
        if (opt) {
          e.preventDefault();
          handlePickQuiz(opt);
        }
        return;
      }

      if (e.key === ' ' && mode !== 'write') {
        e.preventDefault();
        handlePlayAudio(word.sp, 0.9);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
        return;
      }

      if (e.key === 'Enter' && (mode === 'listen' || selectedQuizId !== null)) {
        e.preventDefault();
        if (mode === 'listen') {
          onAwardXp(5, true);
        }
        onNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, word, quizOptions, selectedQuizId, onNext, onPrev, onAwardXp]);

  const genderInfo = word.gender ? GENDER_META[word.gender] : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || mode !== 'listen') return;
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(dx) > 65) {
      if (dx < 0) onNext();
      else onPrev();
    }
  };

  return (
    <section
      aria-live="polite"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="rounded-3xl bg-white dark:bg-[#131A2A] border border-slate-200/90 dark:border-slate-800 p-5 sm:p-8 shadow-xs transition-colors"
    >
      {/* Clean unboxed top metadata row (Zero-Pill discipline) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800/80 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
            {word.kap}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums whitespace-nowrap">সেকশন {word.sec}</span>
          {genderInfo && (
            <>
              <span aria-hidden="true">·</span>
              <span className={`font-semibold whitespace-nowrap ${genderInfo.color}`}>
                {genderInfo.label}
              </span>
            </>
          )}
        </div>

        {isMastered && (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold whitespace-nowrap shrink-0">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            শেখা হয়েছে
          </span>
        )}
      </div>

      {/* MODE 1: LISTEN & READ */}
      {mode === 'listen' && (
        <div className="pt-6 sm:pt-8 flex flex-col items-center text-center">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            শব্দটি শুনুন, পড়ুন, তারপর অর্থ মিলিয়ে নিন
          </p>

          <h2 className="mt-4 font-display-de text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-slate-900 dark:text-white leading-tight max-w-2xl">
            {word.de}
          </h2>

          {word.ex && (
            <button
              type="button"
              onClick={() => handlePlayAudio(word.ex, 0.88)}
              className="mt-3 inline-flex items-center gap-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors max-w-xl text-center"
              title="উদাহরণ বাক্যটি শুনুন"
            >
              <Volume2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span className="italic">{word.ex}</span>
            </button>
          )}

          {/* Audio Controls */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handlePlayAudio(word.sp, 0.9)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-2xl font-semibold text-sm sm:text-base whitespace-nowrap transition-all active:scale-[0.98] ${
                isSpeakingAudio
                  ? 'bg-blue-800 text-white'
                  : 'bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
              }`}
            >
              <Volume2 className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>উচ্চারণ শুনুন</span>
            </button>

            <button
              type="button"
              onClick={() => handlePlayAudio(word.sp, 0.55)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base whitespace-nowrap transition-colors active:scale-[0.98]"
            >
              <Gauge className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>ধীরে শুনুন</span>
            </button>
          </div>

          {/* Meaning Reveal Area (No nested bordered card — clean hairline tinted band) */}
          <div className="mt-7 w-full max-w-lg border-t border-slate-100 dark:border-slate-800 pt-6">
            {meaningVisible ? (
              <div className="space-y-1.5 py-2">
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug">
                  {word.bn}
                </p>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">
                  {word.en}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMeaningVisible(true)}
                className="w-full min-h-[52px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>বাংলা ও ইংরেজি অর্থ দেখুন</span>
              </button>
            )}
          </div>

          {/* Primary Thumb-Zone Footer Actions */}
          <div className="mt-7 w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            {meaningVisible && (
              <button
                type="button"
                onClick={() => setMeaningVisible(false)}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm whitespace-nowrap transition-colors"
              >
                <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>অর্থ লুকান</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onAwardXp(5, true);
                onNext();
              }}
              className="inline-flex items-center justify-center gap-2 min-h-[50px] px-7 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-base whitespace-nowrap transition-all active:scale-[0.98]"
            >
              <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>জানি · পরের শব্দ</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* MODE 2: SPEAKING STUDIO (MICROPHONE) */}
      {mode === 'speak' && (
        <div className="pt-6 sm:pt-8 flex flex-col items-center text-center">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            আগে শুনুন, তারপর মাইক্রোফোন ট্যাপ করে জার্মানে জোরে বলুন
          </p>

          <h2 className="mt-3 font-display-de text-3xl sm:text-4xl lg:text-[2.6rem] font-bold tracking-tight text-slate-900 dark:text-white leading-tight max-w-2xl">
            {word.de}
          </h2>
          <p className="mt-2 text-base sm:text-lg font-medium text-slate-600 dark:text-slate-300">
            {word.bn}
            {word.en && (
              <span className="text-slate-400 dark:text-slate-500 font-normal">
                {' '}
                · {word.en}
              </span>
            )}
          </p>

          {/* Reference Audio Triggers */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handlePlayAudio(word.sp, 0.9)}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-sm whitespace-nowrap transition-colors"
            >
              <Volume2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span>শুনুন</span>
            </button>
            <button
              type="button"
              onClick={() => handlePlayAudio(word.sp, 0.55)}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-sm whitespace-nowrap transition-colors"
            >
              <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <span>ধীরে</span>
            </button>
          </div>

          {/* Focal Microphone Console */}
          <div className="mt-7 w-full max-w-md flex flex-col items-center">
            <AudioWaveform
              active={speech.state === 'listening' || speech.state === 'recording'}
              level={speech.audioLevel}
              tone={speech.state === 'recording' ? 'recording' : 'listening'}
            />

            <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  if (speech.state === 'listening') {
                    speech.stopSpeechCheck();
                  } else {
                    speech.startSpeechCheck(word.targets, () => onAwardXp(10, true));
                  }
                }}
                className={`flex-1 inline-flex items-center justify-center gap-2.5 min-h-[56px] px-6 py-3 rounded-2xl font-bold text-base whitespace-nowrap transition-all active:scale-[0.98] ${
                  speech.state === 'listening'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                }`}
              >
                {speech.state === 'listening' ? (
                  <>
                    <Square className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                    <span>থামুন (শুনছি…)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span>মাইকে বলুন</span>
                  </>
                )}
              </button>

              {speech.isRecorderSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (speech.state === 'recording') {
                      speech.stopVoiceRecord();
                    } else {
                      speech.startVoiceRecord();
                    }
                  }}
                  className={`inline-flex items-center justify-center gap-2 min-h-[56px] px-4 py-3 rounded-2xl border font-semibold text-sm whitespace-nowrap transition-colors active:scale-[0.98] ${
                    speech.state === 'recording'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title="অফলাইনে নিজের কণ্ঠ রেকর্ড করে শুনে মিলিয়ে নিন"
                >
                  {speech.state === 'recording' ? (
                    <>
                      <Square className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                      <span>রেকর্ড থামান</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      <span>কণ্ঠ রেকর্ড</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Playback button for recorded voice */}
            {speech.recordedAudioUrl && (
              <button
                type="button"
                onClick={speech.playRecording}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold transition-colors"
              >
                <Play className="w-4 h-4 shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                <span>
                  {speech.isPlayingRecording ? 'আপনার রেকর্ড চলছে…' : 'আপনার রেকর্ড করা কণ্ঠ শুনুন'}
                </span>
              </button>
            )}

            {/* Live Transcript & Dual-Coded Result Readout */}
            <div className="mt-4 min-h-[68px] w-full flex flex-col items-center justify-center">
              {speech.interimText && (
                <p className="text-base font-medium text-blue-700 dark:text-blue-400">
                  “{speech.interimText}…”
                </p>
              )}

              {speech.state === 'success' && (
                <div className="w-full rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 px-4 py-3 text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center justify-center gap-2 font-bold text-sm sm:text-base">
                    <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span>{speech.message}</span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                    আপনি বলেছেন: “{speech.finalText}” · মিল {speech.similarity}%
                  </p>
                </div>
              )}

              {speech.state === 'retry' && (
                <div className="w-full rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 px-4 py-3 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center justify-center gap-2 font-semibold text-sm">
                    <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{speech.message}</span>
                  </div>
                  {speech.finalText && (
                    <p className="mt-1 text-xs font-mono tabular-nums text-amber-800 dark:text-amber-300">
                      শোনা গেছে: “{speech.finalText}”
                      {speech.similarity !== null ? ` · মিল ${speech.similarity}%` : ''}
                    </p>
                  )}
                </div>
              )}

              {speech.state === 'error' && (
                <div className="w-full rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 px-4 py-3 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-medium leading-relaxed">
                  {speech.message}
                </div>
              )}

              {(speech.state === 'listening' || speech.state === 'recording' || (speech.state === 'idle' && speech.message)) && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                  {speech.message}
                </p>
              )}
            </div>
          </div>

          {/* Secondary Self-Pass & Next Controls */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 w-full flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                onAwardXp(10, true);
                onNext();
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm sm:text-base whitespace-nowrap transition-colors active:scale-[0.98]"
            >
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>ঠিকমতো বলেছি (+10 XP)</span>
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm sm:text-base whitespace-nowrap transition-colors"
            >
              <span>পরের শব্দ</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* MODE 3: WRITING TRAINER */}
      {mode === 'write' && (
        <div className="pt-6 sm:pt-8 flex flex-col items-center text-center">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            এই অর্থের সঠিক জার্মান শব্দটি টাইপ করুন
          </p>

          <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug max-w-xl">
            {word.bn}
          </h2>
          <p className="mt-1 text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">
            {word.en}
          </p>

          <button
            type="button"
            onClick={() => handlePlayAudio(word.sp, 0.9)}
            className="mt-5 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-sm whitespace-nowrap transition-colors"
          >
            <Volume2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
            <span>হিন্ট হিসেবে উচ্চারণ শুনুন</span>
          </button>

          <div className="mt-6 w-full max-w-md space-y-4">
            <input
              ref={inputRef}
              type="text"
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCheckWrite();
                }
              }}
              disabled={writeOutcome !== 'idle'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="জার্মান শব্দ লিখুন…"
              aria-label="জার্মান শব্দ লিখুন"
              className="w-full min-h-[54px] px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-center font-display-de text-xl font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-75 transition-all"
            />

            {/* German Special Character Quick Keypad */}
            <div className="flex items-center justify-center gap-2">
              {GERMAN_CHARS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  disabled={writeOutcome !== 'idle'}
                  onClick={() => handleInsertGermanChar(ch)}
                  className="min-w-[52px] min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-display-de text-lg font-semibold transition-colors disabled:opacity-40"
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* Feedback Banner */}
            {writeOutcome !== 'idle' && (
              <div
                className={`rounded-2xl px-4 py-3.5 border text-sm sm:text-base font-semibold ${
                  writeOutcome === 'correct'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {writeOutcome === 'correct' ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span>একদম সঠিক! ({word.de})</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <XCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span>সঠিক উত্তর:</span>
                    </div>
                    <p className="font-display-de text-lg font-bold text-slate-900 dark:text-white">
                      {word.de}
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleCheckWrite}
              className={`w-full min-h-[52px] rounded-2xl font-semibold text-base inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                writeOutcome === 'idle'
                  ? 'bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {writeOutcome === 'idle' ? (
                <>
                  <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>যাচাই করুন</span>
                </>
              ) : (
                <>
                  <span>পরের শব্দ</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODE 4: QUIZ */}
      {mode === 'quiz' && (
        <div className="pt-6 sm:pt-8 flex flex-col items-center text-center">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            সঠিক বাংলা অর্থটি নির্বাচন করুন
          </p>

          <h2 className="mt-3 font-display-de text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight max-w-2xl">
            {word.de}
          </h2>
          {word.ex && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 italic max-w-xl">
              {word.ex}
            </p>
          )}

          <button
            type="button"
            onClick={() => handlePlayAudio(word.sp, 0.9)}
            className="mt-5 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-sm whitespace-nowrap transition-colors"
          >
            <Volume2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
            <span>উচ্চারণ শুনুন</span>
          </button>

          <div className="mt-7 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {quizOptions.map((option, idx) => {
              const isCorrectOption = option.de === word.de;
              const isSelected = selectedQuizId === option.id;
              const locked = selectedQuizId !== null;

              let stateClasses =
                'border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900/50 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/70';

              if (locked) {
                if (isCorrectOption) {
                  stateClasses =
                    'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-950 dark:text-emerald-100';
                } else if (isSelected) {
                  stateClasses =
                    'border-rose-500 bg-rose-50 dark:bg-rose-950/45 text-rose-950 dark:text-rose-100';
                } else {
                  stateClasses =
                    'border-slate-200 dark:border-slate-800 opacity-55 bg-white dark:bg-slate-900/30';
                }
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={locked}
                  onClick={() => handlePickQuiz(option)}
                  className={`flex items-center gap-3.5 min-h-[64px] p-4 rounded-2xl border transition-all active:scale-[0.99] text-left ${stateClasses}`}
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold flex items-center justify-center shrink-0 tabular-nums">
                    {locked && isCorrectOption ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : locked && isSelected ? (
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {option.bn}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {option.en}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedQuizId !== null && (
            <div className="mt-6 w-full flex justify-center">
              <button
                type="button"
                onClick={onNext}
                className="w-full sm:w-auto min-h-[50px] px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <span>পরের শব্দ</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
