/**
 * Конфигурация приложения
 *
 * Секреты читаются из переменных окружения (VITE_ префикс для Vite,
 * или window.__env__ для vanilla-сборки без бандлера).
 *
 * Для локальной разработки:  скопируйте .env.example → .env и заполните значения.
 * Для GitHub Pages:          добавьте секреты в Settings → Secrets → Actions.
 */

// Вспомогательная функция: читает переменную из Vite, window.__env__ или пустую строку
function env(key) {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  if (typeof window !== 'undefined' && window.__env__) {
    return window.__env__[key] || '';
  }
  return '';
}

// Supabase конфигурация
export const SUPABASE_CONFIG = {
  url:     env('VITE_SUPABASE_URL'),
  anonKey: env('VITE_SUPABASE_ANON_KEY'),
  // serviceRoleKey используется ТОЛЬКО на сервере (backend/.env)
  // никогда не передавайте его во фронтенд
};

// Firebase конфигурация (для Push-уведомлений)
export const FIREBASE_CONFIG = {
  apiKey:            env('VITE_FIREBASE_API_KEY'),
  authDomain:        env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId:         env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket:     env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             env('VITE_FIREBASE_APP_ID'),
  measurementId:     env('VITE_FIREBASE_MEASUREMENT_ID'),
};

// VAPID ключ для Web Push
export const VAPID_PUBLIC_KEY = env('VITE_VAPID_PUBLIC_KEY');

// Mapbox токен (для карт)
export const MAPBOX_TOKEN = env('VITE_MAPBOX_TOKEN');

// Константы приложения (не секретные — можно хранить здесь)
export const APP_CONFIG = {
  name: 'ООО Корнео - Планировщик',
  version: '1.0.0',

  // Роли пользователей
  roles: {
    WORKER:       'worker',
    ENGINEER:     'engineer',
    MANAGER:      'manager',
    DEPUTY_HEAD:  'deputy_head',
    ADMIN:        'admin',
  },

  // Статусы задач
  taskStatus: {
    NEW:        'new',
    IN_PROGRESS:'in_progress',
    ON_HOLD:    'on_hold',
    COMPLETED:  'completed',
    ARCHIVED:   'archived',
  },

  // Статусы монтажей
  installationStatus: {
    NEW:        'new',
    IN_PROGRESS:'in_progress',
    COMPLETED:  'completed',
    ARCHIVED:   'archived',
  },

  // Статусы заявок на материалы
  requestStatus: {
    PENDING:  'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ISSUED:   'issued',
  },

  // Типы чатов
  chatTypes: {
    PRIVATE: 'private',
    GROUP:   'group',
    JOB:     'job',
  },

  // Приоритеты задач
  priorities: {
    LOW:    'low',
    NORMAL: 'normal',
    HIGH:   'high',
    URGENT: 'urgent',
  },

  // Настройки уведомлений
  notifications: {
    checkInterval: 30000, // 30 секунд
    maxRetries:    3,
    retryDelay:    5000,  // 5 секунд
  },

  // Кэширование
  cache: {
    enabled: true,
    ttl:     300000, // 5 минут
    maxSize: 100,    // макс. количество записей
  },
};

// URL и эндпоинты
export const API_ENDPOINTS = {
  USERS:            '/users',
  USER_BY_ID:       (id) => `/users?id=eq.${id}`,
  TASKS:            '/tasks',
  TASK_BY_ID:       (id) => `/tasks?id=eq.${id}`,
  TASKS_BY_ASSIGNEE:(assigneeId) => `/tasks?assignee_id=eq.${assigneeId}`,
  PROJECTS:         '/projects',
  INSTALLATIONS:    '/installations',
  TASKS_AVR:        '/tasks_avr',
  CHATS:            '/chats',
  MESSAGES:         '/messages',
  MATERIALS:        '/materials',
  MATERIALS_REQUESTS:'/materials_requests',
  PURCHASE_REQUESTS: '/purchase_requests',
};

// Экспорт в window для совместимости с vanilla JS (без бандлера)
if (typeof window !== 'undefined') {
  window.APP_CONFIG      = APP_CONFIG;
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
  window.FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.VAPID_PUBLIC_KEY= VAPID_PUBLIC_KEY;
  window.MAPBOX_TOKEN    = MAPBOX_TOKEN;
}
