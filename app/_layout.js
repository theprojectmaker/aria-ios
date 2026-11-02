import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { loadPrefs, usePrefs } from '../components/prefs';

export default function Layout() {
  const sys = useColorScheme();
  const { theme } = usePrefs();
  useEffect(() => { loadPrefs(); }, []);
  const dark = theme === 'dark' ? true : theme === 'light' ? false : sys === 'dark';
  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: dark ? '#000000' : '#FFFFFF' },
        }}
      />
    </SafeAreaProvider>
  );
}
