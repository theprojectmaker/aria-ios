import { useRef, useEffect, useState, memo } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet, Share,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import Markdown from 'react-native-markdown-display';
import { ActionsSheet, ToolsHub } from './tools';
import Settings from './settings';
import ModelsScreen from './modelsScreen';
import { usePrefs, setReasoning } from './prefs';
import { MODEL_CATALOG, autoPick, catalogEntry } from './catalog';
import { useModels } from './models';

/* ── marks & icons ─────────────────────────────────────────────────────── */
const SPARK = 'M12 1.6C12.95 7.6 16.4 11.05 22.4 12C16.4 12.95 12.95 16.4 12 22.4C11.05 16.4 7.6 12.95 1.6 12C7.6 11.05 11.05 7.6 12 1.6Z';
export const AriaMark = ({ size = 22, c = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={SPARK} fill={c} /></Svg>
);
// Brand mark: a terracotta seal with the spark — drawn in one SVG so stacking can't hide it.
function Seal({ t, size = 64 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="31" fill={t.accent} />
      <Circle cx="32" cy="32" r="26.5" fill="none" stroke={t.onAccent} strokeOpacity={0.35} strokeWidth="1" />
      <Path d={SPARK} fill={t.onAccent} transform="translate(19 19) scale(1.08)" />
    </Svg>
  );
}
const Ic = {
  send: (c) => <Svg width={18} height={18} viewBox="0 0 20 20"><Path d="M10 15.5V5M10 5l-4.5 4.5M10 5l4.5 4.5" fill="none" stroke={c} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  stop: (c) => <Svg width={14} height={14} viewBox="0 0 16 16"><Rect x="3.5" y="3.5" width="9" height="9" rx="2" fill={c} /></Svg>,
  plus: (c, s = 22) => <Svg width={s} height={s} viewBox="0 0 24 24"><Path d="M12 5.5v13M5.5 12h13" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>,
  menu: (c) => <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M4 7.5h16M4 12h11M4 16.5h16" stroke={c} strokeWidth={1.9} strokeLinecap="round" /></Svg>,
  note: (c) => <Svg width={21} height={21} viewBox="0 0 24 24"><Path d="M6 3.5h8.5L19 8v12.5H6z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" /><Path d="M14 3.5V8h5M12.5 11.5v6M9.5 14.5h6" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></Svg>,
  trash: (c) => <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  pencil: (c) => <Svg width={19} height={19} viewBox="0 0 24 24"><Path d="M15.5 5l3.5 3.5L10 17.5 6 18.5 7 14.5 15.5 5Z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" /></Svg>,
  bulb: (c) => <Svg width={19} height={19} viewBox="0 0 24 24"><Path d="M9 17h6M10 20.5h4M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1.1-.9 1.8H9.3c0-.7-.3-1.3-.9-1.8A6 6 0 0 1 12 3Z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" /></Svg>,
  camera: (c, s = 19) => <Svg width={s} height={s} viewBox="0 0 24 24"><Path d="M4 7h3l1.3-2h7.4L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" /><Circle cx={12} cy={13} r={3.3} fill="none" stroke={c} strokeWidth={1.8} /></Svg>,
  scan: (c) => <Svg width={19} height={19} viewBox="0 0 24 24"><Path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" /><Path d="M8 10h8M8 13h8M8 16h5" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></Svg>,
  sigma: (c) => <Svg width={19} height={19} viewBox="0 0 24 24"><Path d="M17 5H7l6 7-6 7h10" fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  book: (c, s = 19) => <Svg width={s} height={s} viewBox="0 0 24 24"><Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" /></Svg>,
  close: (c) => <Svg width={14} height={14} viewBox="0 0 16 16"><Path d="M4 4l8 8M12 4l-8 8" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></Svg>,
  chevron: (c, open) => <Svg width={12} height={12} viewBox="0 0 12 12"><Path d={open ? 'M2.5 4.5l3.5 3.5 3.5-3.5' : 'M4.5 2.5l3.5 3.5-3.5 3.5'} fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  down: (c) => <Svg width={11} height={11} viewBox="0 0 12 12"><Path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  gear: (c) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M4 8h9M19 8h1M4 16h1M11 16h9" stroke={c} strokeWidth={1.8} strokeLinecap="round" /><Circle cx={15} cy={8} r={2.4} fill="none" stroke={c} strokeWidth={1.8} /><Circle cx={7} cy={16} r={2.4} fill="none" stroke={c} strokeWidth={1.8} /></Svg>,
  chip: (c) => <Svg width={18} height={18} viewBox="0 0 24 24"><Rect x="6" y="6" width="12" height="12" rx="2.5" fill="none" stroke={c} strokeWidth={1.8} /><Path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></Svg>,
  copy: (c) => <Svg width={16} height={16} viewBox="0 0 24 24"><Rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke={c} strokeWidth={1.8} /><Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke={c} strokeWidth={1.8} /></Svg>,
  retry: (c) => <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  share: (c) => <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  brain: (c) => <Svg width={15} height={15} viewBox="0 0 24 24"><Path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4H9ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4h1Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /></Svg>,
  search: (c) => <Svg width={15} height={15} viewBox="0 0 24 24"><Circle cx={11} cy={11} r={6.5} fill="none" stroke={c} strokeWidth={1.9} /><Path d="M16 16l4 4" stroke={c} strokeWidth={1.9} strokeLinecap="round" /></Svg>,
  sidebar: (c) => <Svg width={21} height={21} viewBox="0 0 24 24"><Rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke={c} strokeWidth={1.8} /><Path d="M9.5 4.5v15" stroke={c} strokeWidth={1.8} /></Svg>,
  check: (c) => <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M5 13l4 4L19 7" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
};

const MAX_COL = 740;

/* ── small pieces ──────────────────────────────────────────────────────── */
function PressScale({ style, children, onPress, onLongPress, disabled, hitSlop, label }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x) => Animated.spring(v, { toValue: x, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 0 }).start();
  const flat = StyleSheet.flatten(style) || {};
  const { width, minWidth, maxWidth, alignSelf, flex, margin, marginTop, marginBottom, marginHorizontal, marginVertical, ...inner } = flat;
  const outer = { width, minWidth, maxWidth, alignSelf, flex, margin, marginTop, marginBottom, marginHorizontal, marginVertical };
  Object.keys(outer).forEach((k) => outer[k] === undefined && delete outer[k]);
  return (
    <Pressable accessibilityLabel={label} style={outer} onPress={onPress} onLongPress={onLongPress} disabled={disabled} hitSlop={hitSlop} onPressIn={() => to(0.97)} onPressOut={() => to(1)}>
      <Animated.View style={[inner, { flexGrow: 1, transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function ThoughtBlock({ t, think, live }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!!live); }, [live]);
  const words = think ? think.split(/\s+/).length : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: t.irisBg, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 100, alignSelf: 'flex-start' }}>
        {live ? <ActivityIndicator size="small" color={t.iris} style={{ transform: [{ scale: 0.7 }] }} /> : Ic.brain(t.iris)}
        <Text style={{ color: t.iris, fontSize: 13, fontWeight: '700' }}>{live ? 'Thinking it through…' : `Thought it through · ${words} words`}</Text>
        {!live ? Ic.chevron(t.iris, open) : null}
      </Pressable>
      {open && think ? (
        <View style={{ borderLeftWidth: 2, borderLeftColor: t.iris, paddingLeft: 12, marginTop: 9, marginLeft: 4, opacity: 0.85 }}>
          <Text style={{ color: t.label2, fontSize: 13.5, lineHeight: 20, fontStyle: 'italic' }}>{think}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TypingDots({ t }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    l.start(); return () => l.stop();
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 6 }}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.accent,
          opacity: a.interpolate({ inputRange: [0, (i + 0.5) / 4, (i + 1.5) / 4, 1], outputRange: [0.25, 1, 0.25, 0.25], extrapolate: 'clamp' }) }} />
      ))}
    </View>
  );
}

