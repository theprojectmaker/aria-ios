import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { usePrefs, setTheme, setModelPref, setKnowledge, setReasoning } from './prefs';
import { MODEL_CATALOG, AUTO, normalizeModelPref } from './catalog';

const Close = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>;
const Check = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M5 13l4 4L19 7" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;

const REASONING_OPTIONS = [
  { key: 'auto', title: 'Automatic', sub: 'Quick answers for simple questions, careful thinking for hard ones' },
  { key: 'deep', title: 'Always think harder', sub: 'Slower, but more careful on every question' },
  { key: 'fast', title: 'Fast', sub: 'Never pause to think — quickest replies' },
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
  const modelPref = normalizeModelPref(prefs.model);
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
          <Text style={s.section}>Model library</Text>
          <View style={s.card}>
            <Row title={AUTO.name} sub={AUTO.pitch} selected={modelPref === 'auto'} onPress={() => setModelPref('auto')} />
            {MODEL_CATALOG.map((m) => (
              <View key={m.id}>
                <View style={s.sep} />
                <Pressable onPress={() => setModelPref(m.id)} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.fill }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={s.rowTitle}>{m.name}</Text>
                      {m.tags.map((tg) => <View key={tg} style={s.tag}><Text style={s.tagTxt}>{tg}</Text></View>)}
                    </View>
                    <Text style={s.rowSub}>{m.pitch}</Text>
                    <Text style={s.rowMeta}>{m.base} · {m.size} · best with {m.ram}+ GB RAM</Text>
                  </View>
                  {modelPref === m.id ? <Check c={t.accent} /> : null}
                </Pressable>
              </View>
            ))}
          </View>
          <Text style={s.note}>A model downloads the first time you use it, then works offline. If a model is too big for this device, Aria automatically steps down to a smaller one.</Text>

          <Text style={s.section}>Thinking</Text>
          <View style={s.card}>
            {REASONING_OPTIONS.map((o, i) => (
              <View key={o.key}>
                {i > 0 ? <View style={s.sep} /> : null}
                <Row title={o.title} sub={o.sub} selected={(prefs.reasoning || 'auto') === o.key} onPress={() => setReasoning(o.key)} />
              </View>
            ))}
          </View>

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
              <Text style={s.aboutTitle}>Aria runs entirely on this device.</Text>
              <Text style={s.aboutBody}>Your chats and photos never leave it — no account, no server. Math is computed exactly by a built-in calculator, facts are checked against an offline library of 9,000+ topics, and photos are read on-device.</Text>
              <Text style={s.version}>Aria 2.0 · library: Simple English Wikipedia (CC BY-SA)</Text>
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
    rowMeta: { color: t.label3, fontSize: 12, marginTop: 3 },
    tag: { backgroundColor: t.fill, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    tagTxt: { color: t.label2, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: t.sep, marginLeft: 15 },
    note: { color: t.label3, fontSize: 12.5, lineHeight: 18, marginTop: 10, marginHorizontal: 6 },
    about: { paddingVertical: 16, paddingHorizontal: 15 },
    aboutTitle: { color: t.label, fontSize: 15.5, fontWeight: '600' },
    aboutBody: { color: t.label2, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
    version: { color: t.label3, fontSize: 12.5, marginTop: 12 },
  });
}
