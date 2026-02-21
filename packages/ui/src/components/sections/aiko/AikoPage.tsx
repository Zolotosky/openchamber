import React from 'react'
import type { AikoSection } from './AikoSidebar'
import { AikoModulesSettings } from './AikoModulesSettings'
import { AikoVisualSettings } from './AikoVisualSettings'
import { AikoChatSettings } from './AikoChatSettings'

interface AikoPageProps {
  section: AikoSection
}

export const AikoPage: React.FC<AikoPageProps> = ({ section }) => {
  switch (section) {
    case 'visual':
      return <AikoVisualSettings />
    case 'chat':
      return <AikoChatSettings />
    case 'modules':
    default:
      return <AikoModulesSettings />
  }
}