function Ring({ t, progress, indeterminate, size = 124, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!indeterminate) return;
    const anim = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    anim.start(); return () => anim.stop();
  }, [indeterminate]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pct = indeterminate ? 0.28 : Math.max(0.02, Math.min(1, progress || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
      <Animated.View style={indeterminate ? { transform: [{ rotate }] } : null}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.fill} strokeWidth={stroke} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
      </Animated.View>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {indeterminate ? <AriaMark size={28} c={t.accent} />
          : <Text style={{ color: t.label, fontSize: 28, fontFamily: t.serif, fontWeight: '700' }}>{Math.round((progress || 0) * 100)}%</Text>}
      </View>
    </View>
  );
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - (ts || 0)) / 1000);
  if (s < 60) return 'now';
  const m = Math.round(s / 60); if (m < 60) return m + 'm';
  const h = Math.round(m / 60); if (h < 24) return h + 'h';
  return Math.round(h / 24) + 'd';
}
function fmtEta(sec) {
  if (!isFinite(sec) || sec <= 0) return '';
  if (sec < 8) return 'a few seconds left';
  if (sec < 90) return `about ${Math.round(sec / 5) * 5}s left`;
  return `about ${Math.round(sec / 60)} min left`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late?' : h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.';
}
function dateLine() {
  try { return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(); } catch (e) { return ''; }
}

const STARTERS = [
  { key: 'worksheet', title: 'Solve a worksheet', sub: 'Snap a photo — every question answered', icon: 'scan', kind: 'photo', mode: 'camera' },
  { key: 'explain', title: 'Explain a topic or book', sub: 'Deep, organised explanations', icon: 'book', kind: 'text', value: 'Tell me about ' },
  { key: 'math', title: 'Exact math', sub: 'Calculations that are always right', icon: 'sigma', kind: 'text', value: 'What is ' },
  { key: 'write', title: 'Help me write', sub: 'Essays, emails, messages', icon: 'pencil', kind: 'text', value: 'Help me write ' },
];

