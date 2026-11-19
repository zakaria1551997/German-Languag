import React from 'react';

interface AudioWaveformProps {
  active: boolean;
  level: number;
  tone?: 'listening' | 'recording';
}

const BAR_WEIGHTS = [
  0.32, 0.55, 0.78, 0.48, 0.92, 0.65, 1.0, 0.82, 0.58,
  0.95, 0.74, 0.88, 0.6, 0.85, 0.45, 0.7, 0.5, 0.35,
];

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  active,
  level,
  tone = 'listening',
}) => {
  const barColor =
    tone === 'recording'
      ? 'bg-rose-600 dark:bg-rose-400'
      : 'bg-blue-700 dark:bg-blue-400';

  return (
    <div
      className="flex items-center justify-center gap-1 h-10 px-3"
      aria-hidden="true"
    >
      {BAR_WEIGHTS.map((weight, idx) => {
        const clamped = active
          ? Math.max(0.18, Math.min(1, level * weight * 1.25 + 0.14))
          : 0.14;
        return (
          <span
            key={idx}
            className={`w-1 h-8 rounded-full origin-center transition-transform duration-100 ${
              active ? barColor : 'bg-slate-300 dark:bg-slate-700'
            }`}
            style={{transform: `scaleY(${clamped.toFixed(2)})`}}
          />
        );
      })}
    </div>
  );
};
