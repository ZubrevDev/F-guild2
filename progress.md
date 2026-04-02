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

### TASK-003: Настройка PostgreSQL + Prisma ORM со схемой базы данных
**Статус:** done
**Дата:** 2026-04-02
**Summary:** Prisma 6.19.3 с полной схемой БД из PRD. 16 моделей, 13 enum-типов, UUID PK, связи и индексы. PostgreSQL через brew. Seed: гильдия "Дом Солнца", мастер, игрок "Артас" (fighter), квест, предмет, бафф. Все 4 test_steps пройдены.
**Коммит:** 3d58d0d
**Заметки:** Prisma 7 не совместима с Node 20.11 — использована Prisma 6. PostgreSQL 17 установлен через brew. .env не коммитится (в .gitignore).

### TASK-004: Настройка i18n (next-intl) с поддержкой en/ru/fr
**Статус:** done
**Дата:** 2026-04-02
**Summary:** next-intl 4.9.0. Prefix-based URL (/en/, /ru/, /fr/). Middleware с auto-detect языка браузера. Переводы: common, nav, home. LocaleSwitcher компонент. App переструктурирован на [locale]. / → 307 redirect на /en.
**Коммит:** b9d2eb6
**Заметки:** Все 5 test_steps пройдены через curl. Контент корректно переключается по локалям.