/* ── message ───────────────────────────────────────────────────────────── */
const Message = memo(function Message({ t, s, m, isLast, onCopy, onRegenerate, index, generating }) {
  if (m.role === 'user') {
    return (
      <Pressable onLongPress={() => m.text && onCopy(m.text)} style={s.userRow}>
        <View style={s.userBubble}>
          {m.imageUri ? <Image source={{ uri: m.imageUri }} style={s.msgImage} resizeMode="cover" /> : null}
          {m.text ? <Text style={s.userTxt} selectable>{m.text}</Text> : null}
        </View>
      </Pressable>
    );
  }
  const done = !m.streaming;
  return (
    <View style={s.aiCard}>
      {m.think ? <ThoughtBlock t={t} think={m.think} live={!!m.streaming && !m.text} /> : null}
      {m.streaming && !m.think && !m.text && m.thinking ? <ThoughtBlock t={t} think="" live /> : null}
      {m.text ? <Markdown style={mdStyles(t)}>{m.text}</Markdown> : null}
      {m.streaming && !m.think && !m.text && !m.thinking ? <TypingDots t={t} /> : null}
      {done && m.sources && m.sources.length ? (
        <View style={s.sources}>
          <Text style={s.srcLbl}>Checked</Text>
          {m.sources.map((src) => <View key={src} style={s.srcChip}><Text style={s.srcTxt} numberOfLines={1}>{src}</Text></View>)}
        </View>
      ) : null}
      {done && m.text ? (
        <View style={s.actions}>
          <Pressable accessibilityLabel="Copy answer" hitSlop={8} onPress={() => onCopy(m.text)} style={({ pressed }) => [s.actBtn, pressed && { backgroundColor: t.fill }]}>{Ic.copy(t.label3)}</Pressable>
          {isLast && onRegenerate && !generating ? <Pressable accessibilityLabel="Regenerate answer" hitSlop={8} onPress={() => onRegenerate(index)} style={({ pressed }) => [s.actBtn, pressed && { backgroundColor: t.fill }]}>{Ic.retry(t.label3)}</Pressable> : null}
          <Pressable accessibilityLabel="Share answer" hitSlop={8} onPress={() => Share.share({ message: m.text }).catch(() => {})} style={({ pressed }) => [s.actBtn, pressed && { backgroundColor: t.fill }]}>{Ic.share(t.label3)}</Pressable>
          {m.model ? <Text style={s.aiMeta}>{m.model}{m.secs ? ` · ${m.secs}s` : ''}</Text> : null}
        </View>
      ) : null}
    </View>
  );
});

