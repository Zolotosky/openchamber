import React from 'react'
import { cn } from '../../../lib/utils'

export type AikoSection = 'modules' | 'visual' | 'chat' | 'interface'

interface SidebarItem {
  label: string
  section: AikoSection
}

interface SidebarGroup {
  label: string
  items: SidebarItem[]
}

const GROUPS: SidebarGroup[] = [
  { label: 'Модули', items: [{ label: 'Память', section: 'modules' }] },
  { label: 'Чат', items: [{ label: 'Сообщения', section: 'chat' }] },
  {
    label: 'Вид',
    items: [
      { label: 'Тема · Цвета', section: 'visual' },
      { label: 'Интерфейс · Язык', section: 'interface' },
    ],
  },
]

interface AikoSidebarProps {
  activeSection: AikoSection
  onSelect: (section: AikoSection) => void
}

export const AikoSidebar: React.FC<AikoSidebarProps> = ({ activeSection, onSelect }) => {
  return (
    <div className="flex flex-col gap-4 py-4 px-3 w-full">
      {GROUPS.map(group => (
        <div key={group.label}>
          {group.items.length === 1 ? (
            <button
              onClick={() => onSelect(group.items[0].section)}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded-md transition-colors',
                activeSection === group.items[0].section
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              )}
            >
              <div className="text-sm font-medium">{group.label}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {group.items[0].label}
              </div>
            </button>
          ) : (
            <>
              <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 mb-1.5">
                {group.label}
              </div>
              {group.items.map(item => (
                <button
                  key={item.section}
                  onClick={() => onSelect(item.section)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded-md transition-colors text-sm',
                    activeSection === item.section
                      ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium'
                      : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
