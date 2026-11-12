import { useRef, useEffect, useState, memo } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet, Share,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';
import Markdown from 'react-native-markdown-display';
import { ActionsSheet, ToolsHub } from './tools';
import Settings from './settings';
import { usePrefs, setReasoning } from './prefs';

/* ── marks & icons ─────────────────────────────────────────────────────── */
const SPARK = 'M12 1.6C12.95 7.6 16.4 11.05 22.4 12C16.4 12.95 12.95 16.4 12 22.4C11.05 16.4 7.6 12.95 1.6 12C7.6 11.05 11.05 7.6 12 1.6Z';
export const AriaMark = ({ size = 22, c = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={SPARK} fill={c} /></Svg>
);
// Hero mark: the spark with a soft glow, matching the app icon.
function HeroMark({ t, size = 92 }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={t.dark ? '#FFFFFF' : '#5856D6'} stopOpacity={t.dark ? 0.22 : 0.16} />
            <Stop offset="1" stopColor={t.dark ? '#FFFFFF' : '#5856D6'} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.dark ? '#2A2A2E' : '#2C2C30'} />
            <Stop offset="1" stopColor={t.dark ? '#0E0E10' : '#0B0B0D'} />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#glow)" />
        <Rect x="24" y="24" width="52" height="52" rx="15" fill="url(#tile)" />
        <Path d={SPARK} fill="#FFFFFF" transform="translate(35 35) scale(1.25)" />
      </Svg>
    </View>
  );
}
const Ic = {
  send: (c) => <Svg width={18} height={18} viewBox="0 0 20 20"><Path d="M10 15.5V5M10 5l-4.5 4.5M10 5l4.5 4.5" fill="none" stroke={c} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  stop: (c) => <Svg width={14} height={14} viewBox="0 0 16 16"><Rect x="3.5" y="3.5" width="9" height="9" rx="2" fill={c} /></Svg>,
  plus: (c, s = 22) => <Svg width={s} height={s} viewBox="0 0 24 24"><Path d="M12 5.5v13M5.5 12h13" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>,
  menu: (c) => <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M4 7.5h16M4 12h11M4 16.5h16" stroke={c} strokeWidth={1.9} strokeLinecap="round" /></Svg>,
  compose: (c) => <Svg width={21} height={21} viewBox="0 0 24 24"><Path d="M16.5 4.5l3 3L9 18l-3.8.8L6 15 16.5 4.5Z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" /><Path d="M4 20.5h16" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></Svg>,
  trash: (c) => <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  pencil: (c) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M15.5 5l3.5 3.5L10 17.5 6 18.5 7 14.5 15.5 5Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /></Svg>,
  bulb: (c) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M9 17h6M10 20.5h4M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1.1-.9 1.8H9.3c0-.7-.3-1.3-.9-1.8A6 6 0 0 1 12 3Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" /></Svg>,
  camera: (c, s = 20) => <Svg width={s} height={s} viewBox="0 0 24 24"><Path d="M4 7h3l1.3-2h7.4L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /><Circle cx={12} cy={13} r={3.3} fill="none" stroke={c} strokeWidth={1.7} /></Svg>,
  scan: (c) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" /><Path d="M8 10h8M8 13h8M8 16h5" stroke={c} strokeWidth={1.7} strokeLinecap="round" /></Svg>,
  sigma: (c) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M17 5H7l6 7-6 7h10" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  book: (c, s = 20) => <Svg width={s} height={s} viewBox="0 0 24 24"><Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /></Svg>,
  close: (c) => <Svg width={14} height={14} viewBox="0 0 16 16"><Path d="M4 4l8 8M12 4l-8 8" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></Svg>,
  chevron: (c, open) => <Svg width={12} height={12} viewBox="0 0 12 12"><Path d={open ? 'M2.5 4.5l3.5 3.5 3.5-3.5' : 'M4.5 2.5l3.5 3.5-3.5 3.5'} fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  gear: (c) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M4 8h9M19 8h1M4 16h1M11 16h9" stroke={c} strokeWidth={1.8} strokeLinecap="round" /><Circle cx={15} cy={8} r={2.4} fill="none" stroke={c} strokeWidth={1.8} /><Circle cx={7} cy={16} r={2.4} fill="none" stroke={c} strokeWidth={1.8} /></Svg>,
  copy: (c) => <Svg width={16} height={16} viewBox="0 0 24 24"><Rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke={c} strokeWidth={1.8} /><Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke={c} strokeWidth={1.8} /></Svg>,
  retry: (c) => <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  share: (c) => <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>,
  brain: (c) => <Svg width={15} height={15} viewBox="0 0 24 24"><Path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4H9ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4h1Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /></Svg>,
  search: (c) => <Svg width={15} height={15} viewBox="0 0 24 24"><Circle cx={11} cy={11} r={6.5} fill="none" stroke={c} strokeWidth={1.9} /><Path d="M16 16l4 4" stroke={c} strokeWidth={1.9} strokeLinecap="round" /></Svg>,
  sidebar: (c) => <Svg width={21} height={21} viewBox="0 0 24 24"><Rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke={c} strokeWidth={1.8} /><Path d="M9.5 4.5v15" stroke={c} strokeWidth={1.8} /></Svg>,
};

