import {RAW_VOCAB, TOTAL_DEFAULT_LEVELS, type RawVocabEntry} from '../data/rawVocab';
import type {ArticleGender, CustomVocabInput, VocabMap, VocabWord} from '../types/vocab';

export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,!?;:"„“”'()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function foldGermanDiacritics(str: string): string {
  return str
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

export function similarityScore(aRaw: string, bRaw: string): number {
  const a = normalizeText(aRaw);
  const b = normalizeText(bRaw);
  if (a === b) return 1;
  if (!a || !b) return 0;

  const compute = (s1: string, s2: string) => {
    let prev = Array.from({length: s2.length + 1}, (_, i) => i);
    for (let x = 1; x <= s1.length; x++) {
      const curr = [x];
      for (let y = 1; y <= s2.length; y++) {
        curr[y] = Math.min(
          prev[y] + 1,
          curr[y - 1] + 1,
          prev[y - 1] + (s1[x - 1] === s2[y - 1] ? 0 : 1)
        );
      }
      prev = curr;
    }
    return 1 - prev[s2.length] / Math.max(s1.length, s2.length);
  };

  const direct = compute(a, b);
  const folded = compute(foldGermanDiacritics(a), foldGermanDiacritics(b));
  return Math.max(direct, folded);
}

export function detectArticleGender(core: string): ArticleGender {
  const trimmed = core.trim();
  if (/^\s*die\s+.*\(Pl\.\)/i.test(trimmed)) return 'plural';
  if (/^der\s+/i.test(trimmed)) return 'der';
  if (/^die\s+/i.test(trimmed)) return 'die';
  if (/^das\s+/i.test(trimmed)) return 'das';
  return null;
}

export function parseWord(
  full: string,
  en: string,
  bn: string,
  kap: string,
  sec: string,
  indexSeed: number
): VocabWord {
  let ex = '';
  let core = full.trim();
  const match = core.match(/\(([^)]+)\)\s*$/);
  if (match && match[1].split(' ').length > 1 && !match[1].startsWith('+')) {
    ex = match[1];
    core = core.replace(match[0], '').trim();
  }

  const sp = core
    .replace(/\(.*?\)/g, '')
    .split(',')[0]
    .replace(/\|/g, '')
    .replace(/…|\.{3}/g, '')
    .trim();

  const strippedArticle = sp.replace(/^(der\/die|die\/das|der\/das|der|die|das)\s+/i, '');
  const targetSet = new Set<string>([normalizeText(sp), normalizeText(strippedArticle)]);

  if (sp.includes('/')) {
    sp.split('/').forEach((part) => {
      const cleaned = normalizeText(part);
      if (cleaned) targetSet.add(cleaned);
    });
  }

  return {
    id: `${kap}-${sec}-${indexSeed}-${sp}`,
    de: core,
    sp,
    ex,
    en,
    bn,
    kap,
    sec,
    gender: detectArticleGender(core),
    targets: Array.from(targetSet).filter(Boolean),
  };
}

export function buildLevelsFromRaw(
  raw: RawVocabEntry[] = RAW_VOCAB,
  totalLevels: number = TOTAL_DEFAULT_LEVELS
): VocabMap {
  let kap = 'Kapitel 1: Guten Tag!';
  let sec = '1a';
  const words: VocabWord[] = [];

  raw.forEach((item, idx) => {
    if (Array.isArray(item)) {
      if (item[0].startsWith('Kapitel')) {
        kap = item[0];
      } else {
        sec = item[0];
      }
      return;
    }

    if (typeof item === 'string' && item.includes('~')) {
      const parts = item.split('~');
      words.push(
        parseWord(
          parts[0].trim(),
          (parts[1] || '').trim(),
          parts.slice(2).join('~').trim(),
          kap,
          sec,
          idx
        )
      );
    }
  });

  const baseCount = Math.floor(words.length / totalLevels);
  const remainder = words.length % totalLevels;
  const levels: VocabMap = {};
  let cursor = 0;

  for (let k = 0; k < totalLevels; k++) {
    const count = baseCount + (k < remainder ? 1 : 0);
    const slice = words.slice(cursor, cursor + count);
    cursor += count;
    const levelWords = slice.length > 0 ? slice : [words[k % words.length]];
    levels[k + 1] = {
      level: k + 1,
      title: levelWords[0].kap,
      words: levelWords,
    };
  }

  return levels;
}

export function buildLevelsFromCustomJson(jsonText: string): VocabMap {
  const parsed: unknown = JSON.parse(jsonText);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('ফাইলে কোনো শব্দ পাওয়া যায়নি।');
  }

  const map: VocabMap = {};
  parsed.forEach((item, idx) => {
    const entry = item as CustomVocabInput;
    if (!entry || typeof entry.de !== 'string' || !entry.de.trim()) {
      return;
    }
    const levelNum = Number(entry.level) > 0 ? Math.floor(Number(entry.level)) : 1;
    if (!map[levelNum]) {
      map[levelNum] = {
        level: levelNum,
        title: `কাস্টম লেভেল ${levelNum}`,
        words: [],
      };
    }
    map[levelNum].words.push(
      parseWord(
        entry.de,
        entry.en || '',
        entry.bn || '',
        `কাস্টম লেভেল ${levelNum}`,
        `${levelNum}`,
        idx
      )
    );
  });

  if (Object.keys(map).length === 0) {
    throw new Error('সঠিক JSON ফরম্যাট নয়। উদাহরণ: [{"de":"Hallo","en":"hello","bn":"হ্যালো","level":1}]');
  }

  return map;
}

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let k = arr.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [arr[k], arr[j]] = [arr[j], arr[k]];
  }
  return arr;
}

export function isExactAnswerMatch(input: string, targets: string[]): boolean {
  const normalized = normalizeText(input);
  if (!normalized) return false;
  return targets.some((target) => target === normalized);
}

export function evaluateSpokenMatch(
  transcripts: string[],
  targets: string[]
): {matched: boolean; bestTranscript: string; score: number} {
  let bestScore = 0;
  let bestTranscript = transcripts[0] || '';

  for (const spoken of transcripts) {
    const cleanSpoken = normalizeText(spoken);
    if (!cleanSpoken) continue;
    for (const target of targets) {
      const score = similarityScore(cleanSpoken, target);
      if (score > bestScore) {
        bestScore = score;
        bestTranscript = spoken;
      }
      // Also check if target is cleanly contained as a word inside a longer phrase
      if (cleanSpoken.includes(target) && target.length >= 3) {
        const containedScore = Math.max(score, 0.92);
        if (containedScore > bestScore) {
          bestScore = containedScore;
          bestTranscript = spoken;
        }
      }
    }
  }

  return {
    matched: bestScore >= 0.78,
    bestTranscript,
    score: Math.round(bestScore * 100),
  };
}
