/* Models page — every model on one screen: what's on this device, what can be
   downloaded, progress, delete, and what Automatic picks right now. */
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { MODEL_CATALOG, autoPick, catalogEntry } from './catalog';
import { useModels, downloadModel, cancelModel, deleteModel, clearFailed } from './models';

const Close = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>;
const gb = (s) => parseFloat(String(s)) || 0;

export default function ModelsScreen({ t, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const st = useModels();
  const s = styles(t);
  const ready = MODEL_CATALOG.filter((m) => st.status[m.id] && st.status[m.id].state === 'ready');
  const others = MODEL_CATALOG.filter((m) => !ready.includes(m));
  const used = ready.reduce((a, m) => a + gb(m.size), 0);
  const auto = catalogEntry(autoPick(ready.map((m) => m.id), st.failed));

  const Card = ({ m }) => {
    const ms = st.status[m.id] || { state: 'none', progress: 0 };
    const failed = st.failed.includes(m.id);
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={s.name}>{m.name}</Text>
              {m.tags.map((tg) => <View key={tg} style={s.tag}><Text style={s.tagTxt}>{tg}</Text></View>)}
            </View>
            <Text style={s.base}>{m.base} · {m.size} · {m.ram}+ GB RAM{m.think ? ' · can think' : ''}</Text>
          </View>
        </View>
        <Text style={s.pitch}>{m.pitch}</Text>
        {failed ? (
          <Pressable onPress={() => clearFailed(m.id)}><Text style={[s.small, { color: t.red }]}>Didn’t fit in this device’s memory last time · tap to try again</Text></Pressable>
        ) : null}
        {ms.state === 'downloading' ? (
          <View style={{ marginTop: 12 }}>
            <View style={s.track}><View style={[s.fillBar, { width: `${Math.round((ms.progress || 0) * 100)}%` }]} /></View>
            <View style={s.row}>
              <Text style={s.small}>Downloading {Math.round((ms.progress || 0) * 100)}%</Text>
              <Pressable onPress={() => cancelModel(m.id)} hitSlop={8}><Text style={[s.small, { color: t.accent, fontWeight: '700' }]}>Cancel</Text></Pressable>
            </View>
          </View>
        ) : ms.state === 'ready' ? (
          <View style={[s.row, { marginTop: 12 }]}>
            <Text style={[s.small, { color: t.green, fontWeight: '700' }]}>✓ On this device</Text>
            <Pressable onPress={() => Alert.alert(`Delete ${m.name}?`, `Frees about ${m.size}. You can download it again any time.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteModel(m.id) }])} hitSlop={8}>
              <Text style={[s.small, { color: t.red, fontWeight: '700' }]}>Delete</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => downloadModel(m.id)} style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}>
            <Text style={s.btnTxt}>Download · {m.size}</Text>
          </Pressable>
        )}
        {ms.error ? <Text style={[s.small, { color: t.red }]}>Download stopped: {ms.error}</Text> : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={s.head}>
          <Text style={s.title}>Models</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.close}><Close c={t.label} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
          <View style={[s.card, { backgroundColor: t.irisBg, borderColor: 'transparent' }]}>
            <Text style={[s.name, { color: t.iris }]}>Automatic</Text>
            <Text style={s.pitch}>New chats use the smartest model on this device. Right now that’s <Text style={{ fontWeight: '700', color: t.label }}>{auto ? auto.name : '—'}</Text>. You can lock any chat to a specific model from the model button at the top of the chat.</Text>
          </View>
          <Text style={s.section}>On this device{ready.length ? ` · ${used.toFixed(1)} GB` : ''}</Text>
          {ready.length ? ready.map((m) => <Card key={m.id} m={m} />) : <Text style={s.empty}>Nothing downloaded yet. Aria downloads its default model the first time you chat.</Text>}
          <Text style={s.section}>Available to download</Text>
          {others.map((m) => <Card key={m.id} m={m} />)}
          <Text style={s.note}>Models download once over the internet (Wi‑Fi recommended), then run fully offline. Bigger models know more but need more memory; if one doesn’t fit, Aria remembers and uses a smaller one.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function styles(t) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
    title: { color: t.label, fontSize: 30, fontFamily: t.serif, fontWeight: '700' },
    close: { width: 34, height: 34, borderRadius: 17, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
    section: { color: t.label2, fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: t.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sep },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
    name: { color: t.label, fontSize: 19, fontFamily: t.serif, fontWeight: '700' },
    base: { color: t.label3, fontSize: 12.5, marginTop: 3 },
    pitch: { color: t.label2, fontSize: 14.5, lineHeight: 21, marginTop: 8 },
    tag: { backgroundColor: t.fill, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    tagTxt: { color: t.label2, fontSize: 11, fontWeight: '700' },
    track: { height: 6, borderRadius: 3, backgroundColor: t.fill, overflow: 'hidden' },
    fillBar: { height: 6, borderRadius: 3, backgroundColor: t.accent },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    small: { color: t.label2, fontSize: 13, marginTop: 6 },
    btn: { marginTop: 12, backgroundColor: t.accent, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
    btnTxt: { color: t.onAccent, fontSize: 15, fontWeight: '700' },
    empty: { color: t.label3, fontSize: 14, lineHeight: 20, marginLeft: 2 },
    note: { color: t.label3, fontSize: 12.5, lineHeight: 18, marginTop: 16 },
  });
}
