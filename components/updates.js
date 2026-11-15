/* Quietly fetches a newer over-the-air update at launch and offers a
   one-tap restart, so updates no longer need the app reopened twice. */
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Glass from './glass';

export default function UpdatePill({ t, top }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const U = require('expo-updates');
        if (!U.isEnabled || __DEV__) return;
        const res = await U.checkForUpdateAsync();
        if (!res.isAvailable) return;
        await U.fetchUpdateAsync();
        if (alive) setReady(true);
      } catch (e) { /* offline or unsupported: stay quiet */ }
    })();
    return () => { alive = false; };
  }, []);
  if (!ready) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top, alignItems: 'center' }}>
      <Glass t={t} regular interactive radius={18}>
        <Pressable accessibilityLabel="Restart to update" onPress={() => { try { require('expo-updates').reloadAsync(); } catch (e) {} }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14 }}>
          <Text style={{ color: t.label, fontSize: 13.5, fontWeight: '600' }}>Update ready</Text>
          <Text style={{ color: t.accent, fontSize: 13.5, fontWeight: '700' }}>Restart</Text>
        </Pressable>
      </Glass>
    </View>
  );
}
