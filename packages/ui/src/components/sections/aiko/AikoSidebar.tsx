import React from 'react';
import { RiArrowDownSLine } from '@remixicon/react';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { isVSCodeRuntime, isWebRuntime } from '@/lib/desktop';
import { cn } from '@/lib/utils';

export type AikoSection = 'aiko-language' | 'aiko-template' | 'aiko-memory';

interface SectionLeaf {
  id: AikoSection;
  label: string;
  webOnly?: boolean;
  hideInVSCode?: boolean;
}

interface SectionParent {
  id: string;
  label: string;
  children: SectionLeaf[];
  hideInVSCode?: boolean;
}

const AIKO_NAV: SectionParent[] = [
  {
    id: 'aiko-interface',
    label: 'Интерфейс',
    children: [
      { id: 'aiko-language', label: 'Языки' },
      { id: 'aiko-template', label: 'Шаблон' },
    ],
  },
  {
    id: 'aiko-modules',
    label: 'Модули',
    children: [
      { id: 'aiko-memory', label: 'Память' },
    ],
  },
];

interface AikoSidebarProps {
  selectedSection: AikoSection;
  onSelectSection: (section: AikoSection) => void;
  onItemSelect?: () => void;
}

export const AikoSidebar: React.FC<AikoSidebarProps> = ({
  selectedSection,
  onSelectSection,
  onItemSelect,
}) => {
  const isVSCode = React.useMemo(() => isVSCodeRuntime(), []);
  const isWeb = React.useMemo(() => isWebRuntime(), []);

  const activeParentId = React.useMemo(() => {
    for (const parent of AIKO_NAV) {
      if (parent.children.some((c) => c.id === selectedSection)) return parent.id;
    }
    return null;
  }, [selectedSection]);

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => {
    const init = new Set<string>();
    if (activeParentId) init.add(activeParentId);
    else init.add('aiko-interface');
    return init;
  });

  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleParents = React.useMemo(() =>
    AIKO_NAV
      .filter((p) => !(p.hideInVSCode && isVSCode))
      .map((p) => ({
        ...p,
        children: p.children.filter((c) => {
          if (c.hideInVSCode && isVSCode) return false;
          if (c.webOnly && !isWeb) return false;
          return true;
        }),
      }))
      .filter((p) => p.children.length > 0),
  [isVSCode, isWeb]);

  const bgClass = isVSCode ? 'bg-background' : 'bg-sidebar';

  return (
    <div className={cn('grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]', bgClass)}>
      <div className="min-h-0">
        <ScrollableOverlay outerClassName="h-full" className="px-3 py-2 overflow-x-hidden">
          <div className="space-y-1">
            {visibleParents.map((parent) => {
              const isOpen = expandedIds.has(parent.id);
              const hasSelected = parent.children.some((c) => c.id === selectedSection);

              return (
                <div key={parent.id}>
                  <button
                    onClick={() => toggleExpanded(parent.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                      hasSelected && !isOpen ? 'bg-interactive-selection' : 'hover:bg-interactive-hover'
                    )}
                  >
                    <span className={cn(
                      'typography-ui-label font-normal text-foreground',
                      hasSelected && !isOpen && 'font-semibold'
                    )}>
                      {parent.label}
                    </span>
                    <RiArrowDownSLine className={cn(
                      'h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )} />
                  </button>

                  {isOpen && (
                    <div className="mt-0.5 ml-3 space-y-0.5 border-l border-border/30 pl-2">
                      {parent.children.map((child) => {
                        const isSelected = selectedSection === child.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => {
                              onSelectSection(child.id);
                              onItemSelect?.();
                            }}
                            className={cn(
                              'w-full text-left rounded-md px-2 py-1 transition-all duration-150',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                              isSelected
                                ? 'bg-interactive-selection text-foreground font-medium'
                                : 'text-muted-foreground hover:bg-interactive-hover hover:text-foreground'
                            )}
                          >
                            <span className="typography-ui-label">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollableOverlay>
      </div>
    </div>
  );
};
