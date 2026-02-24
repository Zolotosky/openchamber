import React from 'react';
import { cn } from '@/lib/utils';
import { RiRefreshLine, RiErrorWarningLine } from '@remixicon/react';
import { useMonitoringStore } from '@/stores/useMonitoringStore';
import { ServerCard } from './ServerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { ButtonSmall } from '@/components/ui/button-small';
import { Card, CardContent } from '@/components/ui/card';
import { gaugeColor } from './GaugeRing';

/* ---------- Summary card ---------- */
const SummaryCard: React.FC<{
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
}> = ({ label, value, sublabel, color }) => (
  <div
    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
    style={{ borderColor: 'var(--interactive-border)' }}
  >
    <span className="typography-meta text-muted-foreground">{label}:</span>
    <span
      className="typography-ui-label font-semibold"
      style={color ? { color } : undefined}
    >
      {value}
    </span>
    {sublabel && (
      <span className="typography-micro text-muted-foreground">{sublabel}</span>
    )}
  </div>
);

/* ---------- Skeleton card ---------- */
const ServerCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <Card className={cn("py-0 gap-0", className)}>
    <CardContent className="p-4 space-y-3">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-[10px]" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      {/* Role skeleton */}
      <Skeleton className="h-5 w-40 rounded-lg" />
      {/* Gauges skeleton */}
      <div className="flex justify-around py-2">
        <Skeleton className="h-[68px] w-[68px] rounded-full" />
        <Skeleton className="h-[68px] w-[68px] rounded-full" />
        <Skeleton className="h-[68px] w-[68px] rounded-full" />
      </div>
      {/* Bars skeleton */}
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </CardContent>
  </Card>
);

/* ---------- Error state ---------- */
const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div
    className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card py-12 text-center"
    style={{ borderColor: 'var(--interactive-border)' }}
  >
    <RiErrorWarningLine className="h-12 w-12 text-muted-foreground/40" />
    <div className="space-y-1">
      <p className="typography-ui-label font-medium text-foreground">
        Failed to load monitoring data
      </p>
      <p className="typography-meta text-muted-foreground">
        Check network connection and try again
      </p>
    </div>
    <ButtonSmall variant="outline" onClick={onRetry}>
      Try again
    </ButtonSmall>
  </div>
);

/* ---------- Main section ---------- */
export const MonitoringSection: React.FC = () => {
  const { servers, loading, error, fetchServers } = useMonitoringStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchServers();
    setRefreshing(false);
  };

  // Summary calculations
  const onlineServers = servers.filter((s) => s.online);
  const onlineCount = onlineServers.length;
  const totalCount = servers.length;
  const avgCpu =
    onlineServers.length > 0
      ? onlineServers.reduce((sum, s) => sum + s.cpu, 0) / onlineServers.length
      : 0;
  const avgRam =
    onlineServers.length > 0
      ? onlineServers.reduce((sum, s) => sum + s.ram_percent, 0) /
        onlineServers.length
      : 0;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h2 className="typography-ui-header font-semibold text-foreground">
            Monitoring
          </h2>
          <p className="typography-meta text-muted-foreground">
            Server cluster status &middot; updates every 30s
          </p>
        </div>
        <ButtonSmall
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RiRefreshLine
            className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
          />
          Refresh
        </ButtonSmall>
      </div>

      {/* Error alert (stale data) */}
      {error && servers.length > 0 && (
        <div
          className="rounded-lg border px-3 py-2 typography-meta"
          style={{
            borderColor: 'var(--status-warning-border)',
            backgroundColor: 'var(--status-warning-background)',
            color: 'var(--status-warning)',
          }}
        >
          Failed to update &middot; showing last known data
        </div>
      )}

      {/* Summary bar */}
      {servers.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <SummaryCard
            label="Servers"
            value={`${onlineCount}/${totalCount}`}
            sublabel="online"
          />
          <SummaryCard
            label="CPU avg"
            value={`${avgCpu.toFixed(1)}%`}
            color={gaugeColor(avgCpu)}
          />
          <SummaryCard
            label="RAM avg"
            value={`${avgRam.toFixed(1)}%`}
            color={gaugeColor(avgRam)}
          />
        </div>
      )}

      {/* Server cards grid */}
      {loading && servers.length === 0 ? (
        <div className="flex justify-center gap-4 overflow-x-auto pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <ServerCardSkeleton key={i} className="w-[260px] flex-shrink-0" />
          ))}
        </div>
      ) : error && servers.length === 0 ? (
        <ErrorState onRetry={handleRefresh} />
      ) : (
        <div className="flex justify-center gap-4 overflow-x-auto pb-1">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              className="w-[260px] flex-shrink-0"
            />
          ))}
        </div>
      )}
    </section>
  );
};
