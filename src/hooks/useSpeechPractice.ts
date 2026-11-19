import {useCallback, useEffect, useRef, useState} from 'react';
import {stopSpeaking} from '../utils/tts';
import {evaluateSpokenMatch} from '../utils/vocab';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export type MicState = 'idle' | 'listening' | 'recording' | 'success' | 'retry' | 'error';

export interface SpeechPracticeResult {
  state: MicState;
  interimText: string;
  finalText: string;
  similarity: number | null;
  message: string;
  isSpeechRecognitionSupported: boolean;
  isRecorderSupported: boolean;
  audioLevel: number;
  recordedAudioUrl: string | null;
  isPlayingRecording: boolean;
  startSpeechCheck: (targets: string[], onSuccess?: () => void) => void;
  stopSpeechCheck: () => void;
  startVoiceRecord: () => Promise<void>;
  stopVoiceRecord: () => void;
  playRecording: () => void;
  resetMic: () => void;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechPractice(wordKey: string): SpeechPracticeResult {
  const [state, setState] = useState<MicState>('idle');
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const fallbackPulseRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const gotResultRef = useRef(false);
  const recordedUrlRef = useRef<string | null>(null);

  const isSpeechRecognitionSupported = getSpeechRecognitionCtor() !== null;
  const isRecorderSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined';

  const cleanupAudioMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (fallbackPulseRef.current !== null) {
      window.clearInterval(fallbackPulseRef.current);
      fallbackPulseRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stopSpeechCheck = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }
    cleanupAudioMeter();
    setState((prev) => (prev === 'listening' ? 'idle' : prev));
  }, [cleanupAudioMeter]);

  const stopVoiceRecord = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    cleanupAudioMeter();
  }, [cleanupAudioMeter]);

  const resetMic = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    cleanupAudioMeter();
    setRecordedAudioUrl(null);
    setIsPlayingRecording(false);
    setState('idle');
    setInterimText('');
    setFinalText('');
    setSimilarity(null);
    setMessage('');
  }, [cleanupAudioMeter]);

  // Reset mic state cleanly whenever the active word changes
  useEffect(() => {
    resetMic();
  }, [wordKey, resetMic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetMic();
    };
  }, [resetMic]);

  const startVoiceRecord = useCallback(async () => {
    stopSpeaking();
    stopSpeechCheck();

    if (!isRecorderSupported) {
      setState('error');
      setMessage('এই ব্রাউজারে অডিও রেকর্ডিং সাপোর্ট নেই।');
      return;
    }

    try {
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = null;
        setRecordedAudioUrl(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Setup live Web Audio API level meter
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const scaled = Math.min(1, rms * 4.5);
          setAudioLevel(scaled);
          rafRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch {
        // Waveform visualization is optional; recording still works
      }

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const mimeType = preferredTypes.find(
        (type) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)
      );

      const recorder = mimeType ? new MediaRecorder(stream, {mimeType}) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {type: recorder.mimeType || 'audio/webm'});
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          recordedUrlRef.current = url;
          setRecordedAudioUrl(url);
          setMessage('আপনার কণ্ঠ রেকর্ড হয়েছে। নিচে ক্লিক করে শুনে জার্মান উচ্চারণের সাথে মেলান।');
        }
        setState('idle');
        cleanupAudioMeter();
      };

      recorder.start();
      setState('recording');
      setMessage('রেকর্ড হচ্ছে… জার্মান শব্দটি বলুন, তারপর থামাতে ট্যাপ করুন।');
    } catch (err) {
      cleanupAudioMeter();
      setState('error');
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMessage('মাইক্রোফোনের অনুমতি দেওয়া হয়নি। ব্রাউজার সেটিংস থেকে Microphone Allow করুন।');
      } else if (name === 'NotFoundError') {
        setMessage('কোনো মাইক্রোফোন পাওয়া যায়নি। হেডসেট বা ফোনের মাইক পরীক্ষা করুন।');
      } else {
        setMessage('মাইক্রোফোন চালু করা যায়নি। পুনরায় চেষ্টা করুন।');
      }
    }
  }, [cleanupAudioMeter, isRecorderSupported, stopSpeechCheck]);

  const startSpeechCheck = useCallback(
    (targets: string[], onSuccess?: () => void) => {
      stopSpeaking();
      stopVoiceRecord();

      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        // Fallback seamlessly to real microphone voice recording when SpeechRecognition is unavailable
        startVoiceRecord();
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }

      try {
        const recognition = new Ctor();
        recognition.lang = 'de-DE';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 6;
        gotResultRef.current = false;
        recognitionRef.current = recognition;

        setState('listening');
        setInterimText('');
        setFinalText('');
        setSimilarity(null);
        setMessage('শুনছি… স্পষ্ট করে জার্মান শব্দটি বলুন');

        // Smooth responsive level animation during active recognition (avoids Android audio-focus conflict with getUserMedia)
        let activeEnergy = 0.2;
        fallbackPulseRef.current = window.setInterval(() => {
          const jitter = Math.random() * 0.45;
          setAudioLevel(Math.min(1, activeEnergy + jitter));
        }, 120);

        recognition.onaudiostart = () => {
          activeEnergy = 0.25;
        };

        recognition.onspeechstart = () => {
          activeEnergy = 0.55;
          setMessage('আপনার কণ্ঠ শোনা যাচ্ছে…');
        };

        recognition.onspeechend = () => {
          activeEnergy = 0.15;
        };

        recognition.onresult = (event) => {
          const result = event.results[event.resultIndex];
          if (!result) return;

          const alternatives: string[] = [];
          for (let k = 0; k < result.length; k++) {
            const alt = result[k];
            if (alt && alt.transcript) {
              alternatives.push(alt.transcript.trim());
            }
          }

          if (!result.isFinal) {
            setInterimText(alternatives[0] || '');
            activeEnergy = 0.65;
            return;
          }

          gotResultRef.current = true;
          const evaluation = evaluateSpokenMatch(alternatives, targets);
          setInterimText('');
          setFinalText(evaluation.bestTranscript);
          setSimilarity(evaluation.score);

          if (evaluation.matched) {
            setState('success');
            setMessage('দারুণ উচ্চারণ! একদম সঠিক হয়েছে।');
            onSuccess?.();
          } else {
            setState('retry');
            setMessage('আরেকবার চেষ্টা করুন — ধীরে শুনে তারপর বলুন।');
          }
        };

        recognition.onerror = (event) => {
          gotResultRef.current = true;
          cleanupAudioMeter();
          recognitionRef.current = null;

          switch (event.error) {
            case 'not-allowed':
            case 'service-not-allowed':
              setState('error');
              setMessage(
                'মাইক্রোফোনের অনুমতি বন্ধ আছে। ব্রাউজারের অ্যাড্রেস বার থেকে Microphone Allow করে আবার চেষ্টা করুন।'
              );
              break;
            case 'no-speech':
              setState('retry');
              setMessage('কোনো শব্দ শোনা যায়নি। মাইকের কাছে এসে আরেকটু জোরে বলুন।');
              break;
            case 'audio-capture':
              setState('error');
              setMessage('মাইক্রোফোন শনাক্ত করা যায়নি। অন্য কোনো অ্যাপ মাইক ব্যবহার করছে কিনা দেখুন।');
              break;
            case 'network':
              setState('error');
              setMessage(
                'ভয়েস যাচাইয়ের জন্য ইন্টারনেট প্রয়োজন। অফলাইনে অনুশীলন করতে "কণ্ঠ রেকর্ড" বাটন ব্যবহার করুন।'
              );
              break;
            case 'aborted':
              setState('idle');
              setMessage('');
              break;
            default:
              setState('error');
              setMessage('ভয়েস চেনা যায়নি। আবার চেষ্টা করুন অথবা "কণ্ঠ রেকর্ড" ব্যবহার করুন।');
              break;
          }
        };

        recognition.onend = () => {
          cleanupAudioMeter();
          recognitionRef.current = null;
          if (!gotResultRef.current) {
            setState('retry');
            setMessage('কোনো কথা ধরা পড়েনি। মাইক বাটন চেপে আবার বলুন।');
          }
        };

        // CRITICAL: Call synchronously inside the user tap gesture for iOS Safari & Android Chrome
        recognition.start();
      } catch {
        cleanupAudioMeter();
        setState('error');
        setMessage('মাইক্রোফোন শুরু করা যায়নি। "কণ্ঠ রেকর্ড" বাটন দিয়ে চেষ্টা করুন।');
      }
    },
    [cleanupAudioMeter, startVoiceRecord, stopVoiceRecord]
  );

  const playRecording = useCallback(() => {
    if (!recordedUrlRef.current) return;
    stopSpeaking();

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    const audio = new Audio(recordedUrlRef.current);
    audioPlayerRef.current = audio;
    setIsPlayingRecording(true);
    audio.onended = () => setIsPlayingRecording(false);
    audio.onerror = () => setIsPlayingRecording(false);
    audio.play().catch(() => setIsPlayingRecording(false));
  }, []);

  return {
    state,
    interimText,
    finalText,
    similarity,
    message,
    isSpeechRecognitionSupported,
    isRecorderSupported,
    audioLevel,
    recordedAudioUrl,
    isPlayingRecording,
    startSpeechCheck,
    stopSpeechCheck,
    startVoiceRecord,
    stopVoiceRecord,
    playRecording,
    resetMic,
  };
}
