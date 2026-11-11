import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { usePrefs, setTheme, setModelPref, setKnowledge } from './prefs';

const Close = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>;
const Check = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M5 13l4 4L19 7" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;

export const MODEL_OPTIONS = [
  { key: 'auto', title: 'Automatic', sub: 'Recommended — picks the best model your device can run' },
  { key: 'light', title: 'Lighter', sub: 'Qwen3 0.6B · ~0.5 GB · fastest, runs on anything' },
  { key: 'balanced', title: 'Balanced', sub: 'Qwen3 1.7B · ~1.2 GB · smarter, good on most devices' },
  { key: 'smart', title: 'Smarter', sub: 'Qwen3 4B · ~2.8 GB · most knowledge, newer iPhone/iPad only' },
];
const KNOWLEDGE_OPTIONS = [
  { key: 'on', title: 'On', sub: 'Look up facts in a built-in offline encyclopedia (9,000+ topics)' },
  { key: 'off', title: 'Off', sub: 'Answer from the model alone' },
];
const THEME_OPTIONS = [
  { key: 'system', title: 'System', sub: 'Match your phone' },
  { key: 'light', title: 'Light', sub: '' },
  { key: 'dark', title: 'Dark', sub: '' },
];

export default function Settings({ t, visible, onClose, onClearChats }) {
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const s = styles(t);

  const Row = ({ title, sub, selected, onPress, danger }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.fill }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowTitle, danger && { color: t.red }]}>{title}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {selected ? <Check c={t.accent} /> : null}
    </Pressable>
  );

  const confirmClear = () => {
    Alert.alert('Clear all chats?', 'This permanently deletes every saved conversation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => { onClearChats && onClearChats(); onClose(); } },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={s.head}>
          <Text style={s.headTitle}>Settings</Text>
          <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.5 }]}><Close c={t.label} /></Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
          <Text style={s.section}>Model</Text>
          <View style={s.card}>
            {MODEL_OPTIONS.map((m, i) => (
              <View key={m.key}>
                {i > 0 ? <View style={s.sep} /> : null}
                <Row title={m.title} sub={m.sub} selected={prefs.model === m.key} onPress={() => setModelPref(m.key)} />
              </View>
            ))}
          </View>
          <Text style={s.note}>Switching downloads the model the first time you chat. On-device AI is private and works offline, but it’s smaller than cloud AI — expect the occasional mistake.</Text>

          <Text style={s.section}>Knowledge</Text>
          <View style={s.card}>
            {KNOWLEDGE_OPTIONS.map((o, i) => (
              <View key={o.key}>
                {i > 0 ? <View style={s.sep} /> : null}
                <Row title={o.title} sub={o.sub} selected={(prefs.knowledge || 'on') === o.key} onPress={() => setKnowledge(o.key)} />
              </View>
            ))}
          </View>
          <Text style={s.note}>The encyclopedia is bundled in the app and used to ground answers in real facts — no internet needed. It can’t cover everything, so Aria still fills gaps from the model.</Text>

          <Text style={s.section}>Appearance</Text>
          <View style={s.card}>
            {THEME_OPTIONS.map((th, i) => (
              <View key={th.key}>
                {i > 0 ? <View style={s.sep} /> : null}
                <Row title={th.title} sub={th.sub} selected={prefs.theme === th.key} onPress={() => setTheme(th.key)} />
              </View>
            ))}
          </View>

          <Text style={s.section}>Chats</Text>
          <View style={s.card}>
            <Row title="Clear all chats" danger onPress={confirmClear} />
          </View>

          <Text style={s.section}>About</Text>
          <View style={s.card}>
            <View style={s.about}>
              <Text style={s.aboutTitle}>Aria runs entirely on your phone.</Text>
              <Text style={s.aboutBody}>Your chats and photos never leave your device — there’s no account and no server. Everything works offline once the model is downloaded.</Text>
              <Text style={s.version}>Version 1.0.0</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function styles(t) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
    headTitle: { color: t.label, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
    section: { color: t.label2, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 22, marginBottom: 9, marginLeft: 6 },
    card: { backgroundColor: t.card, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sep, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 15 },
    rowTitle: { color: t.label, fontSize: 16, fontWeight: '500' },
    rowSub: { color: t.label2, fontSize: 13, marginTop: 2, lineHeight: 18 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: t.sep, marginLeft: 15 },
    note: { color: t.label3, fontSize: 12.5, lineHeight: 18, marginTop: 10, marginHorizontal: 6 },
    about: { paddingVertical: 16, paddingHorizontal: 15 },
    aboutTitle: { color: t.label, fontSize: 15.5, fontWeight: '600' },
    aboutBody: { color: t.label2, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
    version: { color: t.label3, fontSize: 12.5, marginTop: 12 },
  });
}
