# ТЗ: Dashboard — Мониторинг серверов в OpenChamber

**Дата:** 2026-02-22
**Проект:** OpenChamber (`/home/aiko/openchamber/`)
**Приложение:** http://192.168.0.176:8080/
**Технологии:** React, TypeScript, Tailwind v4, Zustand, Express

---

## 1. Контекст и цель

Страница Dashboard (`DashboardView.tsx`) сейчас — заглушка "Coming soon" (20 строк). Нужно реализовать полноценный Dashboard с первой секцией — мониторинг серверов кластера (карточки с CPU/RAM/Disk метриками), аналогично тому что есть в aiko-cabinet на http://192.168.0.176:8501/cabinet/monitoring.

Dashboard должен быть расширяемым — сейчас содержит только мониторинг, в будущем можно добавлять другие секции (Quick Actions, Recent Sessions и т.д.) без рефакторинга.

Тема (light/dark/system) синхронизируется автоматически через существующую систему CSS-переменных.

---

## 2. Архитектура и структура файлов

### 2.1 Новые файлы

| Файл | Назначение |
|---|---|
| `packages/web/server/lib/monitoring/index.js` | Серверный модуль — сбор метрик серверов через ping + SSH/psutil |
| `packages/ui/src/stores/useMonitoringStore.ts` | Zustand store — состояние серверов, polling, loading, ошибки |
| `packages/ui/src/components/dashboard/GaugeRing.tsx` | SVG ring gauge компонент (CPU/RAM/Disk кольцевой индикатор) |
| `packages/ui/src/components/dashboard/MetricBar.tsx` | Горизонтальный прогресс-бар метрики (RAM/Disk детализация) |
| `packages/ui/src/components/dashboard/ServerCard.tsx` | Карточка одного сервера со всеми метриками |
| `packages/ui/src/components/dashboard/MonitoringSection.tsx` | Секция "Мониторинг" — заголовок, summary bar, сетка карточек |

### 2.2 Изменяемые файлы

| Файл | Что меняется |
|---|---|
| `packages/ui/src/components/views/DashboardView.tsx` | Полная замена заглушки "Coming soon" на расширяемый layout с секциями |
| `packages/web/server/index.js` | Добавить 1 route: `GET /api/monitoring/servers` |

---

## 3. API-интеграция

### 3.1 Проблема

NiceGUI-приложение на `192.168.0.176:8501` **не имеет REST API**. Все URL (включая `/api/servers`, `/api/monitoring`) возвращают HTML-страницы NiceGUI-фреймворка. Данные мониторинга собираются внутри Python-процесса через SSH и psutil и не экспонируются наружу.

### 3.2 Решение: собственный endpoint в OpenChamber web server

Создать серверный модуль `packages/web/server/lib/monitoring/index.js` и зарегистрировать один route в `packages/web/server/index.js`.

**Route:** `GET /api/monitoring/servers`

### 3.3 Серверный модуль: `packages/web/server/lib/monitoring/index.js`

Логика портируется из `aiko-cabinet/services/monitoring.py` (`get_server_metrics_ssh` + `get_all_servers_metrics`).

**Конфигурация серверов (хардкод в модуле):**

```javascript
const SERVERS_CONFIG = [
  { id: 'aiko',   ip: '192.168.0.176', name: 'AI Brain',       role: 'Router, OpenCode, Cabinet',  icon: 'cpu' },
  { id: 'proxy',  ip: '192.168.0.178', name: 'Proxy',          role: 'Xray, Cloudflare Tunnel',    icon: 'shield' },
  { id: 'qdrant', ip: '192.168.0.180', name: 'Qdrant',         role: 'Vector DB, Embedding',       icon: 'database' },
  { id: 'zabbix', ip: '192.168.0.181', name: 'Zabbix',         role: 'Monitoring',                 icon: 'bar-chart' },
  { id: 'ha',     ip: '192.168.0.185', name: 'Home Assistant',  role: 'Smart Home, Alice',         icon: 'home' },
];
```

**Алгоритм сбора метрик (для каждого сервера):**

