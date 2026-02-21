import React from 'react'
import { cn } from '../../../lib/utils'

export type AikoSection = 'modules' | 'visual' | 'chat'

interface SidebarGroup {
  id: AikoSection
  label: string
  items: string[]
}

const GROUPS: SidebarGroup[] = [
  { id: 'modules', label: 'Модули', items: ['Память'] },
  { id: 'chat', label: 'Чат', items: ['Сообщения'] },
  { id: 'visual', label: 'Вид', items: ['Тема · Цвета'] },
]

interface AikoSidebarProps {
  activeSection: AikoSection
  onSelect: (section: AikoSection) => void
}

export const AikoSidebar: React.FC<AikoSidebarProps> = ({ activeSection, onSelect }) => {
  return (
    <div className="flex flex-col gap-4 py-4 px-3 w-full">
      {GROUPS.map(group => (
        <div key={group.id}>
          <button
            onClick={() => onSelect(group.id)}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded-md transition-colors',
              activeSection === group.id
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
            )}
          >
            <div className="text-sm font-medium">{group.label}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {group.items.join(' · ')}
            </div>
          </button>
        </div>
      ))}
    </div>
  )
}
