import React from 'react'
import { useAikoStore } from '../../../stores/useAikoStore'

export const AikoVisualSettings: React.FC = () => {
  const { overrideVisual, setOverrideVisual } = useAikoStore()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Вид</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Тема и визуальная настройка Айко</p>
      </div>

      <div className="flex items-start justify-between gap-4 bg-[var(--bg-secondary)] rounded-xl px-4 py-3">
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">Заменить тему OpenChamber</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Применить тёмную тему Айко с акцентным цветом
          </div>
        </div>
        <button
          role="switch"
          aria-checked={overrideVisual}
          onClick={() => setOverrideVisual(!overrideVisual)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            overrideVisual ? 'bg-orange-400' : 'bg-[var(--bg-tertiary)]'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
              overrideVisual ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="rounded-lg bg-[var(--bg-secondary)] px-4 py-3 text-xs text-[var(--text-tertiary)]">
        Скоро: акцентный цвет, шрифт, стиль сообщений в чате...
      </div>
    </div>
  )
}
