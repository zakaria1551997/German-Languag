let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

function selectBestGermanVoice(): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  if (!voices.length) return null;

  const exactDeDE = voices.filter((v) => v.lang.toLowerCase() === 'de-de');
  const preferredExact =
    exactDeDE.find((v) => /google|anna|markus|helena|katja|conrad|petra|yannick/i.test(v.name)) ||
    exactDeDE[0];
  if (preferredExact) return preferredExact;

  const anyGerman = voices.find((v) => v.lang.toLowerCase().startsWith('de'));
  return anyGerman || null;
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (isTTSSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors
    }
  }
}

export function speakGerman(
  text: string,
  options?: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  if (!isTTSSupported() || !text.trim()) {
    options?.onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = options?.rate ?? 0.9;
    utterance.pitch = 1;

    const voice = selectBestGermanVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => options?.onStart?.();
    utterance.onend = () => options?.onEnd?.();
    utterance.onerror = () => options?.onEnd?.();

    window.speechSynthesis.speak(utterance);
  } catch {
    options?.onEnd?.();
  }
}
