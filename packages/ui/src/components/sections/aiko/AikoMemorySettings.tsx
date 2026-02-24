import React from 'react'

export const AikoMemorySettings: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="typography-ui-header font-semibold text-foreground">Память</h2>
        <p className="typography-meta text-muted-foreground mt-1">
          Управление долгосрочной памятью Айко
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-4 py-6 text-center justify-center">
        <span className="inline-flex items-center rounded-md bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-500 ring-1 ring-amber-400/30 ring-inset">
          В разработке
        </span>
        <span className="typography-meta text-muted-foreground">
          Настройка памяти появится в следующем обновлении
        </span>
      </div>
    </div>
  )
}
