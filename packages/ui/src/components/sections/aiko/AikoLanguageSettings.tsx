import React from 'react'
import { useAikoStore } from '../../../stores/useAikoStore'
import { cn } from '../../../lib/utils'
import { ButtonSmall } from '@/components/ui/button-small'

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺', label: 'Русский' },
  { code: 'en' as const, flag: '🇬🇧', label: 'English' },
]

export const AikoLanguageSettings: React.FC = () => {
  const { interfaceLanguage, setInterfaceLanguage } = useAikoStore()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="typography-ui-header font-semibold text-foreground">Язык интерфейса</h3>
        <p className="typography-meta text-muted-foreground">
          Выберите язык интерфейса Айко
        </p>
      </div>

      <div className="flex gap-1 w-fit">
        {LANGUAGES.map((lang) => (
          <ButtonSmall
            key={lang.code}
            variant={interfaceLanguage === lang.code ? 'default' : 'outline'}
            className={cn(interfaceLanguage === lang.code ? undefined : 'text-foreground')}
            onClick={() => setInterfaceLanguage(lang.code)}
          >
            {lang.flag} {lang.label}
          </ButtonSmall>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-500 ring-1 ring-amber-400/30 ring-inset">
          В разработке
        </span>
        <span className="typography-meta text-muted-foreground">
          Полная локализация интерфейса в разработке
        </span>
      </div>
    </div>
  )
}
