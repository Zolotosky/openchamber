import React from 'react'
import { useAikoStore } from '../../../stores/useAikoStore'
import { cn } from '../../../lib/utils'

export const AikoInterfaceSettings: React.FC = () => {
  const { interfaceLanguage, setInterfaceLanguage } = useAikoStore()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Интерфейс</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Язык и локализация интерфейса</p>
      </div>

      <div className="flex flex-col gap-3 bg-[var(--bg-secondary)] rounded-xl px-4 py-3">
        <div className="text-sm font-medium text-[var(--text-primary)]">Язык интерфейса</div>
        <div className="flex gap-2">
          <button
            onClick={() => setInterfaceLanguage('ru')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border',
              interfaceLanguage === 'ru'
                ? 'bg-orange-400/15 border-orange-400/50 text-[var(--text-primary)]'
                : 'bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            )}
          >
            <span>🇷🇺</span>
            <span>Русский</span>
          </button>
          <button
            onClick={() => setInterfaceLanguage('en')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border',
              interfaceLanguage === 'en'
                ? 'bg-orange-400/15 border-orange-400/50 text-[var(--text-primary)]'
                : 'bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            )}
          >
            <span>🇬🇧</span>
            <span>English</span>
          </button>
        </div>
        <div className="text-xs text-[var(--text-tertiary)] mt-1">
          Полная русификация интерфейса в разработке
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-500 ring-1 ring-amber-400/30 ring-inset">
          В разработке
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">
          Переключение языка пока влияет только на настройки Айко
        </span>
      </div>
    </div>
  )
}
