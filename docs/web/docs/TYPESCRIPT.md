# TYPESCRIPT.md
- `strict: true`, `noUncheckedIndexedAccess: true`. `any` запрещён (eslint error).
- Доменные типы НЕ объявлять руками — только импорт из `src/contracts.ts` (генерится из crates/contracts).
- Сетевой слой в одном модуле `src/api.ts`; компоненты не зовут fetch напрямую.
- Состояние сервера — через query-кэш; локальный UI-стейт отдельно.
