import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { usePrefs, setTheme, setModelPref, setKnowledge, setReasoning } from './prefs';
import { MODEL_CATALOG, AUTO, normalizeModelPref } from './catalog';
import { useLibrary, downloadLibrary, cancelLibrary, deleteLibrary, LIBRARY_AVAILABLE } from './library';

const Close = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>;
const Check = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M5 13l4 4L19 7" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;

const REASONING_OPTIONS = [
  { key: 'auto', title: 'Automatic', sub: 'Quick answers for simple questions, careful thinking for hard ones' },
  { key: 'deep', title: 'Always think harder', sub: 'Slower, but more careful on every question' },
  { key: 'fast', title: 'Fast', sub: 'Never pause to think — quickest replies' },
];
const KNOWLEDGE_OPTIONS = [
  { key: 'on', title: 'On', sub: 'Check the handbook, dictionary and encyclopedia before answering' },
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
  const lib = useLibrary();
  const mb = (b) => Math.round((b || 0) / 1048576);
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

          <Text style={s.section}>Offline library</Text>
          <View style={s.card}>
            <View style={s.about}>
              <Text style={s.aboutTitle}>{lib.status === 'ready' ? 'Library installed' : 'Make Aria know much more'}</Text>
              <Text style={s.aboutBody}>{lib.status === 'ready'
                ? `${(lib.docs || 0).toLocaleString('en-US')} encyclopedia articles and an 86,000-word dictionary, searched offline before Aria answers.`
                : '79,000 encyclopedia articles + an 86,000-word dictionary that Aria checks before answering. One download (about 75 MB, Wi‑Fi recommended), then fully offline. Without it, Aria uses its built-in 9,000-topic encyclopedia and handbook.'}</Text>
              {lib.status === 'downloading' ? (
                <View style={{ marginTop: 14 }}>
                  <View style={s.track}><View style={[s.fillBar, { width: `${Math.round((lib.progress || 0) * 100)}%` }]} /></View>
                  <Text style={s.version}>{mb(lib.bytes)} of {mb(lib.total)} MB · {Math.round((lib.progress || 0) * 100)}%</Text>
                </View>
              ) : null}
              {lib.status === 'error' ? <Text style={[s.version, { color: t.red }]}>Download stopped: {lib.error}. Tap Download to resume.</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                {lib.status === 'ready' ? (
                  <Pressable onPress={() => Alert.alert('Delete the library?', 'Frees about 75 MB. You can download it again any time.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: deleteLibrary }])} style={({ pressed }) => [s.btn2, pressed && { opacity: 0.6 }]}><Text style={[s.btn2Txt, { color: t.red }]}>Delete library</Text></Pressable>
                ) : lib.status === 'downloading' ? (
                  <Pressable onPress={cancelLibrary} style={({ pressed }) => [s.btn2, pressed && { opacity: 0.6 }]}><Text style={s.btn2Txt}>Cancel</Text></Pressable>
                ) : (
                  <Pressable onPress={downloadLibrary} style={({ pressed }) => [s.btn1, pressed && { opacity: 0.8 }]}><Text style={s.btn1Txt}>{lib.status === 'error' ? 'Resume download' : 'Download library'}</Text></Pressable>
                )}
              </View>
              {!LIBRARY_AVAILABLE ? <Text style={s.version}>Preview — the real download runs in the installed app.</Text> : null}
            </View>
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
    track: { height: 6, borderRadius: 3, backgroundColor: t.fill, overflow: 'hidden' },
    fillBar: { height: 6, borderRadius: 3, backgroundColor: t.accent },
    btn1: { flex: 1, backgroundColor: t.accent, borderRadius: 100, paddingVertical: 12, alignItems: 'center' },
    btn1Txt: { color: t.onAccent, fontSize: 15, fontWeight: '600' },
    btn2: { flex: 1, backgroundColor: t.fill, borderRadius: 100, paddingVertical: 12, alignItems: 'center' },
    btn2Txt: { color: t.label, fontSize: 15, fontWeight: '600' },
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
