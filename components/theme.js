import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

/* Apple system palette, plus Aria's signature accent (systemIndigo → a soft violet).
   The accent is used for primary actions (send, active tab, progress) so the app reads
   as its own product while staying native-feeling; `blue` stays available for anything
   that should look like a stock iOS control. */
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return useMemo(() => dark ? {
    dark: true,
    bg: '#000000', card: '#1C1C1E', fill: '#2C2C2E', sep: '#38383A',
    label: '#FFFFFF', label2: '#98989F', label3: '#636366',
    blue: '#0A84FF', green: '#30D158', red: '#FF453B', onBlue: '#FFFFFF',
    accent: '#7D7AFF', accent2: '#BF5AF2', onAccent: '#FFFFFF',
    bubbleUser: '#7D7AFF', bubbleAI: '#1C1C1E',
  } : {
    dark: false,
    bg: '#F2F2F7', card: '#FFFFFF', fill: '#ECECEF', sep: '#E5E5EA',
    label: '#1C1C1E', label2: '#8E8E93', label3: '#C7C7CC',
    blue: '#007AFF', green: '#34C759', red: '#FF3B30', onBlue: '#FFFFFF',
    accent: '#5E5CE6', accent2: '#AF52DE', onAccent: '#FFFFFF',
    bubbleUser: '#5E5CE6', bubbleAI: '#FFFFFF',
  }, [dark]);
}
