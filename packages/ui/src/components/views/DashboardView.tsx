import React from 'react';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { MonitoringSection } from '@/components/dashboard/MonitoringSection';
import { UsageSection } from '@/components/dashboard/UsageSection';
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
        <div className="mx-auto max-w-[1600px] space-y-6 p-4">
          <MonitoringSection />
          <UsageSection />
        </div>
      </ScrollableOverlay>
    </div>
  );
};
