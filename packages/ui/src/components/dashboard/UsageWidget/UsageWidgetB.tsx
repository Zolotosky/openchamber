import { useEffect } from 'react'
import { useQuotaStore } from '@/stores/useQuotaStore'
import { UsageCard } from '@/components/sections/usage/UsageCard'

export function UsageWidgetB() {
  const { results, isLoading, fetchAllQuotas } = useQuotaStore()
  useEffect(() => { fetchAllQuotas() }, [fetchAllQuotas])

  const providers = results.filter((r) => r.usage?.windows)
  if (isLoading) return <div className="flex gap-3">{[1,2,3].map(i=><div key={i} className="h-28 w-48 animate-pulse rounded-xl bg-muted"/>)}</div>
  if (!providers.length) return <p className="text-sm text-muted-foreground">Нет данных</p>

  return (
    <div className="space-y-4">
      {providers.map((provider) => (
        <div key={provider.providerId} className="rounded-xl border bg-card/50 backdrop-blur-sm p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{provider.providerName}</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(provider.usage!.windows).map(([key, w]) => (
              <div key={key} className="min-w-[200px] flex-1 rounded-lg bg-background/60 p-3 ring-1 ring-border">
                <UsageCard title={key} window={w} subtitle={null}/>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
