import { useEffect } from 'react'
import { useQuotaStore } from '@/stores/useQuotaStore'
import { UsageCard } from '@/components/sections/usage/UsageCard'
import { cn } from '@/lib/utils'

export function UsageWidgetA() {
  const { results, isLoading, fetchAllQuotas } = useQuotaStore()
  useEffect(() => { fetchAllQuotas() }, [fetchAllQuotas])

  const allWindows = results.flatMap((r) =>
    r.usage?.windows ? Object.entries(r.usage.windows).map(([key, w]) => ({ window: w, title: r.providerName, subtitle: key })) : []
  )

  if (isLoading) return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-28 animate-pulse rounded-xl bg-muted"/>)}</div>
  if (!allWindows.length) return <p className="text-sm text-muted-foreground">Нет данных</p>

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {allWindows.map((item, i) => {
        const pct = item.window.usedPercent ?? 0
        const glow = pct >= 80 ? 'border-red-500/30 shadow-red-500/20' : pct >= 50 ? 'border-amber-500/30 shadow-amber-500/20' : 'border-green-500/20 shadow-green-500/10'
        return <div key={i} className={cn('rounded-xl border bg-card p-4 shadow-md transition-all hover:shadow-lg', glow)}><UsageCard title={item.title} window={item.window} subtitle={item.subtitle}/></div>
      })}
    </div>
  )
}
