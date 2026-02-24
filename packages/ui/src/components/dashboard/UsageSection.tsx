import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RiRefreshLine } from '@remixicon/react';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { UsageCard } from '@/components/sections/usage/UsageCard';
import { ButtonSmall } from '@/components/ui/button-small';

export const UsageSection: React.FC = () => {
  const { results, isLoading, fetchAllQuotas, displayMode, setDisplayMode, lastUpdated } = useQuotaStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchAllQuotas();
  }, [fetchAllQuotas]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllQuotas();
    setRefreshing(false);
  };

  // Все провайдеры у которых есть данные (включая Anthropic)
  const activeProviders = results.filter((r) => r.usage?.windows);

  // Считаем сколько всего окон для subtitle
  const totalWindows = activeProviders.reduce(
    (sum, r) => sum + Object.keys(r.usage!.windows).length, 0
  );

  return (
    <section className="space-y-4">
      {/* Header — как у Monitoring */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h2 className="typography-ui-header font-semibold text-foreground">
            Usage
          </h2>
          <p className="typography-meta text-muted-foreground">
            AI providers rate limits &middot; {activeProviders.length} provider{activeProviders.length !== 1 ? 's' : ''}, {totalWindows} windows
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Rate limits label + last updated */}
          <span className="text-xs text-muted-foreground">
            Rate limits{lastUpdated ? ` · Last updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          {/* Used / Remaining toggle */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              onClick={() => setDisplayMode('usage')}
              className={cn(
                'px-2.5 py-1 transition-colors',
                displayMode === 'usage'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              Used
            </button>
            <button
              onClick={() => setDisplayMode('remaining')}
              className={cn(
                'px-2.5 py-1 transition-colors',
                displayMode === 'remaining'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              Remaining
            </button>
          </div>
          <ButtonSmall
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            className="gap-1.5"
          >
            <RiRefreshLine
              className={cn('h-3.5 w-3.5', (refreshing || isLoading) && 'animate-spin')}
            />
            Refresh
          </ButtonSmall>
        </div>
      </div>

      {/* Providers */}
      {isLoading && !activeProviders.length ? (
        <div className="flex gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 flex-1 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : activeProviders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No configured providers</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {activeProviders.map((provider) => {
            const windows = Object.entries(provider.usage!.windows);
            return (
              <div
                key={provider.providerId}
                className="flex-grow basis-[300px] rounded-xl border bg-card p-4 space-y-3"
              >
                {/* Provider name */}
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {provider.providerName}
                </p>
                {/* Windows grid */}
                <div className="flex flex-wrap gap-3">
                  {windows.map(([key, w]) => (
                    <div
                      key={key}
                      className="min-w-[180px] flex-1 rounded-lg bg-background/60 p-3 ring-1 ring-border"
                    >
                      <UsageCard title={key} window={w} subtitle={null} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