const MAX_COL = 760;

/* ── small pieces ──────────────────────────────────────────────────────── */
function PressScale({ style, children, onPress, onLongPress, disabled, hitSlop }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x) => Animated.spring(v, { toValue: x, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 0 }).start();
  // Layout keys (width, alignSelf, margins) belong on the outer Pressable so
  // percentage widths resolve against the real parent.
  const flat = StyleSheet.flatten(style) || {};
  const { width, minWidth, maxWidth, alignSelf, flex, margin, marginTop, marginBottom, marginHorizontal, marginVertical, ...inner } = flat;
  const outer = { width, minWidth, maxWidth, alignSelf, flex, margin, marginTop, marginBottom, marginHorizontal, marginVertical };
  Object.keys(outer).forEach((k) => outer[k] === undefined && delete outer[k]);
  return (
    <Pressable style={outer} onPress={onPress} onLongPress={onLongPress} disabled={disabled} hitSlop={hitSlop} onPressIn={() => to(0.97)} onPressOut={() => to(1)}>
      <Animated.View style={[inner, { flexGrow: 1, transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function ThoughtBlock({ t, think, live }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!!live); }, [live]);
  const words = think ? think.split(/\s+/).length : 0;
  return (
    <View style={{ marginBottom: 10, alignSelf: 'flex-start', maxWidth: '100%' }}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: t.irisBg, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 100, alignSelf: 'flex-start' }}>
        {live ? <ActivityIndicator size="small" color={t.iris} style={{ transform: [{ scale: 0.75 }] }} /> : Ic.brain(t.iris)}
        <Text style={{ color: t.iris, fontSize: 13, fontWeight: '600' }}>{live ? 'Thinking…' : `Thought for ${words} words`}</Text>
        {!live ? Ic.chevron(t.iris, open) : null}
      </Pressable>
      {open && think ? (
        <View style={{ borderLeftWidth: 2, borderLeftColor: t.irisBg, paddingLeft: 12, marginTop: 8, marginLeft: 6 }}>
          <Text style={{ color: t.label2, fontSize: 13.5, lineHeight: 20 }}>{think}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TypingDots({ t }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    l.start(); return () => l.stop();
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 8 }}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.label3,
          opacity: a.interpolate({ inputRange: [0, (i + 0.5) / 4, (i + 1.5) / 4, 1], outputRange: [0.3, 1, 0.3, 0.3], extrapolate: 'clamp' }) }} />
      ))}
    </View>
  );
}

