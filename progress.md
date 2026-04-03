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

### TASK-005: Настройка tRPC с базовым API-роутером
**Статус:** done
**Дата:** 2026-04-02
**Summary:** tRPC v11 с superjson transformer. appRouter с healthcheck (public) и me (protected). fetchRequestHandler в App Router. React Query интеграция через TRPCProvider. Контекст с Prisma + сессией. protectedProcedure выбрасывает UNAUTHORIZED без сессии.
**Коммит:** ee1587e
**Заметки:** Все 4 test_steps пройдены. TypeScript типизация end-to-end работает.

### TASK-006: Аутентификация мастера: регистрация по email + пароль
**Статус:** done
**Дата:** 2026-04-02
**Summary:** Auth.js v5 (beta.30) с Credentials provider. JWT сессии. Регистрация через tRPC auth.register с bcrypt (rounds=12). Login/register страницы с i18n. Middleware объединяет next-intl routing + auth protection. Edge-compatible split: auth.config.ts (edge) / auth.ts (node). SessionProvider в providers.tsx. Dashboard защищён — 302 на /login без сессии.
**Коммит:** bdb6eff
**Заметки:** Все 5 test_steps пройдены через curl. Email verification оставлен как заглушка (нет Resend настройки).

### TASK-008: Создание и управление гильдией
**Статус:** done
**Дата:** 2026-04-02
**Summary:** tRPC guild router: create, get, update, myGuilds, addMaster, removeMaster. Invite code генерация (8-char hex). Creator = owner. Лимит 5 мастеров. Owner-only операции (add/remove masters). Auth session интегрирована в tRPC context через auth() в route handler.
**Коммит:** dc3129a
**Заметки:** Все 5 test_steps пройдены. Страница настроек гильдии (UI) — бэкенд готов, фронтенд dashboard будет в отдельной задаче.

### TASK-009: Добавление игроков и аутентификация по PIN-коду
**Статус:** done
**Дата:** 2026-04-02
**Summary:** tRPC player router: create, list, resetPin, loginByPin. PIN хешируется bcrypt (rounds=10). Уникальное имя в гильдии. Лимит 10 игроков. Login по invite_code + имя + PIN. Сброс PIN мастером. QR token генерируется при создании.
**Коммит:** 4072036
**Заметки:** Все 5 test_steps пройдены через curl. JWT-сессия для игрока пока возвращает данные (playerId, guildId), полноценная сессия будет при интеграции с UI.

### TASK-011: Создание персонажа: выбор класса и начальные характеристики
**Статус:** done
**Дата:** 2026-04-02
**Summary:** tRPC character router: create, get, getByGuild. 6 классов с уникальными распределениями stats (primary=16). Начальные значения: level=1, xp=0, gold=100, faith=10. 1:1 player-character. Дублирование блокируется.
**Коммит:** f0aec30
**Заметки:** Все 5 test_steps пройдены. UI выбора класса будет в отдельной задаче (TASK-013).

### TASK-014: CRUD квестов: создание, редактирование, удаление (мастер)
**Статус:** done
**Дата:** 2026-04-02
**Summary:** tRPC quest router: create, update, deactivate, list, get. Все поля из PRD. Назначение игрокам через assignedTo. Soft delete через isActive=false. Фильтрация по типу и статусу.
**Коммит:** 2a1daad
**Заметки:** Все 5 test_steps пройдены через node fetch. UI формы создания квеста будет в отдельной задаче.

### TASK-013: Базовый дашборд игрока: layout, карточка персонажа, навигация
**Статус:** done
**Дата:** 2026-04-02
**Summary:** Mobile-first player layout: bottom nav (mobile) / sidebar (desktop). CharacterCard: иконка класса, уровень, XP progress bar, золото, вера. 4 раздела навигации. shadcn Card/Progress/Badge. Мок-данные пока (сессия игрока не реализована).
**Коммит:** 4de16b9
**Заметки:** Все 5 test_steps пройдены. Реальные данные будут подключены после интеграции player session.

### TASK-015: Доска квестов игрока: отображение, принятие, список активных
**Статус:** done
**Дата:** 2026-04-02
**Summary:** quest.forPlayer: mandatory/optional/instances. quest.accept: принятие опциональных квестов (QuestInstance с status=accepted). Фильтрация active/completed. Защита от дублирования.
**Коммит:** f1fb164
**Заметки:** Все 5 test_steps пройдены. UI доски квестов будет подключён к данным при интеграции player session.

### TASK-016: Выполнение квестов: подтверждение (текст и master_confirm)
**Статус:** done
**Дата:** 2026-04-02
**Summary:** quest.submit, quest.review (approve/reject/return), quest.pending. Submit меняет status→pending_review. Approve: $transaction начисляет XP/gold/faith. Reject с причиной. Return→accepted.
**Коммит:** 93f86f3
**Заметки:** Все 5 test_steps пройдены. Фото-подтверждение — TASK-017.

### TASK-012: Базовый дашборд мастера: layout, навигация, обзор игроков
**Статус:** done
**Дата:** 2026-04-02
**Summary:** Dashboard layout: sidebar (desktop, md:block) / bottom-nav (mobile, md:hidden). 8 разделов навигации. Player cards с классами, уровнями, XP. Counters pending quests / unread prayers. Activity feed placeholder. 7 placeholder страниц для разделов.
**Коммит:** e3e324a
**Заметки:** Все 5 test_steps пройдены. Мок-данные для игроков; реальные данные при подключении guild context.

### TASK-007: OAuth-аутентификация мастера: Google и Apple
**Статус:** done
**Дата:** 2026-04-03
**Summary:** Google и Apple OAuth providers в Auth.js v5. signIn callback создаёт User при первом OAuth входе или линкует к существующему email. oauthProvider сохраняется. Кнопки Google/Apple на login и register с SVG иконками. i18n переводы en/ru/fr.
**Коммит:** f06d371
**Заметки:** Требует GOOGLE_CLIENT_ID/SECRET и APPLE_ID/SECRET в .env для работы. Placeholder значения в .env.

### TASK-020: Система уровней: XP-прогрессия и повышение уровня
**Статус:** done
**Дата:** 2026-04-03
**Summary:** Формула XP: 100 * level * 1.5. Автоматический level-up с переносом XP. Max level 20. ActivityLog при повышении уровня. Race-safe транзакция. Shared xpProgress() утилита для сервера и клиента. XP bar в CharacterCard.
**Коммит:** 69c4efb
**Заметки:** Уведомления игрокам о level-up будут в TASK-030 (система уведомлений). publicProcedure на character endpoints — в TASK-042 (авторизация).

### TASK-041: Безопасность: rate limiting, CSRF, XSS-защита, sanitization
**Статус:** done
**Дата:** 2026-04-03
**Summary:** In-memory rate limiter (100 req/min auth, 300 req/min API). HTML sanitization на tRPC POST body. CSP + 6 security headers в next.config.ts. ESLint: no-eval, no-implied-eval, no-new-func, react/no-danger. Auth.js CSRF — built-in.
**Коммит:** 500fe11
**Заметки:** Rate limiter in-memory — не персистентный, сбрасывается при рестарте. Redis будет позже. CSP содержит unsafe-inline/unsafe-eval для совместимости с Next.js.
