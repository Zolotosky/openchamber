import React from 'react';
import { gaugeColor } from './GaugeRing';

interface MetricBarProps {
  label: string;
  percent: number;
  detail: string;
}

export const MetricBar: React.FC<MetricBarProps> = ({ label, percent, detail }) => {
  const color = gaugeColor(percent);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="typography-micro font-semibold text-muted-foreground">
          {label}
        </span>
        <span className="typography-micro font-mono text-foreground">
          {detail}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--surface-subtle)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: color,
            transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
};
