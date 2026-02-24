import React, { useEffect, useState, useCallback } from 'react'
import { RiBrainLine, RiCloseLine, RiAddLine, RiDeleteBinLine, RiSearchLine, RiRefreshLine } from '@remixicon/react'
import { useAikoStore } from '../../stores/useAikoStore'
import { cn } from '../../lib/utils'

interface MemoryFact {
  id: string
  text: string
  score?: number
  created_at?: string
  tags?: string[]
}

interface MemoryViewProps {
  onClose: () => void
}

const VERSION = 'aiko-memory v1.0'

export const MemoryView: React.FC<MemoryViewProps> = ({ onClose }) => {
  const { memoryApiUrl } = useAikoStore()
  const [facts, setFacts] = useState<MemoryFact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [newFact, setNewFact] = useState('')
  const [addingFact, setAddingFact] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchFacts = useCallback(async (query?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = query
        ? `${memoryApiUrl}/search?q=${encodeURIComponent(query)}&limit=50`
        : `${memoryApiUrl}/facts?limit=50`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Ошибка ${res.status}`)
      const data = await res.json()
      setFacts(Array.isArray(data) ? data : data.results || data.facts || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось подключиться к aiko-db')
      setFacts([])
    } finally {
      setLoading(false)
    }
  }, [memoryApiUrl])

  useEffect(() => {
    fetchFacts()
  }, [fetchFacts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchFacts(searchQuery || undefined)
  }

  const handleAddFact = async () => {
    if (!newFact.trim()) return
    setAddingFact(true)
    try {
      const res = await fetch(`${memoryApiUrl}/facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newFact.trim() }),
      })
      if (!res.ok) throw new Error(`Ошибка ${res.status}`)
      setNewFact('')
      setShowAddForm(false)
      await fetchFacts(searchQuery || undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить факт')
    } finally {
      setAddingFact(false)
    }
  }

  const handleDeleteFact = async (id: string) => {
    try {
      await fetch(`${memoryApiUrl}/facts/${id}`, { method: 'DELETE' })
      setFacts(prev => prev.filter(f => f.id !== id))
    } catch (e) {
      setError('Не удалось удалить факт')
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] shrink-0">
        <div className="flex items-center gap-2">
          <RiBrainLine className="w-5 h-5 text-pink-500" />
          <span className="font-semibold text-sm">Память</span>
          <span className="text-xs text-[var(--text-tertiary)] ml-2">{VERSION}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchFacts(searchQuery || undefined)}
            className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            title="Обновить"
          >
            <RiRefreshLine className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            title="Закрыть"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)] shrink-0">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[var(--bg-secondary)] rounded-lg px-3 py-2">
            <RiSearchLine className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по памяти..."
              className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm transition-colors"
          >
            Найти
          </button>
        </form>
      </div>

      {/* Facts list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)]">
            <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full mr-2" />
            Загрузка...
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && facts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)] gap-2">
            <RiBrainLine className="w-10 h-10 opacity-30" />
            <p className="text-sm">Память пуста</p>
            <p className="text-xs opacity-60">Добавьте первый факт</p>
          </div>
        )}

        {facts.map(fact => (
          <div
            key={fact.id}
            className="group flex items-start gap-3 bg-[var(--bg-secondary)] rounded-lg px-3 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed break-words">
                {fact.text}
              </p>
              {fact.score !== undefined && (
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  релевантность: {(fact.score * 100).toFixed(0)}%
                </p>
              )}
            </div>
            <button
              onClick={() => handleDeleteFact(fact.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-[var(--text-tertiary)] transition-all shrink-0"
              title="Удалить"
            >
              <RiDeleteBinLine className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add fact form */}
      <div className="px-4 py-3 border-t border-[var(--border-primary)] shrink-0">
        {showAddForm ? (
          <div className="space-y-2">
            <textarea
              value={newFact}
              onChange={e => setNewFact(e.target.value)}
              placeholder="Введите факт для запоминания..."
              className="w-full bg-[var(--bg-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none border border-[var(--border-primary)] focus:border-pink-500/50 transition-colors"
              rows={3}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddFact()
                if (e.key === 'Escape') { setShowAddForm(false); setNewFact('') }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddFact}
                disabled={addingFact || !newFact.trim()}
                className="flex-1 py-1.5 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {addingFact ? 'Сохраняю...' : 'Сохранить (Ctrl+Enter)'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewFact('') }}
                className="px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-sm rounded-lg transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RiAddLine className="w-4 h-4" />
            Добавить факт
          </button>
        )}
      </div>
    </div>
  )
}
