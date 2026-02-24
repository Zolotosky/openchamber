import React from 'react'
import type { AikoSection } from './AikoSidebar'
import { AikoLanguageSettings } from './AikoLanguageSettings'
import { AikoMemorySettings } from './AikoMemorySettings'
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay'

interface AikoPageProps {
  section: AikoSection
}

const AikoPlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex h-full items-center justify-center p-8">
    <div className="text-center space-y-2">
      <p className="typography-ui-label font-medium text-foreground">{title}</p>
      <p className="typography-meta text-muted-foreground">В разработке</p>
    </div>
  </div>
)

const renderSection = (section: AikoSection) => {
  switch (section) {
    case 'aiko-language':
      return <AikoLanguageSettings />
    case 'aiko-template':
      return <AikoPlaceholder title="Шаблон" />
    case 'aiko-memory':
      return <AikoMemorySettings />
    default:
      return <AikoLanguageSettings />
  }
}

export const AikoPage: React.FC<AikoPageProps> = ({ section }) => {
  return (
    <ScrollableOverlay
      keyboardAvoid
      outerClassName="h-full"
      className="w-full"
    >
      <div className="mx-auto max-w-3xl space-y-6 p-3 sm:p-6">
        {renderSection(section)}
      </div>
    </ScrollableOverlay>
  )
}
