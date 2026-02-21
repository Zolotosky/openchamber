import React from 'react'
import { RiBrainLine } from '@remixicon/react'
import { useAikoStore } from '../../../stores/useAikoStore'

export const AikoModulesSettings: React.FC = () => {
  const { memoryEnabled, memoryApiUrl, setMemoryEnabled, setMemoryApiUrl } = useAikoStore()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Модули</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Включение и отключение модулей Айко</p>
      </div>

      {/* Memory module */}
      <div className="flex items-start justify-between gap-4 bg-[var(--bg-secondary)] rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <RiBrainLine className="w-5 h-5 text-pink-500 shrink-0" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Память</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Qdrant + aiko-db долговременная память. Показывает 🧠 в шапке.
            </div>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={memoryEnabled}
          onClick={() => setMemoryEnabled(!memoryEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            memoryEnabled ? 'bg-orange-400' : 'bg-[var(--bg-tertiary)]'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
              memoryEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Memory API URL */}
      {memoryEnabled && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[var(--text-primary)]">URL API памяти</label>
          <input
            type="text"
            value={memoryApiUrl}
            onChange={e => setMemoryApiUrl(e.target.value)}
            className="w-full bg-[var(--bg-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-primary)] focus:border-pink-500/50 transition-colors"
            placeholder="http://192.168.0.176:4200"
          />
          <p className="text-xs text-[var(--text-tertiary)]">REST API aiko-db для хранения фактов</p>
        </div>
      )}
    </div>
  )
}
