import { useEffect } from 'react'
import { useQuotaStore } from '@/stores/useQuotaStore'
import { UsageCard } from '@/components/sections/usage/UsageCard'

export function UsageWidgetC() {
  const { results, isLoading, fetchAllQuotas } = useQuotaStore()
  useEffect(() => { fetchAllQuotas() }, [fetchAllQuotas])

  const allWindows = results
    .flatMap((r) => r.usage?.windows ? Object.entries(r.usage.windows).map(([key, w]) => ({ window: w, title: r.providerName, key })) : [])
    .sort((a, b) => (b.window.usedPercent ?? 0) - (a.window.usedPercent ?? 0))

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 animate-pulse rounded-lg bg-muted"/>)}</div>
  if (!allWindows.length) return <p className="text-sm text-muted-foreground">Нет данных</p>

  return (
    <div className="relative space-y-3 pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
      {allWindows.map((item, i) => {
        const pct = item.window.usedPercent ?? 0
        const dot = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-green-500'
        return (
          <div key={i} className="relative rounded-lg border bg-card p-3">
            <div className={`absolute -left-[19px] top-4 h-2.5 w-2.5 rounded-full border-2 border-background ${dot}`}/>
            <UsageCard title={`${item.title} · ${item.key}`} window={item.window} subtitle={null}/>
          </div>
        )
      })}
    </div>
  )
}
