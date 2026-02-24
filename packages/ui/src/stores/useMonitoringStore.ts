import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ServerMetrics {
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
  _intervalId: ReturnType<typeof setInterval> | null;

  fetchServers: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}

export const useMonitoringStore = create<MonitoringState>()(
  devtools(
    (set, get) => ({
      servers: [],
      loading: false,
      error: null,
      lastUpdated: null,
      _intervalId: null,

      fetchServers: async () => {
        // Only show loading spinner on first fetch (empty state)
        set({ loading: get().servers.length === 0, error: null });
        try {
          const res = await fetch('/api/monitoring/servers');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: { servers: ServerMetrics[]; timestamp: number } = await res.json();
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
        void fetchServers();
        const id = setInterval(() => void fetchServers(), intervalMs);
        set({ _intervalId: id });
      },

      stopPolling: () => {
        const { _intervalId } = get();
        if (_intervalId) {
          clearInterval(_intervalId);
          set({ _intervalId: null });
        }
      },
    }),
    { name: 'monitoring-store' }
  )
);
