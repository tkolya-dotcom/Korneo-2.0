# TODO: План анализа и развития проекта OOO Korneo
## ✅ Завершено
- [x] Анализ структуры проекта (файлы, зависимости)
- [x] Чтение ключевых файлов (package.json, index.html, backend/index.js, KorneoMessagingService.java, schema.sql, MOBILE_PLAN.md)
- [x] Поиск паттернов (search_files по ключевым терминам)
- [x] Полный анализ: архитектура, домен, RLS, push/geo/realtime
- [x] Анализ выполнен — полный отчёт представлен

## ✅ Этап 1: Audit & Decomposition ✓
1. [x] APPLICATION_DOCUMENTATION.md ✓
2. [x] DOMAIN_MAP.md ✓
3. [x] packages/domain/types.ts ✓
4. [x] korneo-mobile/ (Expo blank-typescript) ✓

## ⏳ Этап 2: Backend & Auth (next)
1. cd korneo-mobile
2. npm install
3. npx expo install @supabase/supabase-js expo-secure-store expo-notifications expo-router nativewind
4. AuthContext + Login/Register screens
5. Role routing (Expo Router)

**Команды** (PowerShell отдельно):
```
cd korneo-mobile
npm install
npx expo doctor
npx expo start --web
```

### Этап 2: Backend & Auth
5. Supabase Auth в mobile (Login/Register/Recovery)
6. Role-aware routing

### Этапы 3-9: По плану (после подтверждения)

## 🚀 Запуск
```
npx expo start --web  # для тестирования web
npx expo run:android  # нативный Android
```
**Текущее состояние**: Готов к Expo миграции. Монолит index.html → Expo Router.

**Вопросы к owner**:
- Продолжить по MOBILE_PLAN.md (этап 1)?
- Конкретные задачи/баги?
- iOS тоже нужен?

