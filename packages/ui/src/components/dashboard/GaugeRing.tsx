import React from 'react';

function gaugeColor(percent: number): string {
  if (percent < 60) return 'var(--status-success)';
  if (percent < 85) return 'var(--status-warning)';
  return 'var(--status-error)';
}

interface GaugeRingProps {
  label: string;
  value: number;
  size?: number;
  strokeWidth?: number;
}

export const GaugeRing: React.FC<GaugeRingProps> = ({
  label,
  value,
  size = 68,
  strokeWidth = 5,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * 2 * radius;
  const offset = circumference * (1 - Math.min(value, 100) / 100);
  const color = gaugeColor(value);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-subtle)"
            strokeWidth={strokeWidth}
            opacity={0.5}
          />
          {/* Value arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
            }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono font-semibold"
            style={{ fontSize: '0.8rem', color }}
          >
            {value.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="typography-micro text-muted-foreground font-medium">
        {label}
      </span>
    </div>
  );
};

export { gaugeColor };
