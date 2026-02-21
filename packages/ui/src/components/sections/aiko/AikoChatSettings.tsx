import React from 'react'
import { useAikoStore } from '../../../stores/useAikoStore'

export const AikoChatSettings: React.FC = () => {
  const { showSystemMessages, setShowSystemMessages } = useAikoStore()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Сообщения в чате</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Настройки отображения сообщений</p>
      </div>

      <div className="flex items-start justify-between gap-4 bg-[var(--bg-secondary)] rounded-xl px-4 py-3">
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">Показывать системные сообщения</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Системные сообщения используются моделью для поиска и анализа. По умолчанию скрыты.
          </div>
        </div>
        <button
          role="switch"
          aria-checked={showSystemMessages}
          onClick={() => setShowSystemMessages(!showSystemMessages)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            showSystemMessages ? 'bg-orange-400' : 'bg-[var(--bg-tertiary)]'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
              showSystemMessages ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
