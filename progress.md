# F-Guild — Progress Log

## Формат записей

```
### TASK-XXX: Описание задачи
**Статус:** done | in_progress | blocked
**Дата:** YYYY-MM-DD
**Агент/Автор:** имя
**Summary:** Краткое описание выполненной работы
**Коммиты:** hash1, hash2
**Заметки:** дополнительная информация
```

---

## Записи

### TASK-001: Инициализация плоского Next.js 15 проекта с TypeScript
**Статус:** done
**Дата:** 2026-04-02
**Summary:** Создан плоский Next.js 15.3.9 проект с App Router, TypeScript strict, ESLint 9 flat config, структура src/app,components,lib,server + prisma/. pnpm install/build/lint — всё проходит.
**Коммит:** 157d056
**Заметки:** pnpm установлен через brew. Tailwind/shadcn/Prisma/tRPC ещё не настроены — отдельные задачи.

### TASK-002: Настройка Tailwind CSS 4 и shadcn/ui с фиолетовой DnD-темой
**Статус:** done
**Дата:** 2026-04-02
**Summary:** Tailwind CSS 4.2.2 + PostCSS. shadcn/ui с фиолетовой темой (oklch). Dark mode по умолчанию (class=dark). Inter font через next/font/google. Button компонент в src/components/ui/. cn() утилита. tw-animate-css.
**Коммит:** 8b96704
**Заметки:** Переключатель тем пока не реализован (нет client component для toggle). Тема зафиксирована как dark в layout.tsx.