```
1. Ping: child_process.exec("ping -c 1 -W 2 {ip}")
   → returncode === 0 → online: true
   → иначе → online: false, вернуть пустые метрики

2. Если online:
   a) Локальный сервер (ip === '192.168.0.176'):
      Выполнить команды ЛОКАЛЬНО (без SSH):
      - top -bn1 | grep 'Cpu(s)' | awk '{print $2}'       → cpu %
      - free -b | awk '/Mem/{print $2, $3}'                → ram_total, ram_used (bytes)
      - df -B1 / | awk 'NR==2{print $2, $3, $5}'           → disk_total, disk_used, disk_percent
      - uptime -p                                           → uptime string

   b) Удалённый сервер:
      SSH команда (все метрики за один ssh-вызов):
      - Для HA (192.168.0.185):
        ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no -i /home/aiko/.ssh/id_ed25519 root@{ip} "..."
      - Для остальных:
        ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no aiko@{ip} "..."
      
      Содержимое SSH команды:
        "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}'; free -b | awk '/Mem/{print \$2, \$3}'; df -B1 / | awk 'NR==2{print \$2, \$3, \$5}'; uptime -p"

3. Парсинг stdout (4 строки):
   - Строка 1: cpu (float)
   - Строка 2: ram_total ram_used (bytes → GB, /1024³, round to 1 decimal)
   - Строка 3: disk_total disk_used disk_percent (bytes → GB)
   - Строка 4: uptime string (убрать префикс "up ")
```

**Timeout:** 8 секунд на каждый сервер. Все запросы параллельно через `Promise.all` (или `Promise.allSettled` для graceful handling).

**Кэширование:** Результат кэшировать на 15 секунд в переменной модуля. Если запрос приходит раньше чем через 15 секунд — отдавать кэш. Это защищает от перегрузки SSH при частых запросах от нескольких клиентов.

```javascript
let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15_000;

export async function getServersMetrics() {
  const now = Date.now();
  if (cachedResult && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedResult;
  }
  const result = await collectAllMetrics();
  cachedResult = result;
  cacheTimestamp = now;
  return result;
}
```

### 3.4 Регистрация route в index.js

Добавить в `packages/web/server/index.js` после блока `/api/openchamber/*` routes:

```javascript
import { getServersMetrics } from './lib/monitoring/index.js';

app.get('/api/monitoring/servers', async (_req, res) => {
  try {
    const servers = await getServersMetrics();
    res.json({ servers, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch server metrics' });
  }
});
```

### 3.5 Response format

```typescript
interface ServerMetrics {
  id: string;          // 'aiko' | 'proxy' | 'qdrant' | 'zabbix' | 'ha'
  name: string;        // display name, например 'AI Brain'
  ip: string;          // '192.168.0.176'
  role: string;        // 'Router, OpenCode, Cabinet'
  icon: string;        // идентификатор иконки для маппинга на Remixicon
  online: boolean;     // true если ping успешен
  cpu: number;         // 0-100, процент загрузки CPU
  ram_percent: number; // 0-100, процент использования RAM
  ram_used: number;    // использовано RAM в GB (1 decimal)
  ram_total: number;   // всего RAM в GB (1 decimal)
  disk_percent: number;// 0-100, процент использования диска
  disk_used: number;   // использовано диска в GB (1 decimal)
  disk_total: number;  // всего диска в GB (1 decimal)
  uptime: string;      // '15d 3h' | 'N/A'
}

// Response: GET /api/monitoring/servers
interface MonitoringResponse {
  servers: ServerMetrics[];
  timestamp: number;    // Date.now() момент ответа
}
```

При ошибке сбора метрик для конкретного сервера — вернуть объект с `online: false` и нулевыми метриками (как в Python-версии):

```javascript
{
  id: server.id,
  name: server.name,
  ip: server.ip,
  role: server.role,
  icon: server.icon,
  online: false,
  cpu: 0,
  ram_percent: 0,
  ram_used: 0,
  ram_total: 0,
  disk_percent: 0,
  disk_used: 0,
  disk_total: 0,
  uptime: 'N/A'
}
```

---

## 4. Zustand Store: `useMonitoringStore`

### 4.1 Интерфейс

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ServerMetrics {
  id: string;
  name: string;
  ip: string;
  role: string;
  icon: string;
  online: boolean;
  cpu: number;
  ram_percent: number;
  ram_used: number;
  ram_total: number;
  disk_percent: number;
  disk_used: number;
  disk_total: number;
  uptime: string;
}

