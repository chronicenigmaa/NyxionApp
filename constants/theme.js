import { Platform, StatusBar } from 'react-native';

export const colors = {
  background: '#FFFFFF',
  surface: '#F5F8FF',
  surfaceAlt: '#EEF2FF',
  primary: '#1A56DB',
  primaryLight: '#3B82F6',
  accent: '#1D4ED8',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  success: '#059669',
  error: '#DC2626',
  warning: '#D97706',
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const fonts = {
  sizes: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 36 },
};

export const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;
