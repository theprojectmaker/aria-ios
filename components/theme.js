import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

/* Flat, restrained palette in the spirit of the ChatGPT / Claude iOS apps:
   one calm background, warm neutral surfaces, and a single jade accent used
   sparingly (send button, links, the brand mark). No gradients. */
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return useMemo(() => dark ? {
    dark: true,
    bg: '#17170F', card: '#201F1A', fill: '#2B2A24', sep: '#38362E',
    label: '#F3F1EA', label2: '#9E9C92', label3: '#67655C',
    blue: '#35B9A4', green: '#34D07A', red: '#FF5247', onBlue: '#07130F',
    accent: '#35B9A4', accent2: '#35B9A4', onAccent: '#06120E',
    bubbleUser: '#2B2A24', bubbleAI: '#17170F',
  } : {
    dark: false,
    bg: '#F7F6F2', card: '#FFFFFF', fill: '#ECEAE3', sep: '#E6E3DA',
    label: '#1A1A16', label2: '#6E6C64', label3: '#AEABA1',
    blue: '#0E7C6B', green: '#2BA86A', red: '#D1453B', onBlue: '#FFFFFF',
    accent: '#0E7C6B', accent2: '#0E7C6B', onAccent: '#FFFFFF',
    bubbleUser: '#ECE9E1', bubbleAI: '#F7F6F2',
  }, [dark]);
}