interface MonitoringState {
  servers: ServerMetrics[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;

  fetchServers: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}
```

### 4.2 Паттерн реализации

По аналогии с `useQuotaStore`, `useConfigStore` — без `persist` middleware (данные всегда свежие), с `devtools` для отладки.

```typescript
export const useMonitoringStore = create<MonitoringState>()(
  devtools(
    (set, get) => ({
      servers: [],
      loading: false,
      error: null,
      lastUpdated: null,
      _intervalId: null as ReturnType<typeof setInterval> | null,

      fetchServers: async () => {
        set({ loading: get().servers.length === 0, error: null });
        try {
          const res = await fetch('/api/monitoring/servers');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          set({
            servers: data.servers,
            loading: false,
            lastUpdated: data.timestamp,
            error: null,
          });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      },

      startPolling: (intervalMs = 30_000) => {
        const { stopPolling, fetchServers } = get();
        stopPolling();
        void fetchServers(); // Первый fetch сразу
        const id = setInterval(() => void fetchServers(), intervalMs);
        set({ _intervalId: id } as Partial<MonitoringState>);
      },

      stopPolling: () => {
        const state = get() as MonitoringState & { _intervalId: ReturnType<typeof setInterval> | null };
        if (state._intervalId) {
          clearInterval(state._intervalId);
          set({ _intervalId: null } as Partial<MonitoringState>);
        }
      },
    }),
    { name: 'monitoring-store' }
  )
);
```

### 4.3 Использование в компоненте

```typescript
// В DashboardView или MonitoringSection:
const { servers, loading, error, lastUpdated, startPolling, stopPolling, fetchServers } = useMonitoringStore();

useEffect(() => {
  startPolling(30_000);
  return () => stopPolling();
}, [startPolling, stopPolling]);
```

**Важно:** `loading: true` только при первом fetch (когда `servers.length === 0`). При последующих polling'ах loading не ставится — данные обновляются "тихо", без мерцания skeleton'ов.

---

## 5. Дизайн компонентов

### 5.1 DashboardView.tsx — расширяемый layout

Полная замена текущего содержимого. Структура:

```tsx
import React from 'react';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { MonitoringSection } from '@/components/dashboard/MonitoringSection';
import { useMonitoringStore } from '@/stores/useMonitoringStore';

export const DashboardView: React.FC = () => {
  const startPolling = useMonitoringStore((s) => s.startPolling);
  const stopPolling = useMonitoringStore((s) => s.stopPolling);

  React.useEffect(() => {
    startPolling(30_000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  return (
    <div className="h-full overflow-hidden bg-background">
      <ScrollableOverlay outerClassName="h-full" className="w-full">
        <div className="mx-auto max-w-6xl space-y-6 p-4">
          {/* Секция 1: Мониторинг серверов */}
          <MonitoringSection />

          {/* Будущие секции добавляются здесь: */}
          {/* <QuickActionsSection /> */}
          {/* <RecentSessionsSection /> */}
          {/* <UsageStatsSection /> */}
        </div>
      </ScrollableOverlay>
    </div>
  );
};
```

**Принцип расширяемости:** каждая секция — отдельный самодостаточный компонент. Добавление нового функционала на Dashboard = создать новый компонент + добавить одну строку JSX в DashboardView.

### 5.2 MonitoringSection

Компонент-обёртка для всей секции мониторинга.

**Визуальная структура:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Monitoring                                         [↻ Refresh] │
│ Server cluster status · updates every 30s                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│ │ ● Servers    │  │ CPU avg      │  │ RAM avg      │  Summary  │
│ │   4/5 online │  │ 23.4%        │  │ 45.2%        │  bar      │
│ └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                 │
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│ │  AI Brain     │  │  Proxy        │  │  Qdrant       │        │
│ │  ...metrics   │  │  ...metrics   │  │  ...metrics   │ Server  │
│ └───────────────┘  └───────────────┘  └───────────────┘ cards   │
│ ┌───────────────┐  ┌───────────────┐                            │
│ │  Zabbix       │  │  Home Asst.   │                            │
│ │  ...metrics   │  │  ...metrics   │                            │
│ └───────────────┘  └───────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Реализация:**

```tsx
import React from 'react';
import { RiRefreshLine } from '@remixicon/react';
import { useMonitoringStore } from '@/stores/useMonitoringStore';
import { ServerCard } from './ServerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { ButtonSmall } from '@/components/ui/button-small';

export const MonitoringSection: React.FC = () => {
  const { servers, loading, error, lastUpdated, fetchServers } = useMonitoringStore();
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
  const avgCpu = onlineServers.length > 0
    ? onlineServers.reduce((sum, s) => sum + s.cpu, 0) / onlineServers.length
    : 0;
  const avgRam = onlineServers.length > 0
    ? onlineServers.reduce((sum, s) => sum + s.ram_percent, 0) / onlineServers.length
    : 0;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h2 className="typography-ui-header font-semibold text-foreground">Monitoring</h2>
          <p className="typography-meta text-muted-foreground">
            Server cluster status · updates every 30s
          </p>
        </div>
        <ButtonSmall
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RiRefreshLine className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Refresh
        </ButtonSmall>
      </div>

      {/* Error alert */}
      {error && servers.length > 0 && (
        <div className="rounded-lg border px-3 py-2 typography-meta"
             style={{
               borderColor: 'var(--status-warning-border)',
               backgroundColor: 'var(--status-warning-background)',
               color: 'var(--status-warning)',
             }}>
          Failed to update · showing last known data
        </div>
      )}

      {/* Summary bar (visible only when data loaded) */}
      {servers.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <SummaryCard label="Servers" value={`${onlineCount}/${totalCount}`} sublabel="online" />
          <SummaryCard label="CPU avg" value={`${avgCpu.toFixed(1)}%`} color={gaugeColor(avgCpu)} />
          <SummaryCard label="RAM avg" value={`${avgRam.toFixed(1)}%`} color={gaugeColor(avgRam)} />
        </div>
      )}

      {/* Server cards grid */}
      {loading && servers.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ServerCardSkeleton key={i} />
          ))}
        </div>
      ) : error && servers.length === 0 ? (
        <ErrorState onRetry={handleRefresh} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      )}
    </section>
  );
};
```

**Summary bar карточка (SummaryCard)** — мини-компонент внутри MonitoringSection:

```tsx
const SummaryCard: React.FC<{
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
}> = ({ label, value, sublabel, color }) => (
  <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
       style={{ borderColor: 'var(--interactive-border)' }}>
    <span className="typography-meta text-muted-foreground">{label}:</span>
    <span className="typography-ui-label font-semibold" style={color ? { color } : undefined}>
      {value}
    </span>
    {sublabel && <span className="typography-micro text-muted-foreground">{sublabel}</span>}
  </div>
);
```

### 5.3 ServerCard — Online состояние

**Визуальная структура:**

```
┌──────────────────────────────────────────────┐
│ [🧠]  AI Brain                    ● Online  │  ← Header row
│        192.168.0.176                         │     icon + name + ip + badge
├──────────────────────────────────────────────┤
│  Router, OpenCode, Cabinet                   │  ← Role badge
├──────────────────────────────────────────────┤
│                                              │
│   ╭───╮      ╭───╮      ╭───╮              │
│   │CPU│      │RAM│      │DSK│              │  ← Ring gauges
│   ╰───╯      ╰───╯      ╰───╯              │
│   23.4%      67.2%      45.1%              │
│                                              │
├──────────────────────────────────────────────┤  ← Separator
│ RAM   ████████████░░░░░   10.4 / 16 GB      │  ← Detail bars
│ Disk  ██████░░░░░░░░░░░   89 / 200 GB       │
├──────────────────────────────────────────────┤  ← Separator
│ 🕐  Uptime: 15d 3h                          │  ← Footer
└──────────────────────────────────────────────┘
```

**Реализация:**

```tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { GaugeRing } from './GaugeRing';
import { MetricBar } from './MetricBar';
import { RiTimeLine } from '@remixicon/react';
import type { ServerMetrics } from '@/stores/useMonitoringStore';

