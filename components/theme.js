import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

/* Monochrome, premium palette — graphite + white, one neutral system.
   Primary actions use near-black (light) / white (dark), like a pro AI app.
   No gradients, no decorative color; a single green dot signals "on-device". */
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return useMemo(() => dark ? {
    dark: true,
    bg: '#000000', card: '#121214', fill: '#1C1C1E', fill2: '#242426', sep: '#2A2A2C',
    label: '#F5F5F7', label2: '#98989E', label3: '#5E5E63',
    accent: '#FFFFFF', onAccent: '#000000',
    green: '#30D158', red: '#FF453B', blue: '#0A84FF',
    bubbleUser: '#1E1E20', onBubbleUser: '#F5F5F7',
  } : {
    dark: false,
    bg: '#FFFFFF', card: '#FFFFFF', fill: '#F1F1F3', fill2: '#F6F6F8', sep: '#E5E5EA',
    label: '#1D1D1F', label2: '#86868B', label3: '#B4B4BA',
    accent: '#1D1D1F', onAccent: '#FFFFFF',
    green: '#2BA84A', red: '#D1453B', blue: '#0A84FF',
    bubbleUser: '#F0F0F3', onBubbleUser: '#1D1D1F',
  }, [dark]);
}
