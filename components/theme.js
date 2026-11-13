import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { usePrefs } from './prefs';

/* Apple system look: SF (system font), iOS system colors, system blue tint,
   Liquid Glass surfaces (components/glass.js) floating over a softly lit
   background. Honors the theme preference (System / Light / Dark). */
export const SERIF = undefined;

export function useTheme() {
  const sys = useColorScheme();
  const { theme } = usePrefs();
  const dark = theme === 'dark' ? true : theme === 'light' ? false : sys === 'dark';
  return useMemo(() => dark ? {
    dark: true, serif: undefined,
    bg: '#000000', side: 'transparent', card: '#1C1C1E', raised: '#1C1C1E', fill: 'rgba(120,120,128,0.24)', fill2: 'rgba(120,120,128,0.16)', sep: 'rgba(84,84,88,0.6)', sepStrong: 'rgba(120,120,128,0.5)',
    label: '#FFFFFF', label2: 'rgba(235,235,245,0.62)', label3: 'rgba(235,235,245,0.32)',
    accent: '#0A84FF', onAccent: '#FFFFFF', ink: '#FFFFFF',
    iris: '#A49BFF', irisBg: 'rgba(124,111,255,0.18)',
    green: '#30D158', red: '#FF453A', blue: '#0A84FF',
    bubbleUser: '#0A84FF', onBubbleUser: '#FFFFFF',
    glow1: '#2A3B8F', glow2: '#3B1F6E', glow3: '#0E4F5C',
    shadow: '#000000',
  } : {
    dark: false, serif: undefined,
    bg: '#F2F2F7', side: 'transparent', card: '#FFFFFF', raised: '#FFFFFF', fill: 'rgba(120,120,128,0.12)', fill2: 'rgba(120,120,128,0.08)', sep: 'rgba(60,60,67,0.18)', sepStrong: 'rgba(60,60,67,0.29)',
    label: '#000000', label2: 'rgba(60,60,67,0.62)', label3: 'rgba(60,60,67,0.32)',
    accent: '#007AFF', onAccent: '#FFFFFF', ink: '#000000',
    iris: '#5E5CE6', irisBg: 'rgba(94,92,230,0.10)',
    green: '#34C759', red: '#FF3B30', blue: '#007AFF',
    bubbleUser: '#007AFF', onBubbleUser: '#FFFFFF',
    glow1: '#BFD3FF', glow2: '#E3D4FF', glow3: '#C6F0EA',
    shadow: '#000000',
  }, [dark]);
}