function Ring({ t, progress, indeterminate, size = 128, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!indeterminate) return;
    const anim = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
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
        {indeterminate ? <AriaMark size={30} c={t.label} />
          : <Text style={{ color: t.label, fontSize: 28, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>{Math.round((progress || 0) * 100)}%</Text>}
      </View>
    </View>
  );
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - (ts || 0)) / 1000);
  if (s < 60) return 'just now';
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
  return h < 5 ? 'Up late?' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const DEFAULT_SUGGESTIONS = [
  { key: 'worksheet', title: 'Solve a worksheet', sub: 'Snap it — get every answer', icon: 'scan', kind: 'photo', mode: 'camera' },
  { key: 'explain', title: 'Explain anything', sub: 'Science, history, how things work', icon: 'bulb', kind: 'text', value: 'Explain ' },
  { key: 'math', title: 'Exact math', sub: 'Calculations that are always right', icon: 'sigma', kind: 'text', value: 'What is ' },
  { key: 'write', title: 'Help me write', sub: 'Emails, essays, messages', icon: 'pencil', kind: 'text', value: 'Help me write ' },
];

/* ── message ───────────────────────────────────────────────────────────── */
const Message = memo(function Message({ t, s, m, isLast, onCopy, onRegenerate, index, generating, wide }) {
  if (m.role === 'user') {
    return (
      <Pressable onLongPress={() => m.text && onCopy(m.text)} style={s.userRow}>
        <View style={[s.userBubble, wide && { maxWidth: '72%' }]}>
          {m.imageUri ? <Image source={{ uri: m.imageUri }} style={s.msgImage} resizeMode="cover" /> : null}
          {m.text ? <Text style={s.userTxt} selectable>{m.text}</Text> : null}
        </View>
      </Pressable>
    );
  }
  const done = !m.streaming;
  return (
    <View style={s.aiRow}>
      <View style={s.aiHead}>
        <View style={s.aiAvatar}><AriaMark size={12} c={t.onAccent} /></View>
        <Text style={s.aiName}>Aria</Text>
        {done && m.model ? <Text style={s.aiMeta}>· {m.model}{m.secs ? ` · ${m.secs}s` : ''}</Text> : null}
      </View>
      <View style={s.aiBody}>
        {m.think ? <ThoughtBlock t={t} think={m.think} live={!!m.streaming && !m.text} /> : null}
        {m.text ? <Markdown style={mdStyles(t)}>{m.text}</Markdown> : null}
        {m.streaming && !m.think && !m.text ? <TypingDots t={t} /> : null}
        {done && m.sources && m.sources.length ? (
          <View style={s.sources}>
            {Ic.book(t.label3, 13)}
            {m.sources.map((src) => <View key={src} style={s.srcChip}><Text style={s.srcTxt} numberOfLines={1}>{src}</Text></View>)}
          </View>
        ) : null}
        {done && m.text ? (
          <View style={s.actions}>
            <Pressable hitSlop={8} accessibilityLabel="Copy answer" onPress={() => onCopy(m.text)} style={({ pressed }) => [s.actBtn, pressed && { backgroundColor: t.fill }]}>{Ic.copy(t.label3)}</Pressable>
            {isLast && onRegenerate && !generating ? <Pressable hitSlop={8} accessibilityLabel="Regenerate answer" onPress={() => onRegenerate(index)} style={({ pressed }) => [s.actBtn, pressed && { backgroundColor: t.fill }]}>{Ic.retry(t.label3)}</Pressable> : null}
            <Pressable hitSlop={8} accessibilityLabel="Share answer" onPress={() => Share.share({ message: m.text }).catch(() => {})} style={({ pressed }) => [s.actBtn, pressed && { backgroundColor: t.fill }]}>{Ic.share(t.label3)}</Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
});

/* ── sidebar (iPad) / drawer (phone) ───────────────────────────────────── */
function ChatList({ t, s, chats, activeChatId, onOpen, onDelete, onNew, onSettings, status, insets, inDrawer }) {
  const [q, setQ] = useState('');
  const list = (chats || []).filter((c) => !q || (c.title || '').toLowerCase().includes(q.toLowerCase()));
  const today = list.filter((c) => Date.now() - (c.updatedAt || 0) < 86400000);
  const older = list.filter((c) => Date.now() - (c.updatedAt || 0) >= 86400000);
  const ready = status && status.state === 'ready';
  const Row = (c) => (
    <Pressable key={c.id} onPress={() => onOpen(c.id)} style={({ pressed }) => [s.chatRow, c.id === activeChatId && { backgroundColor: t.fill }, pressed && { opacity: 0.6 }]}>
      <Text style={[s.chatRowTitle, c.id === activeChatId && { fontWeight: '600' }]} numberOfLines={1}>{c.title || 'New chat'}</Text>
      <Text style={s.chatRowTime}>{timeAgo(c.updatedAt)}</Text>
      <Pressable accessibilityLabel="Delete chat" onPress={() => onDelete(c.id)} hitSlop={8} style={{ padding: 4 }}>{Ic.trash(t.label3)}</Pressable>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, paddingTop: insets.top + (inDrawer ? 14 : 10) }}>
      <View style={s.brandRow}>
        <View style={s.brandMark}><AriaMark size={14} c={t.onAccent} /></View>
        <Text style={s.brandTxt}>Aria</Text>
      </View>
      <PressScale onPress={onNew} style={s.newChat}>
        {Ic.compose(t.label)}<Text style={s.newChatTxt}>New chat</Text>
      </PressScale>
      <View style={s.search}>
        {Ic.search(t.label3)}
        <TextInput value={q} onChangeText={setQ} placeholder="Search chats" placeholderTextColor={t.label3} style={s.searchInput} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
        {today.length ? <Text style={s.groupLbl}>Today</Text> : null}
        {today.map(Row)}
        {older.length ? <Text style={s.groupLbl}>Earlier</Text> : null}
        {older.map(Row)}
        {!list.length ? <Text style={[s.groupLbl, { textTransform: 'none' }]}>{q ? 'No matches' : 'No chats yet'}</Text> : null}
      </ScrollView>
      <Pressable accessibilityLabel="Settings" onPress={onSettings} style={({ pressed }) => [s.sideFoot, { paddingBottom: insets.bottom + 12 }, pressed && { opacity: 0.6 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.footModel} numberOfLines={1}>{status && status.model ? status.model.name : 'Aria'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[s.dot, { backgroundColor: ready ? t.green : t.label3 }]} />
            <Text style={s.footSub} numberOfLines={1}>{ready ? 'On-device · private' : (status && status.label) || ''}</Text>
          </View>
        </View>
        {Ic.gear(t.label2)}
      </Pressable>
    </View>
  );
}

/* ── main ──────────────────────────────────────────────────────────────── */
export default function ChatUI({
  t, messages, input, setInput, onSend, onStop, onRegenerate, generating,
  status, onDownload, banner,
  onPickImage, attachedUri, onClearImage, canSend,
  title, chats, activeChatId, onNewChat, onOpenChat, onDeleteChat,
  onPickExample, suggestions = DEFAULT_SUGGESTIONS, onClearChats,
  placeholder = 'Ask Aria anything', download = {},
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
    if (status.state === 'ready' && (was === 'downloading')) flash('Aria is ready');
  }, [status.state]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages, generating, attachedUri]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1800); };
  const copy = (text) => { try { const C = require('expo-clipboard'); C.setStringAsync(text); flash('Copied'); } catch (e) {} };
  const tapSuggestion = (sg) => {
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

  const header = (
    <View style={[s.header, { paddingTop: (wide ? 10 : insets.top + 4) }]}>
      <View style={s.headRow}>
        {hasChats ? (
          <Pressable accessibilityLabel={wide ? "Toggle sidebar" : "Chats"} onPress={() => (wide ? setSideOpen((o) => !o) : setDrawer(true))} hitSlop={10} style={({ pressed }) => [s.headBtn, pressed && { opacity: 0.4 }]}>
            {wide ? Ic.sidebar(t.label2) : Ic.menu(t.label)}
          </Pressable>
        ) : <View style={s.headBtn} />}
        <Pressable style={{ flex: 1, alignItems: wide ? 'flex-start' : 'center', paddingHorizontal: 6 }} onLongPress={() => status.detail && copy(status.detail)} hitSlop={6}>
          <Text style={s.hTitle} numberOfLines={1}>{empty ? (status.model ? status.model.name : 'Aria') : (title || 'Aria')}</Text>
          <View style={s.hStatus}>
            <View style={[s.dot, { backgroundColor: ready ? t.green : status.state === 'unavailable' ? t.label3 : t.label2 }]} />
            <Text style={s.hStatusTxt} numberOfLines={1}>{status.label}</Text>
          </View>
        </Pressable>
        {hasChats ? (
          <Pressable accessibilityLabel="New chat" onPress={onNewChat} hitSlop={10} style={({ pressed }) => [s.headBtn, pressed && { opacity: 0.4 }]}>{Ic.compose(t.label)}</Pressable>
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
          <ActivityIndicator size="small" color={t.label2} style={{ transform: [{ scale: 0.8 }] }} />
          <Text style={s.stripTxt}>{status.state === 'downloading' ? `${status.label}${eta ? ' · ' + eta : ''}` : 'Refreshing Aria’s memory…'}</Text>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.col}>
          {setupScreen && (
            <View style={s.center}>
              <View style={s.setup}>
                {status.state === 'needs-download' && (<>
                  <HeroMark t={t} size={104} />
                  <Text style={s.setupTitle}>{download.title || 'Set up Aria'}</Text>
                  <Text style={s.setupBody}>{download.body}</Text>
                  <View style={s.featList}>
                    {[['Private', 'Nothing ever leaves your device'], ['Offline', 'Works with no internet after setup'], ['Smart', 'Exact math, a built-in library, reads photos']].map(([a, b]) => (
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
                  <Text style={s.setupNote}>Keep Aria open. After this it works offline.</Text>
                </>)}
                {status.state === 'loading' && (<>
                  <Ring t={t} indeterminate />
                  <Text style={s.setupTitle}>Waking Aria up</Text>
                  <Text style={s.setupBody}>Loading {status.model ? status.model.name : 'the model'} into memory. This takes a few seconds.</Text>
                </>)}
                {status.state === 'unavailable' && status.label === 'Could not load model' ? (<>
                  <HeroMark t={t} size={84} />
                  <Text style={s.setupTitle}>Couldn’t load the AI</Text>
                  <Text style={s.setupBody}>This model wouldn’t run on this device. Pick a lighter one in Settings → Model, or copy the details below.</Text>
                  {status.detail ? <Text style={s.diagBox} selectable>{status.detail}</Text> : null}
                  <PressScale onPress={() => setSettingsOpen(true)} style={s.primaryBtn}><Text style={s.primaryBtnTxt}>Open Settings</Text></PressScale>
                  <Pressable onPress={() => status.detail && copy(status.detail)} style={{ marginTop: 12 }}><Text style={[s.setupNote, { marginTop: 0, color: t.label2 }]}>Copy details</Text></Pressable>
                </>) : status.state === 'unavailable' ? (<>
                  <HeroMark t={t} size={84} />
                  <Text style={s.setupTitle}>Runs in the installed app</Text>
                  <Text style={s.setupBody}>Aria’s on-device AI runs in the real app. This is a preview of the interface.</Text>
                </>) : null}
              </View>
            </View>
          )}

          {ready && empty && (
            <View style={s.center}>
              <HeroMark t={t} />
              <Text style={s.greet}>{greeting()}</Text>
              <Text style={s.greetSub}>Ask anything. Aria thinks right on this device — private, and it works offline.</Text>
              <View style={s.pills}>
                {[['sigma', 'Exact math'], ['book', 'Offline library'], ['scan', 'Reads worksheets']].map(([ic, lbl]) => (
                  <View key={lbl} style={s.pill}>{Ic[ic](t.label2, 14)}<Text style={s.pillTxt}>{lbl}</Text></View>
                ))}
              </View>
              <View style={s.sgGrid}>
                {suggestions.map((sg) => (
                  <PressScale key={sg.key} onPress={() => tapSuggestion(sg)} style={s.sgCard}>
                    <View style={s.sgIcon}>{(Ic[sg.icon] || Ic.pencil)(t.label)}</View>
                    <Text style={s.sgTitle}>{sg.title}</Text>
                    <Text style={s.sgSub} numberOfLines={2}>{sg.sub}</Text>
                  </PressScale>
                ))}
              </View>
            </View>
          )}

          {!empty && <View style={{ height: 6 }} />}
          {messages.map((m, i) => (
            <Message key={i} t={t} s={s} m={m} index={i} isLast={i === lastAi} onCopy={copy} onRegenerate={onRegenerate} generating={generating} wide={wide} />
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
                  <Text style={s.attachSub}>{status.label === 'Reading photo…' || status.label.startsWith('Preparing') ? status.label : 'Ask about it, or send to solve / describe'}</Text>
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
                <Pressable accessibilityLabel="Add photo or tool" onPress={() => setActionsOpen(true)} disabled={generating} hitSlop={6} style={({ pressed }) => [s.roundBtn, { opacity: generating ? 0.35 : 1 }, pressed && { backgroundColor: t.fill2 }]}>{Ic.plus(t.label, 21)}</Pressable>
              ) : null}
              {onPickImage ? (
                <Pressable accessibilityLabel="Take a photo" onPress={() => onPickImage('camera')} disabled={generating} hitSlop={6} style={({ pressed }) => [s.roundBtn, { opacity: generating ? 0.35 : 1 }, pressed && { backgroundColor: t.fill2 }]}>{Ic.camera(t.label, 19)}</Pressable>
              ) : null}
              {hasChats ? (
                <Pressable onPress={() => setReasoning(deep ? 'auto' : 'deep')} style={[s.thinkChip, deep && { backgroundColor: t.irisBg, borderColor: 'transparent' }]}>
                  {Ic.brain(deep ? t.iris : t.label2)}
                  <Text style={[s.thinkTxt, deep && { color: t.iris }]}>Think harder</Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }} />
              {generating ? (
                <Pressable accessibilityLabel="Stop" onPress={onStop} style={[s.sendCircle, { backgroundColor: t.accent }]}>{Ic.stop(t.onAccent)}</Pressable>
              ) : (
                <Pressable accessibilityLabel="Send" onPress={onSend} disabled={!sendEnabled} style={[s.sendCircle, { backgroundColor: sendEnabled ? t.accent : t.fill2 }]}>{Ic.send(sendEnabled ? t.onAccent : t.label3)}</Pressable>
              )}
            </View>
          </View>
          <Text style={s.disclaimer}>On-device AI can make mistakes. Check important answers.</Text>
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

      <Settings t={t} visible={settingsOpen} onClose={() => setSettingsOpen(false)} onClearChats={onClearChats} />

      {toast ? (
        <View style={[s.toast, { bottom: insets.bottom + 120 }]} pointerEvents="none">
          {toast === 'Aria is ready' ? <View style={s.readyDot} /> : null}
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
    body: { color: t.label, fontSize: 16.5, lineHeight: 25 },
    paragraph: { marginTop: 0, marginBottom: 10 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { marginVertical: 2 },
    code_inline: { backgroundColor: t.fill, color: t.label, borderRadius: 5, paddingHorizontal: 5, fontFamily: mono, fontSize: 14.5 },
    fence: { backgroundColor: t.fill, color: t.label, borderRadius: 12, padding: 12, fontFamily: mono, fontSize: 13.5, borderWidth: 0 },
    code_block: { backgroundColor: t.fill, color: t.label, borderRadius: 12, padding: 12, fontFamily: mono, fontSize: 13.5 },
    blockquote: { backgroundColor: t.fill2, borderLeftColor: t.sepStrong, borderLeftWidth: 3, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 6 },
    link: { color: t.blue },
    hr: { backgroundColor: t.sep, height: StyleSheet.hairlineWidth, marginVertical: 12 },
    heading1: { color: t.label, fontSize: 22, fontWeight: '700', marginTop: 6, marginBottom: 6, letterSpacing: -0.4 },
    heading2: { color: t.label, fontSize: 19, fontWeight: '700', marginTop: 6, marginBottom: 4, letterSpacing: -0.3 },
    heading3: { color: t.label, fontSize: 17, fontWeight: '700', marginTop: 4, marginBottom: 2 },
    table: { borderColor: t.sep, borderRadius: 8 },
    th: { padding: 6, backgroundColor: t.fill },
    td: { padding: 6, borderColor: t.sep },
  };
}

function styles(t, wide) {
  const shadow = Platform.select({
    ios: { shadowColor: t.shadow, shadowOpacity: t.dark ? 0.5 : 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 4 },
    default: { boxShadow: t.dark ? '0 6px 24px rgba(0,0,0,0.6)' : '0 6px 24px rgba(0,0,0,0.08)' },
  });
  return StyleSheet.create({
    col: { width: '100%', maxWidth: MAX_COL, alignSelf: 'center' },
    scroll: { paddingHorizontal: wide ? 32 : 18, paddingBottom: 18, flexGrow: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 28 },

    header: { paddingHorizontal: 8, paddingBottom: 8, backgroundColor: t.bg },
    headRow: { flexDirection: 'row', alignItems: 'center' },
    headBtn: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    hTitle: { color: t.label, fontSize: 16, fontWeight: '600', letterSpacing: -0.2, maxWidth: '92%' },
    hStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    hStatusTxt: { color: t.label2, fontSize: 12, letterSpacing: 0.1 },
    banner: { backgroundColor: t.fill, paddingVertical: 7, paddingHorizontal: 16 },
    bannerTxt: { color: t.label2, fontSize: 12.5, textAlign: 'center' },
    strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 7, backgroundColor: t.fill2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
    stripTxt: { color: t.label2, fontSize: 12.5, fontWeight: '500' },

    setup: { width: '100%', maxWidth: 440, alignItems: 'center', paddingHorizontal: 8 },
    setupTitle: { color: t.label, fontSize: 26, fontWeight: '700', marginTop: 8, marginBottom: 10, letterSpacing: -0.6, textAlign: 'center' },
    setupBody: { color: t.label2, fontSize: 15.5, lineHeight: 22, textAlign: 'center' },
    setupNote: { color: t.label3, fontSize: 12.5, marginTop: 14, fontWeight: '500', textAlign: 'center' },
    featList: { alignSelf: 'stretch', marginTop: 22, gap: 12, backgroundColor: t.fill2, borderRadius: 18, padding: 16 },
    featRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    featDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.green, marginTop: 7 },
    featTxt: { flex: 1, color: t.label2, fontSize: 14.5, lineHeight: 20 },
    diagBox: { color: t.label2, fontSize: 12, lineHeight: 17, marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: t.fill, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', alignSelf: 'stretch' },
    primaryBtn: { marginTop: 24, borderRadius: 100, paddingVertical: 15, paddingHorizontal: 40, backgroundColor: t.accent, alignSelf: 'stretch', alignItems: 'center' },
    primaryBtnTxt: { color: t.onAccent, fontSize: 16.5, fontWeight: '600', letterSpacing: -0.2 },

    greet: { color: t.label, fontSize: wide ? 38 : 32, fontWeight: '700', textAlign: 'center', letterSpacing: -1, marginTop: 10 },
    greetSub: { color: t.label2, fontSize: 15.5, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 420 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sepStrong },
    pillTxt: { color: t.label2, fontSize: 12.5, fontWeight: '600' },
    sgGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 28, rowGap: 12, alignSelf: 'stretch' },
    sgCard: { width: wide ? '23.8%' : '48.5%', minHeight: 128, backgroundColor: t.card, borderRadius: 20, padding: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sep, ...shadow },
    sgIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
    sgTitle: { color: t.label, fontSize: 15, fontWeight: '600', marginTop: 14, letterSpacing: -0.2 },
    sgSub: { color: t.label2, fontSize: 12.5, marginTop: 3, lineHeight: 17 },

    userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginVertical: 8 },
    userBubble: { maxWidth: '84%', borderRadius: 22, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: t.bubbleUser },
    userTxt: { fontSize: 16.5, lineHeight: 23, color: t.onBubbleUser },
    aiRow: { marginVertical: 12 },
    aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    aiAvatar: { width: 24, height: 24, borderRadius: 8, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' },
    aiName: { color: t.label, fontSize: 14, fontWeight: '600' },
    aiMeta: { color: t.label3, fontSize: 12.5 },
    aiBody: { paddingLeft: wide ? 32 : 0 },
    msgImage: { width: 220, height: 220, borderRadius: 16, marginBottom: 6 },
    sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 2 },
    srcChip: { backgroundColor: t.fill, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 220 },
    srcTxt: { color: t.label2, fontSize: 12, fontWeight: '500' },
    actions: { flexDirection: 'row', gap: 2, marginTop: 6, marginLeft: -6 },
    actBtn: { width: 32, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

    composerWrap: { paddingHorizontal: wide ? 32 : 12, paddingTop: 6, backgroundColor: t.bg },
    composer: { backgroundColor: t.raised, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sepStrong, paddingTop: 6, paddingHorizontal: 8, paddingBottom: 8, ...shadow },
    input: { maxHeight: 150, minHeight: 40, color: t.label, fontSize: 16.5, lineHeight: 22, paddingHorizontal: 10, paddingTop: Platform.OS === 'ios' ? 10 : 6, paddingBottom: 6 },
    toolRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    roundBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: t.sepStrong },
    thinkChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sepStrong, marginLeft: 2 },
    thinkTxt: { color: t.label2, fontSize: 13.5, fontWeight: '600' },
    sendCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    disclaimer: { color: t.label3, fontSize: 11, textAlign: 'center', marginTop: 7 },
    attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 4, marginBottom: 2, padding: 8, backgroundColor: t.fill, borderRadius: 16 },
    attachThumb: { width: 44, height: 44, borderRadius: 10 },
    attachLabel: { color: t.label, fontSize: 14, fontWeight: '600' },
    attachSub: { color: t.label2, fontSize: 12, marginTop: 1 },
    attachX: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

    sidebar: { width: 300, backgroundColor: t.side, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.sep, paddingHorizontal: 12 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, paddingVertical: 10 },
    brandMark: { width: 28, height: 28, borderRadius: 9, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' },
    brandTxt: { color: t.label, fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
    newChat: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, backgroundColor: t.card, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sep, marginTop: 6 },
    newChatTxt: { color: t.label, fontSize: 15, fontWeight: '600' },
    search: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingHorizontal: 10, height: 38, borderRadius: 12, backgroundColor: t.fill },
    searchInput: { flex: 1, color: t.label, fontSize: 14.5, paddingVertical: 0 },
    groupLbl: { color: t.label3, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 6, marginLeft: 10 },
    chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingLeft: 12, paddingRight: 6, borderRadius: 11 },
    chatRowTitle: { flex: 1, color: t.label, fontSize: 14.5, letterSpacing: -0.1 },
    chatRowTime: { color: t.label3, fontSize: 12 },
    sideFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
    footModel: { color: t.label, fontSize: 14.5, fontWeight: '600' },
    footSub: { color: t.label2, fontSize: 12 },

    drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', flexDirection: 'row' },
    drawer: { width: '84%', maxWidth: 330, backgroundColor: t.side, paddingHorizontal: 12 },

    toast: { position: 'absolute', alignSelf: 'center', left: 0, right: 0, marginHorizontal: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    toastTxt: { color: '#fff', fontSize: 14, fontWeight: '600', backgroundColor: t.dark ? '#2C2C2E' : '#1D1D1F', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, overflow: 'hidden' },
    readyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.green },
  });
}
