import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { usePrefs } from './prefs';

/* Monochrome, premium palette — graphite + white, one neutral system.
   Primary actions use near-black (light) / white (dark). A single green dot
   signals "on-device"; one restrained accent (iris) marks thinking/sources.
   Honors the theme preference (System / Light / Dark) from Settings. */
export function useTheme() {
  const sys = useColorScheme();
  const { theme } = usePrefs();
  const dark = theme === 'dark' ? true : theme === 'light' ? false : sys === 'dark';
  return useMemo(() => dark ? {
    dark: true,
    bg: '#000000', side: '#0A0A0B', card: '#111113', raised: '#161618', fill: '#1C1C1E', fill2: '#242426', sep: '#262628', sepStrong: '#3A3A3C',
    label: '#F5F5F7', label2: '#A1A1A6', label3: '#636366',
    accent: '#FFFFFF', onAccent: '#000000',
    iris: '#A5A6FF', irisBg: 'rgba(130,132,255,0.14)',
    green: '#30D158', red: '#FF453B', blue: '#0A84FF',
    bubbleUser: '#1F1F22', onBubbleUser: '#F5F5F7',
    shadow: '#000000',
  } : {
    dark: false,
    bg: '#FFFFFF', side: '#F7F7F8', card: '#FFFFFF', raised: '#FFFFFF', fill: '#F2F2F4', fill2: '#F7F7F9', sep: '#E7E7EB', sepStrong: '#D2D2D7',
    label: '#1D1D1F', label2: '#6E6E73', label3: '#AEAEB2',
    accent: '#1D1D1F', onAccent: '#FFFFFF',
    iris: '#5856D6', irisBg: 'rgba(88,86,214,0.09)',
    green: '#28A745', red: '#D1453B', blue: '#0A84FF',
    bubbleUser: '#F1F1F4', onBubbleUser: '#1D1D1F',
    shadow: '#1D1D1F',
  }, [dark]);
}
