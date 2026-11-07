export type RingMode = 'idle' | 'spinning' | 'progress' | 'complete' | 'error';

const ringLength = (radius: number) => 2 * Math.PI * radius;

export function UpdateProgressRing({ mode, percent, size, stroke }: { mode: RingMode; percent: number; size: number; stroke: number }) {
  const center = size / 2;
  const radius = center - stroke / 2;
  const length = ringLength(radius);
  const filled = mode === 'complete' ? 1 : mode === 'progress' ? Math.max(0, Math.min(100, percent)) / 100 : 0;
  return <svg className={`progress-ring progress-ring-${mode}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    <circle className="progress-ring-track" cx={center} cy={center} r={radius} strokeWidth={stroke} />
    {mode === 'spinning'
      ? <circle className="progress-ring-arc" cx={center} cy={center} r={radius} strokeWidth={stroke} strokeDasharray={`${length * 0.24} ${length}`} />
      : <circle className="progress-ring-fill" cx={center} cy={center} r={radius} strokeWidth={stroke} strokeDasharray={length} strokeDashoffset={length * (1 - filled)} transform={`rotate(-90 ${center} ${center})`} />}
  </svg>;
}
