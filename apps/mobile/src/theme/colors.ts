// Dark theme palette - Cyberpunk/Matrix theme как в веб-приложении Korneo2
export const COLORS = {
  // Core backgrounds
  bg: '#0A0A0F',
  card: '#1A1A2E',
  surface: '#12121f',

  // Text
  text: '#E0E0E0',
  sub: '#8892a0',
  textPrimary: '#E0E0E0',
  textSecondary: '#8892a0',

  // Accent colors - cyberpunk theme
  accent: '#00D9FF',
  accent2: '#00FF88',
  glow: '#0080FF',

  // Status colors
  accentSuccess: '#22C55E',
  danger: '#FF3366',
  warning: '#FF6B00',
  success: '#00FF88',

  // Borders
  border: 'rgba(0, 217, 255, 0.15)',

  // Status colours
  statusNew: '#6366f1',
  statusActive: '#00D9FF',
  statusDone: '#00FF88',
  statusPaused: '#F59E0B',
  statusCancelled: '#FF3366',
};

// Legacy alias для обратной совместимости
export const colors = {
  background: COLORS.bg,
  surface: COLORS.card,
  textPrimary: COLORS.text,
  textSecondary: COLORS.sub,
  accent: COLORS.accent,
  accentSuccess: COLORS.accentSuccess,
  border: COLORS.border,
  danger: COLORS.danger,
};

export default COLORS;