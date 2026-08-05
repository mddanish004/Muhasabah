type ProgressRingProps = {
  value: number;
  label: string;
  size?: number;
};

export function ProgressRing({ value, label, size = 120 }: ProgressRingProps) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border-subtle)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-[var(--text-primary)]">{Math.round(value)}%</div>
        <div className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-secondary)]">{label}</div>
      </div>
    </div>
  );
}
