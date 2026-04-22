export const colors = {
  background: '#0A0A0F',
  surface: '#1E1E2E',
  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  accent: '#00D4FF',
  text: '#FFFFFF',
  textMuted: '#888888',
  border: '#2A2A3E',
  success: '#00C896',
  error: '#FF4B6E',
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const fonts = {
  sizes: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 36 },
};

import { Platform, StatusBar } from 'react-native';
export const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;
