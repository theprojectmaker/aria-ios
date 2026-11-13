import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { usePrefs } from './prefs';

/* Native iOS feel: system font, system grouped greys, one restrained accent
   (deep green) used only for primary actions and state. No decorative type,
   no gradients. Honors the theme preference (System / Light / Dark). */
export const SERIF = undefined; // system font everywhere

export function useTheme() {
  const sys = useColorScheme();
  const { theme } = usePrefs();
  const dark = theme === 'dark' ? true : theme === 'light' ? false : sys === 'dark';
  return useMemo(() => dark ? {
    dark: true, serif: undefined,
    bg: '#000000', side: '#1C1C1E', card: '#1C1C1E', raised: '#1C1C1E', fill: '#2C2C2E', fill2: '#1C1C1E', sep: '#38383A', sepStrong: '#48484A',
    label: '#FFFFFF', label2: '#98989F', label3: '#636366',
    accent: '#3DBE84', onAccent: '#00160C', ink: '#FFFFFF',
    iris: '#3DBE84', irisBg: 'rgba(61,190,132,0.15)',
    green: '#30D158', red: '#FF453A', blue: '#0A84FF',
    bubbleUser: '#2C2C2E', onBubbleUser: '#FFFFFF',
    shadow: '#000000',
  } : {
    dark: false, serif: undefined,
    bg: '#FFFFFF', side: '#F2F2F7', card: '#FFFFFF', raised: '#FFFFFF', fill: '#EFEFF4', fill2: '#F2F2F7', sep: '#E3E3E8', sepStrong: '#C7C7CC',
    label: '#000000', label2: '#6C6C70', label3: '#AEAEB2',
    accent: '#1E7A52', onAccent: '#FFFFFF', ink: '#000000',
    iris: '#1E7A52', irisBg: 'rgba(30,122,82,0.09)',
    green: '#34C759', red: '#FF3B30', blue: '#007AFF',
    bubbleUser: '#EFEFF4', onBubbleUser: '#000000',
    shadow: '#000000',
  }, [dark]);
}
