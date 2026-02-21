import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AikoState {
  memoryEnabled: boolean
  memoryApiUrl: string
  overrideVisual: boolean
  showSystemMessages: boolean
  setMemoryEnabled: (v: boolean) => void
  setMemoryApiUrl: (url: string) => void
  setOverrideVisual: (v: boolean) => void
  setShowSystemMessages: (v: boolean) => void
}

export const useAikoStore = create<AikoState>()(
  persist(
    (set) => ({
      memoryEnabled: true,
      memoryApiUrl: 'http://192.168.0.176:4200',
      overrideVisual: false,
      showSystemMessages: false,
      setMemoryEnabled: (v) => set({ memoryEnabled: v }),
      setMemoryApiUrl: (url) => set({ memoryApiUrl: url }),
      setOverrideVisual: (v) => set({ overrideVisual: v }),
      setShowSystemMessages: (v) => set({ showSystemMessages: v }),
    }),
    {
      name: 'aiko-settings',
      version: 1,
    }
  )
)