/* ── notebook list (iPad sidebar / phone drawer) ───────────────────────── */
function ChatList({ t, s, chats, activeChatId, onOpen, onDelete, onNew, onSettings, onModels, status, insets, inDrawer }) {
  const [q, setQ] = useState('');
  const list = (chats || []).filter((c) => !q || (c.title || '').toLowerCase().includes(q.toLowerCase()));
  const today = list.filter((c) => Date.now() - (c.updatedAt || 0) < 86400000);
  const older = list.filter((c) => Date.now() - (c.updatedAt || 0) >= 86400000);
  const ready = status && status.state === 'ready';
  const Row = (c) => {
    const on = c.id === activeChatId;
    const locked = c.model && c.model !== 'auto' ? catalogEntry(c.model) : null;
    return (
      <Pressable key={c.id} onPress={() => onOpen(c.id)} style={({ pressed }) => [s.chatRow, on && s.chatRowOn, pressed && { opacity: 0.6 }]}>
        <View style={[s.tab, { backgroundColor: on ? t.accent : t.sepStrong }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.chatRowTitle, on && { fontWeight: '700' }]} numberOfLines={1}>{c.title || 'New note'}</Text>
          <Text style={s.chatRowTime}>{timeAgo(c.updatedAt)}{locked ? ` · ${locked.name}` : ''}</Text>
        </View>
        <Pressable accessibilityLabel="Delete chat" onPress={() => onDelete(c.id)} hitSlop={8} style={{ padding: 4 }}>{Ic.trash(t.label3)}</Pressable>
      </Pressable>
    );
  };
  return (
    <View style={{ flex: 1, paddingTop: insets.top + (inDrawer ? 14 : 12) }}>
      <View style={s.brandRow}>
        <Text style={s.brandTxt}>Notes</Text>
        <Pressable accessibilityLabel="New chat" onPress={onNew} hitSlop={10} style={({ pressed }) => [s.newChat, pressed && { opacity: 0.5 }]}>{Ic.note(t.accent)}</Pressable>
      </View>
      <View style={s.search}>
        {Ic.search(t.label3)}
        <TextInput value={q} onChangeText={setQ} placeholder="Search notes" placeholderTextColor={t.label3} style={s.searchInput} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
        {today.length ? <Text style={s.groupLbl}>Today</Text> : null}
        {today.map(Row)}
        {older.length ? <Text style={s.groupLbl}>Earlier</Text> : null}
        {older.map(Row)}
        {!list.length ? <Text style={[s.groupLbl, { textTransform: 'none', letterSpacing: 0 }]}>{q ? 'No matches' : 'No notes yet'}</Text> : null}
      </ScrollView>
      <View style={[s.sideFoot, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable accessibilityLabel="Models" onPress={onModels} style={({ pressed }) => [s.footBtn, pressed && { opacity: 0.6 }]}>
          {Ic.chip(t.label2)}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.footModel} numberOfLines={1}>Models</Text>
            <Text style={s.footSub} numberOfLines={1}>{ready && status.model ? `Using ${status.model.name}` : (status && status.label) || ''}</Text>
          </View>
        </Pressable>
        <Pressable accessibilityLabel="Settings" onPress={onSettings} style={({ pressed }) => [s.footIcon, pressed && { opacity: 0.6 }]}>{Ic.gear(t.label2)}</Pressable>
      </View>
    </View>
  );
}

/* ── per-chat model picker ─────────────────────────────────────────────── */
function ModelPicker({ t, s, visible, onClose, chatModel, onPick, onManage }) {
  const st = useModels();
  const ready = MODEL_CATALOG.filter((m) => st.status[m.id] && st.status[m.id].state === 'ready');
  const auto = catalogEntry(autoPick(ready.map((m) => m.id), st.failed));
  const Opt = ({ id, title, sub }) => (
    <Pressable onPress={() => { onPick(id); onClose(); }} style={({ pressed }) => [s.pickRow, pressed && { backgroundColor: t.fill }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.pickTitle}>{title}</Text>
        <Text style={s.pickSub}>{sub}</Text>
      </View>
      {(chatModel || 'auto') === id ? Ic.check(t.accent) : null}
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grabber} />
          <Text style={s.sheetTitle}>Model for this note</Text>
          <Opt id="auto" title="Automatic" sub={`Smartest model on this device${auto ? ` — now ${auto.name}` : ''}`} />
          {ready.map((m) => <Opt key={m.id} id={m.id} title={m.name} sub={`${m.base} · ${m.pitch}`} />)}
          <Pressable onPress={() => { onClose(); onManage(); }} style={({ pressed }) => [s.manageBtn, pressed && { opacity: 0.7 }]}>
            {Ic.chip(t.accent)}<Text style={s.manageTxt}>Get more models</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── main ──────────────────────────────────────────────────────────────── */
export default function ChatUI({
  t, messages, input, setInput, onSend, onStop, onRegenerate, generating,
  status, onDownload, banner,
  onPickImage, attachedUri, onClearImage, canSend,
  title, chats, activeChatId, onNewChat, onOpenChat, onDeleteChat,
  onPickExample, onClearChats, chatModel, onSetChatModel,
  placeholder = 'Ask anything…', download = {},
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const s = styles(t, wide);
  const prefs = usePrefs();
  const scrollRef = useRef(null);
  const [drawer, setDrawer] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [toast, setToast] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [tool, setTool] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [eta, setEta] = useState('');
  const dlRef = useRef({ t0: 0, p0: 0 });
  const prevStateRef = useRef(status.state);
  const hasChats = Array.isArray(chats);
  const showSide = wide && hasChats && sideOpen;

  useEffect(() => {
    if (status.state === 'downloading') {
      const p = status.progress || 0;
      const now = Date.now();
      if (!dlRef.current.t0 || p < dlRef.current.p0) dlRef.current = { t0: now, p0: p };
      const dt = (now - dlRef.current.t0) / 1000;
      const dp = p - dlRef.current.p0;
      if (dt > 2 && dp > 0.01) setEta(fmtEta(((1 - p) / dp) * dt));
    } else { dlRef.current = { t0: 0, p0: 0 }; if (eta) setEta(''); }
  }, [status.state, status.progress]);

  useEffect(() => {
    const was = prevStateRef.current;
    prevStateRef.current = status.state;
    if (status.state === 'ready' && was === 'downloading') flash('Aria is ready');
  }, [status.state]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages, generating, attachedUri]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1800); };
  const copy = (text) => { try { const C = require('expo-clipboard'); C.setStringAsync(text); flash('Copied'); } catch (e) {} };
  const tapStarter = (sg) => {
    if (sg.kind === 'photo') { onPickImage && onPickImage(sg.mode); }
    else { onPickExample && onPickExample(sg.value || ''); }
  };

  const ready = status.state === 'ready';
  const empty = messages.length === 0;
  const busy = status.state === 'downloading' || status.state === 'loading';
  const setupScreen = (status.state === 'needs-download' || status.state === 'unavailable' || busy) && empty;
  const sendEnabled = (canSend !== undefined ? canSend : ready) && (!!input.trim() || !!attachedUri);
  const deep = prefs.reasoning === 'deep';
  const lastAi = (() => { for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i; return -1; })();
  const recent = (chats || []).filter((c) => c.id !== activeChatId && c.messages && c.messages.length).slice(0, 3);
  const lockedEntry = chatModel && chatModel !== 'auto' ? catalogEntry(chatModel) : null;
  const modelLabel = lockedEntry ? lockedEntry.name : 'Auto';

  const header = (
    <View style={[s.header, { paddingTop: wide ? 12 : insets.top + 4 }]}>
      <View style={s.headRow}>
        {hasChats ? (
          <Pressable accessibilityLabel={wide ? 'Toggle sidebar' : 'Notes'} onPress={() => (wide ? setSideOpen((o) => !o) : setDrawer(true))} hitSlop={10} style={({ pressed }) => [s.headBtn, pressed && { opacity: 0.4 }]}>
            {wide ? Ic.sidebar(t.label2) : Ic.menu(t.label)}
          </Pressable>
        ) : <View style={s.headBtn} />}
        <Pressable style={{ flex: 1, paddingHorizontal: 6 }} onLongPress={() => status.detail && copy(status.detail)} hitSlop={6}>
          <Text style={s.hTitle} numberOfLines={1}>{empty ? 'Aria' : (title || 'Aria')}</Text>
          <View style={s.hStatus}>
            <View style={[s.dot, { backgroundColor: ready ? t.green : status.state === 'unavailable' ? t.label3 : t.accent }]} />
            <Text style={s.hStatusTxt} numberOfLines={1}>{ready ? 'On-device · private' : status.label}</Text>
          </View>
        </Pressable>
        {hasChats && onSetChatModel ? (
          <Pressable accessibilityLabel="Choose model" onPress={() => setPickerOpen(true)} style={({ pressed }) => [s.modelChip, pressed && { opacity: 0.6 }]}>
            {Ic.chip(t.label2)}<Text style={s.modelChipTxt} numberOfLines={1}>{modelLabel}</Text>{Ic.down(t.label2)}
          </Pressable>
        ) : null}
        {hasChats ? (
          <Pressable accessibilityLabel="New chat" onPress={onNewChat} hitSlop={10} style={({ pressed }) => [s.headBtn, pressed && { opacity: 0.4 }]}>{Ic.note(t.label)}</Pressable>
        ) : <View style={s.headBtn} />}
      </View>
    </View>
  );

  const main = (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: wide ? insets.top : 0 }}>{header}</View>
      {banner ? (<View style={s.banner}><Text style={s.bannerTxt}>{banner}</Text></View>) : null}
      {busy && !empty ? (
        <View style={s.strip}>
          <ActivityIndicator size="small" color={t.accent} style={{ transform: [{ scale: 0.8 }] }} />
          <Text style={s.stripTxt}>{status.state === 'downloading' ? `${status.label}${eta ? ' · ' + eta : ''}` : status.label}</Text>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.col}>
          {setupScreen && (
            <View style={s.center}>
              <View style={s.setup}>
                {status.state === 'needs-download' && (<>
                  <Seal t={t} size={84} />
                  <Text style={s.setupTitle}>{download.title || 'Set up Aria'}</Text>
                  <Text style={s.setupBody}>{download.body}</Text>
                  <View style={s.featList}>
                    {[['Private', 'Nothing ever leaves your device'], ['Offline', 'Works with no internet after setup'], ['Grounded', 'Exact math, a built-in handbook and library']].map(([a, b]) => (
                      <View key={a} style={s.featRow}><View style={s.featDot} /><Text style={s.featTxt}><Text style={{ fontWeight: '700', color: t.label }}>{a}. </Text>{b}</Text></View>
                    ))}
                  </View>
                  <PressScale onPress={onDownload} style={s.primaryBtn}><Text style={s.primaryBtnTxt}>Download Aria</Text></PressScale>
                  <Text style={s.setupNote}>{download.sizeNote || 'One-time download · stays on your device'}</Text>
                </>)}
                {status.state === 'downloading' && (<>
                  <Ring t={t} progress={status.progress || 0} />
                  <Text style={s.setupTitle}>Downloading {status.model ? status.model.name : 'Aria'}</Text>
                  <Text style={s.setupBody}>{eta || 'Starting the download…'}</Text>
                  {status.model ? <Text style={s.setupNote}>{status.model.base} · {status.model.size}</Text> : null}
                </>)}
                {status.state === 'loading' && (<>
                  <Ring t={t} indeterminate />
                  <Text style={s.setupTitle}>Opening the notebook</Text>
                  <Text style={s.setupBody}>{status.label}</Text>
                </>)}
                {status.state === 'unavailable' && status.label === 'Could not load model' ? (<>
                  <Seal t={t} size={72} />
                  <Text style={s.setupTitle}>Couldn’t load the AI</Text>
                  <Text style={s.setupBody}>This model wouldn’t run on this device. Pick a lighter one on the Models page, or copy the details below.</Text>
                  {status.detail ? <Text style={s.diagBox} selectable>{status.detail}</Text> : null}
                  <PressScale onPress={() => setModelsOpen(true)} style={s.primaryBtn}><Text style={s.primaryBtnTxt}>Open Models</Text></PressScale>
                  <Pressable onPress={() => status.detail && copy(status.detail)} style={{ marginTop: 12 }}><Text style={[s.setupNote, { marginTop: 0, color: t.label2 }]}>Copy details</Text></Pressable>
                </>) : status.state === 'unavailable' ? (<>
                  <Seal t={t} size={72} />
                  <Text style={s.setupTitle}>Runs in the installed app</Text>
                  <Text style={s.setupBody}>Aria’s on-device AI runs in the real app. This is a preview of the interface.</Text>
                </>) : null}
              </View>
            </View>
          )}

          {ready && empty && (
            <View style={s.desk}>
              <Text style={s.greet}>How can I help?</Text>
              <Text style={s.greetSub}>Runs on this device. Nothing you ask leaves it.</Text>
              <View style={s.startList}>
                {STARTERS.map((sg, i) => (
                  <Pressable key={sg.key} onPress={() => tapStarter(sg)} style={({ pressed }) => [s.startRow, i === STARTERS.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: t.fill2 }]}>
                    <View style={s.startIcon}>{(Ic[sg.icon] || Ic.pencil)(t.label2)}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.startTitle}>{sg.title}</Text>
                      <Text style={s.startSub}>{sg.sub}</Text>
                    </View>
                    {Ic.chevron(t.label3, false)}
                  </Pressable>
                ))}
              </View>
              {recent.length ? (<>
                <Text style={s.deskSection}>Recent</Text>
                <View style={s.startList}>
                  {recent.map((c, i) => (
                    <Pressable key={c.id} onPress={() => onOpenChat && onOpenChat(c.id)} style={({ pressed }) => [s.recentRow, i === recent.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: t.fill }]}>
                      <Text style={s.recentTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={s.chatRowTime}>{timeAgo(c.updatedAt)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>) : null}
            </View>
          )}

          {!empty && <View style={{ height: 8 }} />}
          {messages.map((m, i) => (
            <Message key={i} t={t} s={s} m={m} index={i} isLast={i === lastAi} onCopy={copy} onRegenerate={onRegenerate} generating={generating} />
          ))}
        </View>
      </ScrollView>

      <View style={[s.composerWrap, { paddingBottom: insets.bottom ? insets.bottom : 12 }]}>
        <View style={s.col}>
          <View style={s.composer}>
            {attachedUri ? (
              <View style={s.attachRow}>
                <Image source={{ uri: attachedUri }} style={s.attachThumb} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={s.attachLabel}>Photo attached</Text>
                  <Text style={s.attachSub}>{status.label === 'Reading photo…' || String(status.label).startsWith('Preparing') ? status.label : 'Ask about it, or send to solve / describe'}</Text>
                </View>
                <Pressable accessibilityLabel="Remove photo" onPress={onClearImage} hitSlop={10} style={s.attachX}>{Ic.close(t.label2)}</Pressable>
              </View>
            ) : null}
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder={ready ? placeholder : 'Aria is getting ready…'}
              placeholderTextColor={t.label3}
              editable={ready && !generating}
              multiline
              onSubmitEditing={onSend}
              blurOnSubmit={false}
              onKeyPress={Platform.OS === 'web' ? (e) => { const n = e.nativeEvent || {}; if (n.key === 'Enter' && !n.shiftKey) { e.preventDefault && e.preventDefault(); onSend(); } } : undefined}
            />
            <View style={s.toolRow}>
              {onPickImage ? (
                <Pressable accessibilityLabel="Add photo or tool" onPress={() => setActionsOpen(true)} disabled={generating} hitSlop={6} style={({ pressed }) => [s.roundBtn, { opacity: generating ? 0.35 : 1 }, pressed && { backgroundColor: t.fill }]}>{Ic.plus(t.label, 20)}</Pressable>
              ) : null}
              {onPickImage ? (
                <Pressable accessibilityLabel="Take a photo" onPress={() => onPickImage('camera')} disabled={generating} hitSlop={6} style={({ pressed }) => [s.roundBtn, { opacity: generating ? 0.35 : 1 }, pressed && { backgroundColor: t.fill }]}>{Ic.camera(t.label)}</Pressable>
              ) : null}
              {hasChats ? (
                <Pressable accessibilityLabel="Deep think" onPress={() => setReasoning(deep ? 'auto' : 'deep')} style={[s.thinkChip, deep && { backgroundColor: t.irisBg, borderColor: 'transparent' }]}>
                  {Ic.brain(deep ? t.iris : t.label2)}
                  <Text style={[s.thinkTxt, deep && { color: t.iris }]}>Deep think</Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }} />
              {generating ? (
                <Pressable accessibilityLabel="Stop" onPress={onStop} style={[s.sendCircle, { backgroundColor: t.ink }]}>{Ic.stop(t.bg)}</Pressable>
              ) : (
                <Pressable accessibilityLabel="Send" onPress={onSend} disabled={!sendEnabled} style={[s.sendCircle, { backgroundColor: sendEnabled ? t.accent : t.fill }]}>{Ic.send(sendEnabled ? t.onAccent : t.label3)}</Pressable>
              )}
            </View>
          </View>
          <Text style={s.disclaimer}>On-device AI can make mistakes — check important answers.</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  const listProps = {
    t, s, chats, activeChatId, status, insets,
    onOpen: (id) => { onOpenChat && onOpenChat(id); setDrawer(false); },
    onDelete: onDeleteChat,
    onNew: () => { onNewChat && onNewChat(); setDrawer(false); },
    onSettings: () => { setDrawer(false); setSettingsOpen(true); },
    onModels: () => { setDrawer(false); setModelsOpen(true); },
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg }}>
      {showSide ? <View style={s.sidebar}><ChatList {...listProps} /></View> : null}
      <View style={{ flex: 1 }}>{main}</View>

      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <Pressable style={s.drawerBackdrop} onPress={() => setDrawer(false)}>
          <Pressable style={s.drawer} onPress={() => {}}><ChatList {...listProps} inDrawer /></Pressable>
        </Pressable>
      </Modal>

      <Settings t={t} visible={settingsOpen} onClose={() => setSettingsOpen(false)} onClearChats={onClearChats} onOpenModels={() => { setSettingsOpen(false); setModelsOpen(true); }} />
      <ModelsScreen t={t} visible={modelsOpen} onClose={() => setModelsOpen(false)} />
      {onSetChatModel ? <ModelPicker t={t} s={s} visible={pickerOpen} onClose={() => setPickerOpen(false)} chatModel={chatModel} onPick={onSetChatModel} onManage={() => setModelsOpen(true)} /> : null}

      {toast ? (
        <View style={[s.toast, { bottom: insets.bottom + 120 }]} pointerEvents="none">
          <Text style={s.toastTxt}>{toast}</Text>
        </View>
      ) : null}

      <ActionsSheet t={t} visible={actionsOpen} onClose={() => setActionsOpen(false)} onPhoto={() => onPickImage && onPickImage()} onTool={(id) => setTool(id)} onWriting={(v) => onPickExample && onPickExample(v)} />
      <ToolsHub t={t} toolId={tool} onClose={() => setTool(null)} />
    </View>
  );
}

function mdStyles(t) {
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  return {
    body: { color: t.label, fontSize: 16.5, lineHeight: 25.5 },
    paragraph: { marginTop: 0, marginBottom: 10 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { marginVertical: 2 },
    code_inline: { backgroundColor: t.fill, color: t.label, borderRadius: 5, paddingHorizontal: 5, fontFamily: mono, fontSize: 14.5 },
    fence: { backgroundColor: t.fill, color: t.label, borderRadius: 12, padding: 12, fontFamily: mono, fontSize: 13.5, borderWidth: 0 },
    code_block: { backgroundColor: t.fill, color: t.label, borderRadius: 12, padding: 12, fontFamily: mono, fontSize: 13.5 },
    blockquote: { backgroundColor: t.fill2, borderLeftColor: t.accent, borderLeftWidth: 3, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 6 },
    link: { color: t.blue },
    hr: { backgroundColor: t.sep, height: StyleSheet.hairlineWidth, marginVertical: 12 },
    heading1: { color: t.label, fontSize: 23, fontFamily: t.serif, fontWeight: '700', marginTop: 6, marginBottom: 6 },
    heading2: { color: t.label, fontSize: 20, fontFamily: t.serif, fontWeight: '700', marginTop: 8, marginBottom: 4 },
    heading3: { color: t.label, fontSize: 17.5, fontFamily: t.serif, fontWeight: '700', marginTop: 6, marginBottom: 2 },
    table: { borderColor: t.sep, borderRadius: 8 },
    th: { padding: 6, backgroundColor: t.fill },
    td: { padding: 6, borderColor: t.sep },
  };
}

function styles(t, wide) {
  const shadow = Platform.select({
    ios: { shadowColor: t.shadow, shadowOpacity: t.dark ? 0.45 : 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 5 } },
    android: { elevation: 3 },
    default: { boxShadow: t.dark ? '0 5px 20px rgba(0,0,0,0.5)' : '0 5px 20px rgba(59,42,26,0.08)' },
  });
  return StyleSheet.create({
    col: { width: '100%', maxWidth: MAX_COL, alignSelf: 'center' },
    scroll: { paddingHorizontal: wide ? 32 : 16, paddingBottom: 18, flexGrow: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 28 },

    header: { paddingHorizontal: 8, paddingBottom: 6, backgroundColor: t.bg },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    headBtn: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    hTitle: { color: t.label, fontSize: 17, fontWeight: '600' },
    hStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    hStatusTxt: { color: t.label2, fontSize: 12 },
    modelChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: t.fill2, maxWidth: 170 },
    modelChipTxt: { color: t.label, fontSize: 13.5, fontWeight: '600', flexShrink: 1 },
    banner: { backgroundColor: t.fill, paddingVertical: 7, paddingHorizontal: 16 },
    bannerTxt: { color: t.label2, fontSize: 12.5, textAlign: 'center' },
    strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 7, backgroundColor: t.fill2 },
    stripTxt: { color: t.label2, fontSize: 12.5, fontWeight: '600' },

    setup: { width: '100%', maxWidth: 440, alignItems: 'center', paddingHorizontal: 8 },
    setupTitle: { color: t.label, fontSize: 26, fontWeight: '700', marginTop: 14, marginBottom: 10, textAlign: 'center' },
    setupBody: { color: t.label2, fontSize: 15.5, lineHeight: 22, textAlign: 'center' },
    setupNote: { color: t.label3, fontSize: 12.5, marginTop: 14, fontWeight: '600', textAlign: 'center' },
    featList: { alignSelf: 'stretch', marginTop: 22, gap: 12, backgroundColor: t.card, borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sep },
    featRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    featDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.accent, marginTop: 7 },
    featTxt: { flex: 1, color: t.label2, fontSize: 14.5, lineHeight: 20 },
    diagBox: { color: t.label2, fontSize: 12, lineHeight: 17, marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: t.fill, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', alignSelf: 'stretch' },
    primaryBtn: { marginTop: 24, borderRadius: 100, paddingVertical: 15, paddingHorizontal: 40, backgroundColor: t.accent, alignSelf: 'stretch', alignItems: 'center' },
    primaryBtnTxt: { color: t.onAccent, fontSize: 16.5, fontWeight: '700' },

    desk: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
    eyebrow: { color: t.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
    greet: { color: t.label, fontSize: wide ? 30 : 26, fontWeight: '700', letterSpacing: -0.4 },
    greetSub: { color: t.label2, fontSize: 15, lineHeight: 21, marginTop: 4 },
    startList: { marginTop: 20, backgroundColor: t.fill2, borderRadius: 12, overflow: 'hidden' },
    startRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
    startIcon: { width: 26, alignItems: 'center' },
    startTitle: { color: t.label, fontSize: 16, fontWeight: '500' },
    startSub: { color: t.label2, fontSize: 13, marginTop: 1 },
    deskSection: { color: t.label2, fontSize: 13, marginTop: 24, marginBottom: 7, marginLeft: 14 },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
    recentTitle: { flex: 1, color: t.label, fontSize: 16 },

    userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginVertical: 8 },
    userBubble: { maxWidth: wide ? '72%' : '84%', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: t.bubbleUser },
    userTxt: { fontSize: 16.5, lineHeight: 23, color: t.onBubbleUser },
    aiCard: { marginVertical: 12 },
    aiHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
    aiName: { color: t.accent, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.4 },
    aiMeta: { color: t.label3, fontSize: 12, marginLeft: 8, alignSelf: 'center' },
    msgImage: { width: 220, height: 220, borderRadius: 14, marginBottom: 6 },
    sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
    srcLbl: { color: t.label3, fontSize: 12, marginRight: 2 },
    srcChip: { backgroundColor: t.fill, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 230 },
    srcTxt: { color: t.label2, fontSize: 12, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 2, marginTop: 8, marginLeft: -6 },
    actBtn: { width: 32, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

    composerWrap: { paddingHorizontal: wide ? 32 : 12, paddingTop: 8, backgroundColor: t.bg },
    composer: { backgroundColor: t.fill2, borderRadius: 20, paddingTop: 4, paddingHorizontal: 8, paddingBottom: 8 },
    input: { maxHeight: 150, minHeight: 42, color: t.label, fontSize: 16.5, lineHeight: 22, paddingHorizontal: 10, paddingTop: Platform.OS === 'ios' ? 10 : 6, paddingBottom: 6 },
    toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    roundBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    thinkChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 10, borderRadius: 16 },
    thinkTxt: { color: t.label2, fontSize: 13.5, fontWeight: '600' },
    sendCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    disclaimer: { color: t.label3, fontSize: 11, textAlign: 'center', marginTop: 7 },
    attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 4, marginBottom: 2, padding: 8, backgroundColor: t.fill2, borderRadius: 14 },
    attachThumb: { width: 44, height: 44, borderRadius: 10 },
    attachLabel: { color: t.label, fontSize: 14, fontWeight: '700' },
    attachSub: { color: t.label2, fontSize: 12, marginTop: 1 },
    attachX: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

    sidebar: { width: 300, backgroundColor: t.side, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.sep, paddingHorizontal: 12 },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 8 },
    brandTxt: { color: t.label, fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
    newChat: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    newChatTxt: { color: t.onAccent, fontSize: 15, fontWeight: '700' },
    search: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingHorizontal: 10, height: 38, borderRadius: 12, backgroundColor: t.fill2, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sep },
    searchInput: { flex: 1, color: t.label, fontSize: 14.5, paddingVertical: 0 },
    groupLbl: { color: t.label2, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 4, marginLeft: 8 },
    chatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10 },
    chatRowOn: { backgroundColor: t.dark ? '#2C2C2E' : '#E5E5EA' },
    tab: { width: 0, height: 0 },
    chatRowTitle: { color: t.label, fontSize: 15 },
    chatRowTime: { color: t.label3, fontSize: 12, marginTop: 2 },
    sideFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
    footBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10 },
    footIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    footModel: { color: t.label, fontSize: 14.5, fontWeight: '700' },
    footSub: { color: t.label2, fontSize: 12 },

    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(20,16,12,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
    sheet: { width: '100%', maxWidth: 560, backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 34, paddingTop: 8 },
    grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: t.sepStrong, alignSelf: 'center', marginBottom: 12 },
    sheetTitle: { color: t.label, fontSize: 20, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
    pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14 },
    pickTitle: { color: t.label, fontSize: 16, fontWeight: '700' },
    pickSub: { color: t.label2, fontSize: 13, marginTop: 2 },
    manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 12, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
    manageTxt: { color: t.accent, fontSize: 15.5, fontWeight: '700' },

    drawerBackdrop: { flex: 1, backgroundColor: 'rgba(20,16,12,0.4)', flexDirection: 'row' },
    drawer: { width: '84%', maxWidth: 330, backgroundColor: t.side, paddingHorizontal: 12 },

    toast: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
    toastTxt: { color: t.bg, fontSize: 14, fontWeight: '700', backgroundColor: t.ink, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, overflow: 'hidden' },
  });
}
