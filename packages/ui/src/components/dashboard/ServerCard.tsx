import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { GaugeRing } from './GaugeRing';
import { MetricBar } from './MetricBar';
import {
  RiTimeLine,
  RiCpuLine,
  RiShieldKeyholeLine,
  RiDatabase2Line,
  RiBarChartLine,
  RiHome4Line,
  RiServerLine,
} from '@remixicon/react';
import type { ServerMetrics } from '@/stores/useMonitoringStore';

const SERVER_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  cpu: RiCpuLine,
  shield: RiShieldKeyholeLine,
  database: RiDatabase2Line,
  'bar-chart': RiBarChartLine,
  home: RiHome4Line,
};

const StatusBadge: React.FC<{ online: boolean }> = ({ online }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 typography-micro font-medium"
    style={{
      backgroundColor: online
        ? 'var(--status-success-background)'
        : 'var(--status-error-background)',
      color: online
        ? 'var(--status-success)'
        : 'var(--status-error)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: online
        ? 'var(--status-success-border)'
        : 'var(--status-error-border)',
    }}
  >
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{
        backgroundColor: online
          ? 'var(--status-success)'
          : 'var(--status-error)',
      }}
    />
    {online ? 'Online' : 'Offline'}
  </span>
);

interface ServerCardProps {
  server: ServerMetrics;
  className?: string;
}

export const ServerCard: React.FC<ServerCardProps> = ({ server, className }) => {
  const IconComponent = SERVER_ICONS[server.icon] ?? RiServerLine;

  return (
    <Card className={cn("py-0 gap-0 overflow-hidden", className)}>
      <CardContent className="p-4 space-y-3">
        {/* Header: icon + name/ip + status badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon with status-colored background */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[10px]"
              style={{
                backgroundColor: server.online
                  ? 'var(--status-success-background)'
                  : 'var(--status-error-background)',
              }}
            >
              <IconComponent
                className="h-5 w-5"
                style={{
                  color: server.online
                    ? 'var(--status-success)'
                    : 'var(--status-error)',
                }}
              />
            </div>

            <div className="flex flex-col">
              <span className="typography-ui-label font-bold text-foreground leading-tight">
                {server.name}
              </span>
              <span className="typography-micro text-muted-foreground font-mono">
                {server.ip}
              </span>
            </div>
          </div>

          <StatusBadge online={server.online} />
        </div>

        {/* Role label */}
        <div
          className="inline-block rounded-lg px-2.5 py-1 typography-micro text-muted-foreground"
          style={{ backgroundColor: 'var(--surface-subtle)' }}
        >
          {server.role}
        </div>

        {server.online ? (
          <>
            {/* Gauges row */}
            <div className="flex justify-around items-center py-2">
              <GaugeRing label="CPU" value={server.cpu} />
              <GaugeRing label="RAM" value={server.ram_percent} />
              <GaugeRing label="DISK" value={server.disk_percent} />
            </div>

            <Separator />

            {/* Detail bars */}
            <div className="space-y-2.5">
              <MetricBar
                label="RAM"
                percent={server.ram_percent}
                detail={`${server.ram_used} / ${server.ram_total} GB`}
              />
              <MetricBar
                label="Disk"
                percent={server.disk_percent}
                detail={`${server.disk_used} / ${server.disk_total} GB`}
              />
            </div>

            <Separator />

            {/* Uptime footer */}
            <div className="flex items-center gap-1.5">
              <RiTimeLine className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="typography-micro text-muted-foreground">
                Uptime: {server.uptime}
              </span>
            </div>
          </>
        ) : (
          /* Offline state */
          <div className="py-6 text-center">
            <p className="typography-ui-label text-muted-foreground">
              Server unavailable
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
