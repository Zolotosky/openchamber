# OpenChamber Settings Page Style Guide

> **Для агентов**: Этот документ описывает стандарт оформления страниц настроек в OpenChamber.
> Прочитай его перед созданием или изменением любого `*Settings.tsx` компонента в `packages/ui/src/components/sections/`.

---

## Эталонные файлы

| Файл | Что там смотреть |
|------|-----------------|
| `packages/ui/src/components/sections/openchamber/DefaultsSettings.tsx` | Заголовок, описание, лейблы, Select |
| `packages/ui/src/components/sections/openchamber/OpenChamberVisualSettings.tsx` | Segment control кнопки (`ButtonSmall`), разделитель секций |
| `packages/ui/src/components/sections/aiko/AikoLanguageSettings.tsx` | Минимальный пример: заголовок + segment control + бейдж |

---

## Структура страницы настроек

```tsx
<div className="space-y-4">

  {/* 1. Заголовок секции */}
  <div className="space-y-1">
    <h3 className="typography-ui-header font-semibold text-foreground">Название секции</h3>
    <p className="typography-meta text-muted-foreground">
      Краткое описание что настраивается
    </p>
  </div>

  {/* 2. Контрол (segment buttons / select / checkbox / input) */}
  {/* ... */}

  {/* 3. Дополнительная информация / подсказка (опционально) */}
  <p className="typography-meta text-muted-foreground">...</p>

</div>
```

---

## Паттерн: Segment Control (кнопки выбора)

Используй когда нужно выбрать одно из 2-5 значений.

```tsx
import { ButtonSmall } from '@/components/ui/button-small'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'option_a', label: 'Вариант A' },
  { value: 'option_b', label: 'Вариант B' },
]

// В JSX:
<div className="flex gap-1 w-fit">
  {OPTIONS.map((option) => (
    <ButtonSmall
      key={option.value}
      variant={currentValue === option.value ? 'default' : 'outline'}
      className={cn(currentValue === option.value ? undefined : 'text-foreground')}
      onClick={() => setCurrentValue(option.value)}
    >
      {option.label}
    </ButtonSmall>
  ))}
</div>
```

**Важно**: `w-fit` — кнопки НЕ растягиваются на всю ширину!

---

## Паттерн: Разделитель секций

```tsx
<div className="border-t border-border/40 pt-4 mt-4 space-y-3">
  {/* следующая секция */}
</div>
```

---

## Паттерн: Бейдж "В разработке"

```tsx
<div className="flex items-center gap-2">
  <span className="inline-flex items-center rounded-md bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-500 ring-1 ring-amber-400/30 ring-inset">
    В разработке
  </span>
  <span className="typography-meta text-muted-foreground">
    Пояснение почему в разработке
  </span>
</div>
```

---

## Паттерн: Лейбл + Select

```tsx
<div className="flex flex-col gap-1.5">
  <label className="typography-ui-label text-muted-foreground">Подпись</label>
  <Select value={value} onValueChange={setValue}>
    <SelectTrigger className="w-auto max-w-xs typography-meta text-foreground">
      <SelectValue placeholder="Выбери..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="a" className="pr-2 [&>span:first-child]:hidden">A</SelectItem>
    </SelectContent>
  </Select>
</div>
```

---

## Паттерн: Checkbox с описанием

```tsx
<div className="pt-2">
  <label className="flex items-center gap-2 cursor-pointer">
    <Checkbox
      checked={value}
      onChange={(checked) => setValue(checked)}
    />
    <span className="typography-ui-label text-foreground">
      Название опции
    </span>
  </label>
  <p className="typography-meta text-muted-foreground pl-5 mt-1">
    Пояснение к опции
  </p>
</div>
```

---

## Типографика (классы)

| Класс | Использование |
|-------|--------------|
| `typography-ui-header` | Заголовок секции (`h3`) |
| `typography-ui-label` | Лейблы, текст кнопок, названия опций |
| `typography-meta` | Описания, подсказки, мелкий текст |
| `typography-micro` | Очень мелкий текст (редко) |

Всегда добавляй цветовой класс:
- `text-foreground` — основной текст
- `text-muted-foreground` — вторичный/описательный текст

---

## Цвета — только CSS-переменные темы

**Никогда не хардкодить цвета!** Используй переменные:

```tsx
// ✅ Правильно
className="text-foreground bg-muted border-border/40"

// ❌ Неправильно  
className="text-gray-900 bg-gray-100 border-gray-200"
```

Все доступные переменные: `packages/ui/src/lib/theme/`

---

## Анти-паттерны

```tsx
// ❌ Кнопки на всю ширину
<div className="flex flex-col gap-2">
  <button className="w-full ...">...</button>
</div>

// ✅ Компактные кнопки
<div className="flex gap-1 w-fit">
  <ButtonSmall ...>...</ButtonSmall>
</div>

// ❌ Нестандартный заголовок
<h2 className="text-lg font-bold">...</h2>

// ✅ Стандартный заголовок
<h3 className="typography-ui-header font-semibold text-foreground">...</h3>

// ❌ Внешний отступ flex-col gap-6
<div className="flex flex-col gap-6">

// ✅ Стандартный space-y-4
<div className="space-y-4">
```

---

## Страница Айко — специфика

Файлы в: `packages/ui/src/components/sections/aiko/`

- `AikoSidebar.tsx` — навигация (accordion с секциями)
- `AikoPage.tsx` — роутинг по `AikoSection`
- `AikoLanguageSettings.tsx` — 🟢 эталон для Айко-страниц
- `AikoMemorySettings.tsx` — заглушка
- `useAikoStore.ts` — Zustand стор (`packages/ui/src/stores/`)

Добавляя новую страницу настроек Айко:
1. Создай `Aiko[Name]Settings.tsx` по шаблону выше
2. Добавь секцию в `AikoSidebar.tsx` (тип `AikoSection`)
3. Добавь `case` в `AikoPage.tsx`