// Маппинг icon id → Remixicon компонент
const SERVER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cpu: RiCpuLine,
  shield: RiShieldKeyholeLine,
  database: RiDatabase2Line,
  'bar-chart': RiBarChartLine,
  home: RiHome4Line,
};

interface ServerCardProps {
  server: ServerMetrics;
}

export const ServerCard: React.FC<ServerCardProps> = ({ server }) => {
  const IconComponent = SERVER_ICONS[server.icon] ?? RiServerLine;

  return (
    <Card className="py-0 gap-0 overflow-hidden">
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

          {/* Status badge */}
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
```

**StatusBadge** — мини-компонент внутри ServerCard:

```tsx
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
```

### 5.4 ServerCard — Offline состояние

При `server.online === false` карточка показывает:
- Header (иконка, имя, IP) — иконка с красным фоном `var(--status-error-background)`
- Role badge
- Центрированный текст "Server unavailable" вместо всех метрик
- Нет gauges, нет detail bars, нет uptime

### 5.5 ServerCard — Skeleton (loading)

Компонент `ServerCardSkeleton` показывается при первой загрузке (5 штук):

```tsx
const ServerCardSkeleton: React.FC = () => (
  <Card className="py-0 gap-0">
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
```

### 5.6 ErrorState

Показывается когда нет данных И есть ошибка (первая загрузка провалилась):

```tsx
const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card py-12 text-center"
       style={{ borderColor: 'var(--interactive-border)' }}>
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
```

---

## 6. GaugeRing — SVG кольцевой индикатор

Портируется из `monitoring.py._ring_svg()`.

### 6.1 Props

```typescript
interface GaugeRingProps {
  label: string;      // "CPU" | "RAM" | "DISK"
  value: number;       // 0-100
  size?: number;       // default 68
  strokeWidth?: number;// default 5
}
```

### 6.2 Реализация

```tsx
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
```

### 6.3 Анимация

Кольцо анимируется через CSS transition на `stroke-dashoffset`:
- Duration: `1s`
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- При обновлении значения (polling каждые 30с) — кольцо плавно "перетекает" к новому значению

---

## 7. MetricBar — прогресс-бар деталей

### 7.1 Props

```typescript
interface MetricBarProps {
  label: string;      // "RAM" | "Disk"
  percent: number;     // 0-100
  detail: string;      // "10.4 / 16 GB"
}
```

### 7.2 Реализация

```tsx
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
```

---

## 8. Цветовые пороги метрик

### 8.1 Функция gaugeColor

Общая функция для определения цвета по проценту. Используется в GaugeRing, MetricBar, Summary bar.

```typescript
function gaugeColor(percent: number): string {
  if (percent < 60) return 'var(--status-success)';
  if (percent < 85) return 'var(--status-warning)';
  return 'var(--status-error)';
}
```

### 8.2 Пороговые значения

| Диапазон | Цвет | Семантика | CSS переменная |
|---|---|---|---|
| 0% – 59% | Зелёный | Нормальная нагрузка | `var(--status-success)` |
| 60% – 84% | Жёлтый | Предупреждение | `var(--status-warning)` |
| 85% – 100% | Красный | Критическая нагрузка | `var(--status-error)` |

### 8.3 Примеры цветов по темам

Эти цвета определяются автоматически выбранной темой:

| Тема | success | warning | error |
|---|---|---|---|
| Tokyonight Dark | `#9ECE6A` | `#E0AF68` | `#F7768E` |
| Catppuccin Dark | зависит от темы | зависит от темы | зависит от темы |
| Mono Light | зависит от темы | зависит от темы | зависит от темы |

Разработчику не нужно знать конкретные цвета — достаточно использовать CSS переменные.

---

## 9. Тема — использование существующих theme токенов

### 9.1 Принцип

**НИКАКИХ хардкодированных цветов.** Все цвета исключительно через CSS переменные или Tailwind классы, которые маппятся на CSS переменные.

Тема переключается автоматически. При изменении ThemeMode (light/dark/system) в Settings → Visual → Theme Mode:
1. `useThemeSystem()` обновляет preferences
2. `CSSVariableGenerator.apply()` вычисляет все CSS vars из выбранной темы
3. Создаётся `<style id="opencode-theme-variables">` с новыми значениями на `:root`
4. Класс `.dark` / `.light` переключается на `<html>`
5. Все компоненты Dashboard автоматически перерисовываются с новыми цветами

**Никакой дополнительной логики в Dashboard для поддержки тем не нужно.**

### 9.2 Полная карта токенов для Dashboard

| Элемент UI | Tailwind класс или CSS var |
|---|---|
| Фон страницы Dashboard | `bg-background` |
| Карточка сервера | `<Card>` → `bg-card text-card-foreground border rounded-xl` |
| Заголовок секции "Monitoring" | `text-foreground` + `typography-ui-header` + `font-semibold` |
| Подзаголовок "Server cluster status..." | `text-muted-foreground` + `typography-meta` |
| Имя сервера | `text-foreground` + `typography-ui-label` + `font-bold` |
| IP адрес | `text-muted-foreground` + `typography-micro` + `font-mono` |
| Role badge фон | `var(--surface-subtle)` |
| Role badge текст | `text-muted-foreground` + `typography-micro` |
| Online badge фон | `var(--status-success-background)` |
| Online badge текст | `var(--status-success)` |
| Online badge border | `var(--status-success-border)` |
| Offline badge фон | `var(--status-error-background)` |
| Offline badge текст | `var(--status-error)` |
| Offline badge border | `var(--status-error-border)` |
| Icon background (online) | `var(--status-success-background)` |
| Icon color (online) | `var(--status-success)` |
| Icon background (offline) | `var(--status-error-background)` |
| Icon color (offline) | `var(--status-error)` |
| Gauge track (фон кольца) | `var(--surface-subtle)` с `opacity: 0.5` |
| Gauge value color | `gaugeColor(percent)` → `var(--status-success/warning/error)` |
| Gauge center text | `font-mono` + `font-semibold` + цвет = `gaugeColor(percent)` |
| Gauge label | `text-muted-foreground` + `typography-micro` |
| MetricBar label | `text-muted-foreground` + `typography-micro` + `font-semibold` |
| MetricBar value (GB) | `text-foreground` + `typography-micro` + `font-mono` |
| MetricBar track | `var(--surface-subtle)` |
| MetricBar fill | `gaugeColor(percent)` |
| Separator | `<Separator>` → `bg-border` |
| Uptime icon | `text-muted-foreground` |
| Uptime text | `text-muted-foreground` + `typography-micro` |
| Summary bar card | `bg-card border` + `var(--interactive-border)` |
| Summary label | `text-muted-foreground` + `typography-meta` |
| Summary value | `text-foreground` + `typography-ui-label` + `font-semibold` (с цветом gaugeColor для avg) |
| Refresh button | `ButtonSmall variant="outline"` |
| Skeleton | `<Skeleton>` → `bg-accent animate-pulse rounded-xl` |
| Error state border | `var(--interactive-border)` |
| Error state icon | `text-muted-foreground/40` |
| Warning alert (stale data) | `var(--status-warning-background/border/foreground)` |

---

## 10. Иконки

Проект использует **Remixicon** (`@remixicon/react`). Не использовать Material Icons.

### 10.1 Маппинг серверов на иконки

| Сервер | Icon ID в данных | Remixicon компонент | Импорт |
|---|---|---|---|
| AI Brain | `cpu` | `RiCpuLine` | `@remixicon/react` |
| Proxy | `shield` | `RiShieldKeyholeLine` | `@remixicon/react` |
| Qdrant | `database` | `RiDatabase2Line` | `@remixicon/react` |
| Zabbix | `bar-chart` | `RiBarChartLine` | `@remixicon/react` |
| Home Assistant | `home` | `RiHome4Line` | `@remixicon/react` |

### 10.2 Дополнительные иконки

| Назначение | Remixicon компонент |
|---|---|
| Fallback server icon | `RiServerLine` |
| Кнопка Refresh | `RiRefreshLine` |
| Uptime | `RiTimeLine` |
| Error state | `RiErrorWarningLine` |

---

## 11. Polling / Refresh

| Параметр | Значение | Обоснование |
|---|---|---|
| Интервал polling клиент | **30 секунд** | Баланс между свежестью данных и нагрузкой на SSH |
| TTL серверного кэша | **15 секунд** | Защита от одновременных запросов нескольких клиентов |
| Timeout SSH на сервер | **8 секунд** | Достаточно для SSH + парсинга, не блокирует надолго |
| Timeout ping | **2 секунды** | Быстрая проверка доступности |
| Первый fetch | Сразу при монтировании | Данные видны мгновенно после перехода на Dashboard |
| Ручной refresh | Кнопка в заголовке секции | Пользователь может обновить не дожидаясь интервала |
| Cleanup | `stopPolling()` при unmount | Нет утечек интервалов при переключении вкладок |
| Loading flag | Только при первом fetch | При polling'е данные обновляются "тихо" без skeleton |
| Retry при ошибке | Сохранять старые данные + показать warning | Не терять данные при временном сбое сети |

### 11.1 Жизненный цикл polling

```
Mount DashboardView
  → startPolling(30000)
    → fetchServers() сразу          ← Первый запрос
    → setInterval(fetchServers, 30000) ← Периодические запросы
  
Каждые 30 секунд:
  → fetchServers()
    → fetch('/api/monitoring/servers')
      → Сервер: проверка кэша (15с TTL)
        → Если кэш свежий → отдать кэш
        → Если протух → собрать метрики (ping + SSH) → обновить кэш → отдать
    → Обновить store: servers, lastUpdated
    → UI перерисовывается с новыми данными (gauges анимируются)

Unmount DashboardView
  → stopPolling()
    → clearInterval(intervalId)
```

---

## 12. Состояния UI и Edge Cases

| Состояние | Условие | Что показывать |
|---|---|---|
| **Первая загрузка** | `loading && servers.length === 0` | 5 skeleton-карточек в grid |
| **Данные получены** | `servers.length > 0 && !error` | Summary bar + сетка карточек |
| **Данные есть + ошибка обновления** | `servers.length > 0 && error` | Warning alert сверху + последние данные |
| **Нет данных + ошибка** | `servers.length === 0 && error && !loading` | ErrorState с кнопкой retry |
| **Конкретный сервер offline** | `server.online === false` | Карточка с красным badge, текст "Server unavailable" |
| **Все серверы offline** | Все `server.online === false` | Все карточки в offline стиле, summary 0/5 online |
| **Polling обновляет данные** | `servers.length > 0 && !loading` | Карточки обновляются "тихо", gauges анимируются |
| **Ручной refresh** | Кнопка нажата | Иконка refresh крутится (`animate-spin`), кнопка `disabled` |

---

## 13. Responsive поведение

### 13.1 Grid карточек

```css
grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3
```

| Ширина экрана | Колонок | Примечание |
|---|---|---|
| < 768px (mobile) | 1 | Карточки в столбик |
| 768px – 1023px (tablet) | 2 | 2 колонки |
| ≥ 1024px (desktop) | 3 | 3 колонки (5 карточек = 3+2) |

### 13.2 Summary bar

`flex flex-wrap gap-3` — при узком экране summary cards переносятся на следующую строку.

### 13.3 Внутри карточки

Gauges (`flex justify-around`) — адаптивно распределяются. При очень узкой карточке можно уменьшить `size` до 56px, но это edge case.

---

## 14. Зависимости

### 14.1 Новые NPM пакеты

**НЕ НУЖНЫ.** Всё реализуется штатными средствами проекта:

| Что | Чем реализуется |
|---|---|
| SVG ring gauge | Чистый React + inline `<svg>` |
| HTTP запросы (клиент) | `fetch` API (уже используется повсеместно) |
| State management | Zustand `create()` + `devtools` (уже в проекте) |
| UI примитивы | Card, Skeleton, Separator, Tooltip, ScrollableOverlay, ButtonSmall (все есть) |
| Иконки | `@remixicon/react` (уже в проекте) |
| SSH/ping (сервер) | `child_process.exec` из Node.js stdlib |

### 14.2 Существующие зависимости, которые используются

```json
{
  "zustand": "используется для stores",
  "@remixicon/react": "иконки",
  "@radix-ui/react-separator": "через компонент Separator",
  "@radix-ui/react-tooltip": "через компонент Tooltip",
  "express": "web server routes"
}
```

---

## 15. Файловая структура результата

```
packages/
├── web/
│   └── server/
│       ├── lib/
│       │   └── monitoring/
│       │       └── index.js              ← НОВЫЙ: серверный модуль сбора метрик
│       └── index.js                      ← ИЗМЕНЁН: +1 route GET /api/monitoring/servers
│
└── ui/
    └── src/
        ├── stores/
        │   └── useMonitoringStore.ts      ← НОВЫЙ: Zustand store
        │
        ├── components/
        │   ├── dashboard/
        │   │   ├── GaugeRing.tsx          ← НОВЫЙ: SVG ring gauge
        │   │   ├── MetricBar.tsx          ← НОВЫЙ: прогресс-бар метрики
        │   │   ├── ServerCard.tsx         ← НОВЫЙ: карточка сервера
        │   │   └── MonitoringSection.tsx  ← НОВЫЙ: секция мониторинга
        │   │
        │   └── views/
        │       └── DashboardView.tsx      ← ИЗМЕНЁН: заглушка → расширяемый layout
        │
        └── (остальное без изменений)
```

---

## 16. Ограничения и правила проекта

Из `AGENTS.md` и анализа кодовой базы:

1. **TypeScript:** Избегать `any` и слепых type casts. Держать ESLint/TS зелёными.
2. **React:** Только function components + hooks. Классы только для error boundaries.
3. **Styling:** Tailwind v4. Типография через `packages/ui/src/lib/typography.ts`. Тема через CSS vars из `packages/ui/src/lib/theme/`.
4. **Control flow:** Не использовать вложенные тернарники. Предпочитать early returns + `if/else` / `switch`.
5. **Toasts:** Использовать custom toast wrapper из `@/components/ui` (не импортировать `sonner` напрямую).
6. **Новые зависимости:** Не добавлять без явной просьбы.
7. **Build validation:** Перед финализацией запустить `bun run type-check`, `bun run lint`, `bun run build`.
8. **Diffы:** Держать минимальными, не делать побочных рефакторингов.

---

## 17. Checklist для разработчика

### Бэкенд

- [ ] Создать `packages/web/server/lib/monitoring/index.js`
  - [ ] Определить `SERVERS_CONFIG` массив
  - [ ] Реализовать `pingServer(ip)` — child_process ping
  - [ ] Реализовать `getServerMetrics(server)` — SSH/local exec + парсинг
  - [ ] Реализовать `getServersMetrics()` — Promise.allSettled + кэш 15с
  - [ ] Export: `getServersMetrics`
- [ ] Добавить route в `packages/web/server/index.js`
  - [ ] `GET /api/monitoring/servers` → `{ servers, timestamp }`
  - [ ] Обработка ошибок → 500 + JSON

### Фронтенд

- [ ] Создать `packages/ui/src/stores/useMonitoringStore.ts`
  - [ ] Типы `ServerMetrics`, `MonitoringState`
  - [ ] Actions: `fetchServers`, `startPolling`, `stopPolling`
  - [ ] `devtools` middleware, без `persist`
- [ ] Создать `packages/ui/src/components/dashboard/GaugeRing.tsx`
  - [ ] SVG ring с `stroke-dasharray` / `stroke-dashoffset`
  - [ ] Анимация transition 1s
  - [ ] Цвет по порогам через `gaugeColor()`
- [ ] Создать `packages/ui/src/components/dashboard/MetricBar.tsx`
  - [ ] Прогресс-бар с label и detail
  - [ ] Анимация width transition 0.7s
- [ ] Создать `packages/ui/src/components/dashboard/ServerCard.tsx`
  - [ ] Online состояние: header + role + gauges + bars + uptime
  - [ ] Offline состояние: header + role + "Server unavailable"
  - [ ] Маппинг иконок Remixicon
  - [ ] StatusBadge подкомпонент
- [ ] Создать `packages/ui/src/components/dashboard/MonitoringSection.tsx`
  - [ ] Header с кнопкой Refresh
  - [ ] Summary bar (servers count, avg CPU, avg RAM)
  - [ ] Grid карточек
  - [ ] Skeleton loading (5 карточек)
  - [ ] Error state (нет данных)
  - [ ] Warning alert (stale data)
- [ ] Переписать `packages/ui/src/components/views/DashboardView.tsx`
  - [ ] ScrollableOverlay wrapper
  - [ ] MonitoringSection
  - [ ] useEffect для startPolling/stopPolling

### Валидация

- [ ] `bun run type-check` — зелёный
- [ ] `bun run lint` — зелёный
- [ ] `bun run build` — зелёный

### Визуальная проверка

- [ ] Открыть Dashboard в браузере
- [ ] Проверить dark theme — все цвета корректны
- [ ] Проверить light theme — все цвета корректны
- [ ] Проверить system theme — переключается правильно
- [ ] Проверить skeleton при первой загрузке
- [ ] Проверить offline-карточки (отключить один сервер)
- [ ] Проверить responsive: 1 колонка (mobile), 2 колонки (tablet), 3 колонки (desktop)
- [ ] Проверить анимацию gauges при обновлении данных
- [ ] Проверить кнопку Refresh
- [ ] Проверить auto-refresh каждые 30 секунд
