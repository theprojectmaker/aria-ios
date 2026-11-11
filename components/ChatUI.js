import { useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import Markdown from 'react-native-markdown-display';
import { ActionsSheet, ToolsHub } from './tools';
import Settings from './settings';

/* ── icons ─────────────────────────────────────────────────────────── */
export const AriaMark = ({ size = 22, c = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 6.4 L7.3 17.9 M12 6.4 L16.7 17.9 M8.73 14.4 L15.27 14.4" fill="none" stroke={c} strokeWidth={2.35} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const SendArrow = ({ c }) => <Svg width={19} height={19} viewBox="0 0 20 20"><Path d="M10 15.5V5.5M10 5.5l-4.5 4.5M10 5.5l4.5 4.5" fill="none" stroke={c} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
const StopDot = ({ c }) => <Svg width={15} height={15} viewBox="0 0 16 16"><Path d="M4.5 4.5h7v7h-7z" rx={1.6} fill={c} /></Svg>;
const PlusIcon = ({ c, s = 22 }) => <Svg width={s} height={s} viewBox="0 0 24 24"><Path d="M12 5.5v13M5.5 12h13" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>;
const MenuIcon = ({ c }) => <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M4 7h16M4 12h16M4 17h16" stroke={c} strokeWidth={1.9} strokeLinecap="round" /></Svg>;
const ComposeIcon = ({ c }) => <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M16.5 4.5l3 3L9 18l-3.8.8L6 15 16.5 4.5Z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" /><Path d="M4 20.5h16" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
const TrashIcon = ({ c }) => <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
const PencilSq = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M15.5 5l3.5 3.5L10 17.5 6 18.5 7 14.5 15.5 5Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /></Svg>;
const BulbIcon = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M9 17h6M10 20.5h4M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1.1-.9 1.8H9.3c0-.7-.3-1.3-.9-1.8A6 6 0 0 1 12 3Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" /></Svg>;
const CamIcon = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M4 7h3l1.3-2h7.4L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /><Circle cx={12} cy={13} r={3.3} fill="none" stroke={c} strokeWidth={1.7} /></Svg>;
const TextScanIcon = ({ c }) => <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" /><Path d="M8 10h8M8 13h8M8 16h5" stroke={c} strokeWidth={1.7} strokeLinecap="round" /></Svg>;
const CloseX = ({ c }) => <Svg width={15} height={15} viewBox="0 0 16 16"><Path d="M4 4l8 8M12 4l-8 8" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
const Chevron = ({ c, open }) => <Svg width={12} height={12} viewBox="0 0 12 12"><Path d={open ? 'M2.5 4.5l3.5 3.5 3.5-3.5' : 'M4.5 2.5l3.5 3.5-3.5 3.5'} fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
const SlidersIcon = ({ c }) => <Svg width={21} height={21} viewBox="0 0 24 24"><Path d="M4 8h9M19 8h1M4 16h1M11 16h9" stroke={c} strokeWidth={1.8} strokeLinecap="round" /><Circle cx={15} cy={8} r={2.4} fill="none" stroke={c} strokeWidth={1.8} /><Circle cx={7} cy={16} r={2.4} fill="none" stroke={c} strokeWidth={1.8} /></Svg>;

// Collapsible reasoning: shows live while the model thinks, collapses to a
// "Show thinking" toggle once the answer arrives.
function ThoughtBlock({ t, think, live }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!!live); }, [live]);
  const s = thoughtStyles(t);
  return (
    <View style={s.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={s.head}>
        {live ? <ActivityIndicator size="small" color={t.label3} /> : <Chevron c={t.label2} open={open} />}
        <Text style={s.headTxt}>{live ? 'Thinking…' : (open ? 'Hide thinking' : 'Show thinking')}</Text>
      </Pressable>
      {open && think ? <Text style={s.body}>{think}</Text> : null}
    </View>
  );
}
function thoughtStyles(t) {
  return StyleSheet.create({
    wrap: { borderLeftWidth: 2, borderLeftColor: t.sep, paddingLeft: 11, marginBottom: 8 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 2 },
    headTxt: { color: t.label2, fontSize: 13, fontWeight: '600' },
    body: { color: t.label2, fontSize: 13.5, lineHeight: 20, marginTop: 6, fontStyle: 'italic' },
  });
}

const ICONS = { pencil: PencilSq, bulb: BulbIcon, camera: CamIcon, textscan: TextScanIcon };

const DEFAULT_SUGGESTIONS = [
  { key: 'write', title: 'Help me write', sub: 'a note, email or draft', icon: 'pencil', kind: 'text', value: 'Help me write ' },
  { key: 'explain', title: 'Explain a topic', sub: 'simply and clearly', icon: 'bulb', kind: 'text', value: 'Explain ' },
  { key: 'worksheet', title: 'Solve a worksheet', sub: 'snap it, get answers', icon: 'textscan', kind: 'photo' },
  { key: 'identify', title: 'Identify a photo', sub: 'see what’s in it', icon: 'camera', kind: 'photo' },
];

function timeAgo(ts) {
  const s = Math.round((Date.now() - (ts || 0)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

function fmtEta(sec) {
  if (!isFinite(sec) || sec <= 0) return '';
  if (sec < 8) return 'a few seconds left';
  if (sec < 90) return `about ${Math.round(sec / 5) * 5}s left`;
  const m = Math.round(sec / 60);
  return `about ${m} min left`;
}
function fmtElapsed(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Circular progress ring — shows % while downloading, spins while loading.
function Ring({ t, progress, indeterminate, size = 136, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!indeterminate) return;
    const anim = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [indeterminate]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pct = indeterminate ? 0.28 : Math.max(0.02, Math.min(1, progress || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
      <Animated.View style={indeterminate ? { transform: [{ rotate }] } : null}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.fill} strokeWidth={stroke} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.accent} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
      </Animated.View>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {indeterminate
          ? <AriaMark size={34} c={t.label} />
          : <Text style={{ color: t.label, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 }}>{Math.round((progress || 0) * 100)}%</Text>}
      </View>
    </View>
  );
}

export default function ChatUI({
  t, messages, input, setInput, onSend, onStop, generating,
  status, onDownload, banner,
  onPickImage, attachedUri, onClearImage, canSend,
  title, chats, activeChatId, onNewChat, onOpenChat, onDeleteChat,
  onPickExample, suggestions = DEFAULT_SUGGESTIONS, onClearChats,
  greetTitle = 'Aria', greetSub = 'Your private AI — it runs entirely on your phone.',
  placeholder = 'Message Aria', download = {},
}) {
  const insets = useSafeAreaInsets();
  const s = styles(t);
  const scrollRef = useRef(null);
  const [drawer, setDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [tool, setTool] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [eta, setEta] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [readyToast, setReadyToast] = useState(false);
  const dlRef = useRef({ t0: 0, p0: 0 });
  const prevStateRef = useRef(status.state);

  // Download ETA from the overall rate since the download started.
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

  // Elapsed timer during the (progress-less) load-into-memory phase.
  useEffect(() => {
    if (status.state !== 'loading') { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [status.state]);

  // Live "ready" banner when the model finishes loading.
  useEffect(() => {
    const was = prevStateRef.current;
    prevStateRef.current = status.state;
    if (status.state === 'ready' && (was === 'loading' || was === 'downloading')) {
      setReadyToast(true);
      const id = setTimeout(() => setReadyToast(false), 4200);
      return () => clearTimeout(id);
    }
  }, [status.state]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages, generating, attachedUri]);

  const ready = status.state === 'ready';
  const empty = messages.length === 0;
  const sendEnabled = (canSend !== undefined ? canSend : ready) && (!!input.trim() || !!attachedUri);
  const hasChats = Array.isArray(chats);

  const copy = (text) => {
    try { const C = require('expo-clipboard'); C.setStringAsync(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch (e) {}
  };
  const tapSuggestion = (sg) => {
    if (sg.kind === 'photo') { onPickImage && onPickImage(); }
    else { onPickExample && onPickExample(sg.value || ''); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* header */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <View style={s.headRow}>
          {hasChats ? (
            <Pressable onPress={() => setDrawer(true)} hitSlop={10} style={({ pressed }) => [s.headBtn, pressed && { opacity: 0.4 }]}><MenuIcon c={t.label} /></Pressable>
          ) : <View style={s.headBtn} />}
          <Pressable style={{ flex: 1, alignItems: 'center' }} onLongPress={() => status.detail && copy(status.detail)} hitSlop={6}>
            <Text style={s.hTitle} numberOfLines={1}>{title || 'Aria'}</Text>
            <View style={s.hStatus}>
              <View style={[s.dot, { backgroundColor: ready ? t.green : status.state === 'unavailable' ? t.label3 : t.label2 }]} />
              <Text style={s.hStatusTxt}>{status.label}</Text>
            </View>
          </Pressable>
          {hasChats ? (
            <Pressable onPress={onNewChat} hitSlop={10} style={({ pressed }) => [s.headBtn, pressed && { opacity: 0.4 }]}><ComposeIcon c={t.label} /></Pressable>
          ) : <View style={s.headBtn} />}
        </View>
      </View>

      {banner ? (<View style={s.banner}><Text style={s.bannerTxt}>{banner}</Text></View>) : null}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18, flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {(status.state === 'needs-download' || status.state === 'downloading' || status.state === 'loading' || status.state === 'unavailable') && (
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
            <View style={s.setup}>
              {status.state === 'needs-download' && (<>
                <View style={s.setupGlyph}><AriaMark size={26} c={t.onAccent} /></View>
                <Text style={s.setupTitle}>{download.title || 'Set up Aria'}</Text>
                <Text style={s.setupBody}>{download.body || 'Download the AI once so Aria can run right on your phone. It needs the internet this one time — after that it works completely offline.'}</Text>
                <Text style={s.setupNote}>{download.sizeNote || 'One-time download · stays on your device'}</Text>
                <Pressable onPress={onDownload} style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.8 }]}><Text style={s.primaryBtnTxt}>Download</Text></Pressable>
              </>)}
              {status.state === 'downloading' && (<>
                <Ring t={t} progress={status.progress || 0} />
                <Text style={s.setupTitle}>Downloading Aria</Text>
                <Text style={s.setupBody}>{eta || 'Starting the download…'}</Text>
                <View style={s.stepsRow}>
                  <View style={[s.stepDot, { backgroundColor: t.accent }]} />
                  <View style={[s.stepDot, { backgroundColor: t.fill }]} />
                </View>
                <Text style={s.setupNote}>Keep Aria open — it’ll work offline once this is done.</Text>
              </>)}
              {status.state === 'loading' && (<>
                <Ring t={t} indeterminate />
                <Text style={s.setupTitle}>Getting Aria ready</Text>
                <Text style={s.setupBody}>Loading the model into memory{elapsed > 3 ? ` · ${fmtElapsed(elapsed)}` : ''}</Text>
                <View style={s.stepsRow}>
                  <View style={[s.stepDot, { backgroundColor: t.accent }]} />
                  <View style={[s.stepDot, { backgroundColor: t.accent }]} />
                </View>
                <Text style={s.setupNote}>This can take up to a minute the first time.</Text>
              </>)}
              {status.state === 'unavailable' && status.label === 'Could not load model' ? (<>
                <View style={[s.setupGlyph, { backgroundColor: t.fill }]}><AriaMark size={26} c={t.label2} /></View>
                <Text style={s.setupTitle}>Couldn’t load the AI</Text>
                <Text style={s.setupBody}>The model wouldn’t load on this device. Try a lighter model in Settings — or copy the details below and send them over so it can be fixed.</Text>
                {status.detail ? <Text style={s.diagBox} selectable>{status.detail}</Text> : null}
                <Pressable onPress={() => status.detail && copy(status.detail)} style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.8 }]}><Text style={s.primaryBtnTxt}>Copy details</Text></Pressable>
              </>) : status.state === 'unavailable' ? (<>
                <View style={[s.setupGlyph, { backgroundColor: t.fill }]}><AriaMark size={26} c={t.label2} /></View>
                <Text style={s.setupTitle}>Runs in the installed app</Text>
                <Text style={s.setupBody}>Aria’s on-device AI runs in the real app. This is a preview of the interface.</Text>
              </>) : null}
            </View>
          </View>
        )}

        {ready && empty && (
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 20 }}>
            <View style={s.heroMark}><AriaMark size={28} c={t.onAccent} /></View>
            <Text style={s.greet}>{greetTitle}</Text>
            <Text style={s.greetSub}>{greetSub}</Text>
            <View style={s.sgGrid}>
              {suggestions.map((sg) => {
                const Ic = ICONS[sg.icon] || PencilSq;
                return (
                  <Pressable key={sg.key} onPress={() => tapSuggestion(sg)} style={({ pressed }) => [s.sgCard, pressed && { opacity: 0.6 }]}>
                    <Ic c={t.label} />
                    <Text style={s.sgTitle}>{sg.title}</Text>
                    <Text style={s.sgSub} numberOfLines={1}>{sg.sub}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {!empty && <View style={{ height: 8 }} />}
        {messages.map((m, i) => (
          m.role === 'user' ? (
            <Pressable key={i} onLongPress={() => m.text && copy(m.text)} style={s.userRow}>
              <View style={s.userBubble}>
                {m.imageUri ? <Image source={{ uri: m.imageUri }} style={s.msgImage} resizeMode="cover" /> : null}
                {m.text ? <Text style={s.userTxt}>{m.text}</Text> : null}
              </View>
            </Pressable>
          ) : (
            <Pressable key={i} onLongPress={() => m.text && copy(m.text)} style={s.aiRow}>
              <View style={s.aiHead}>
                <View style={s.aiAvatar}><AriaMark size={13} c={t.onAccent} /></View>
                <Text style={s.aiName}>Aria</Text>
              </View>
              {m.imageUri ? <Image source={{ uri: m.imageUri }} style={[s.msgImage, { marginLeft: 34 }]} resizeMode="cover" /> : null}
              {m.think ? <View style={s.aiBody}><ThoughtBlock t={t} think={m.think} live={!!m.streaming && !m.text} /></View> : null}
              {m.text ? <View style={s.aiBody}><Markdown style={mdStyles(t)}>{m.text}</Markdown></View> : null}
              {m.streaming && !m.think && !m.text ? (
                <View style={[s.aiBody, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <ActivityIndicator size="small" color={t.label3} />
                  <Text style={s.thinking}>Thinking…</Text>
                </View>
              ) : null}
            </Pressable>
          )
        ))}
      </ScrollView>

      {attachedUri ? (
        <View style={s.attachRow}>
          <Image source={{ uri: attachedUri }} style={s.attachThumb} resizeMode="cover" />
          <Text style={s.attachLabel} numberOfLines={1}>Photo ready</Text>
          <Pressable onPress={onClearImage} hitSlop={10} style={s.attachX}><CloseX c={t.label2} /></Pressable>
        </View>
      ) : null}

      <View style={[s.inputBar, { paddingBottom: insets.bottom ? insets.bottom : 10 }]}>
        <View style={s.inputPill}>
          {onPickImage ? (
            <Pressable onPress={() => setActionsOpen(true)} disabled={generating} style={({ pressed }) => [s.plusBtn, { opacity: generating ? 0.35 : 1 }, pressed && { opacity: 0.4 }]}><PlusIcon c={t.label} s={23} /></Pressable>
          ) : <View style={{ width: 6 }} />}
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder={ready ? placeholder : 'Set up Aria to start'}
            placeholderTextColor={t.label3}
            editable={ready && !generating}
            multiline
            onSubmitEditing={onSend}
            blurOnSubmit={false}
          />
          {generating ? (
            <Pressable onPress={onStop} style={s.sendBtn}><View style={[s.sendCircle, { backgroundColor: t.accent }]}><StopDot c={t.onAccent} /></View></Pressable>
          ) : (
            <Pressable onPress={onSend} disabled={!sendEnabled} style={s.sendBtn}><View style={[s.sendCircle, { backgroundColor: sendEnabled ? t.accent : t.fill2 }]}><SendArrow c={sendEnabled ? t.onAccent : t.label3} /></View></Pressable>
          )}
        </View>
      </View>

      {/* chats drawer */}
      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <Pressable style={s.drawerBackdrop} onPress={() => setDrawer(false)}>
          <Pressable style={[s.drawer, { paddingTop: insets.top + 14 }]} onPress={() => {}}>
            <View style={s.drawerHead}>
              <Text style={s.drawerTitle}>Chats</Text>
              <Pressable onPress={() => { onNewChat(); setDrawer(false); }} hitSlop={10} style={({ pressed }) => [s.newChatBtn, pressed && { opacity: 0.5 }]}>
                <PlusIcon c={t.label} s={18} /><Text style={s.newChatTxt}>New</Text>
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {(chats || []).length === 0 ? (
                <Text style={[s.setupBody, { marginTop: 20, textAlign: 'left' }]}>No saved chats yet.</Text>
              ) : (chats || []).map((c) => (
                <Pressable key={c.id} onPress={() => { onOpenChat(c.id); setDrawer(false); }} style={({ pressed }) => [s.chatRow, c.id === activeChatId && { backgroundColor: t.fill }, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.chatRowTitle} numberOfLines={1}>{c.title || 'New chat'}</Text>
                    <Text style={s.chatRowTime}>{timeAgo(c.updatedAt)}</Text>
                  </View>
                  <Pressable onPress={() => onDeleteChat(c.id)} hitSlop={10} style={{ padding: 6 }}><TrashIcon c={t.label3} /></Pressable>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => { setDrawer(false); setSettingsOpen(true); }} style={({ pressed }) => [s.settingsRow, { paddingBottom: insets.bottom + 10 }, pressed && { opacity: 0.6 }]}>
              <SlidersIcon c={t.label} /><Text style={s.settingsTxt}>Settings</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Settings t={t} visible={settingsOpen} onClose={() => setSettingsOpen(false)} onClearChats={onClearChats} />

      {copied ? (<View style={[s.copied, { bottom: insets.bottom + 86 }]} pointerEvents="none"><Text style={s.copiedTxt}>Copied</Text></View>) : null}
      {readyToast ? (
        <View style={[s.readyToast, { top: insets.top + 52 }]} pointerEvents="none">
          <View style={s.readyDot} />
          <Text style={s.readyToastTxt}>Aria is ready</Text>
        </View>
      ) : null}

      <ActionsSheet
        t={t}
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onPhoto={onPickImage}
        onTool={(id) => setTool(id)}
        onWriting={(v) => onPickExample && onPickExample(v)}
      />
      <ToolsHub t={t} toolId={tool} onClose={() => setTool(null)} />
    </KeyboardAvoidingView>
  );
}

function mdStyles(t) {
  return {
    body: { color: t.label, fontSize: 16, lineHeight: 24 },
    strong: { fontWeight: '700' },
    bullet_list: { marginVertical: 2 },
    ordered_list: { marginVertical: 2 },
    code_inline: { backgroundColor: t.fill, color: t.label, borderRadius: 4, paddingHorizontal: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    fence: { backgroundColor: t.fill, color: t.label, borderRadius: 10, padding: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    code_block: { backgroundColor: t.fill, color: t.label, borderRadius: 10, padding: 11 },
    link: { color: t.blue },
    heading1: { color: t.label, fontSize: 21, fontWeight: '700', marginBottom: 2 },
    heading2: { color: t.label, fontSize: 18, fontWeight: '700', marginBottom: 2 },
  };
}

function styles(t) {
  return StyleSheet.create({
    header: { paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep, backgroundColor: t.bg },
    headRow: { flexDirection: 'row', alignItems: 'center' },
    headBtn: { width: 42, height: 38, alignItems: 'center', justifyContent: 'center' },
    hTitle: { color: t.label, fontSize: 16, fontWeight: '600', letterSpacing: -0.2, maxWidth: '88%' },
    hStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    hStatusTxt: { color: t.label2, fontSize: 11.5, letterSpacing: 0.1 },

    banner: { backgroundColor: t.fill, paddingVertical: 8, paddingHorizontal: 16 },
    bannerTxt: { color: t.label2, fontSize: 12.5, textAlign: 'center' },

    setup: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: t.sep },
    setupGlyph: { width: 60, height: 60, borderRadius: 17, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
    setupTitle: { color: t.label, fontSize: 20, fontWeight: '700', marginBottom: 8, letterSpacing: -0.3 },
    setupBody: { color: t.label2, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
    setupNote: { color: t.label3, fontSize: 12.5, marginTop: 14, fontWeight: '500' },
    diagBox: { color: t.label2, fontSize: 12, lineHeight: 17, marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: t.fill, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', alignSelf: 'stretch' },
    primaryBtn: { marginTop: 20, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 40, backgroundColor: t.accent, alignSelf: 'stretch', alignItems: 'center' },
    primaryBtnTxt: { color: t.onAccent, fontSize: 16, fontWeight: '600' },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: t.fill, width: '100%', marginTop: 18, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: t.accent },
    stepsRow: { flexDirection: 'row', gap: 7, marginTop: 16 },
    stepDot: { width: 22, height: 5, borderRadius: 3 },

    heroMark: { width: 56, height: 56, borderRadius: 16, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
    greet: { color: t.label, fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: -0.8 },
    greetSub: { color: t.label2, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
    sgGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 26, rowGap: 11 },
    sgCard: { width: '48.5%', backgroundColor: t.card, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.sep },
    sgTitle: { color: t.label, fontSize: 14.5, fontWeight: '600', marginTop: 11, letterSpacing: -0.2 },
    sgSub: { color: t.label2, fontSize: 12.5, marginTop: 2 },

    userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginVertical: 7 },
    userBubble: { maxWidth: '82%', borderRadius: 22, borderBottomRightRadius: 7, paddingVertical: 10, paddingHorizontal: 15, backgroundColor: t.bubbleUser },
    userTxt: { fontSize: 16, lineHeight: 22, color: t.onBubbleUser },
    aiRow: { marginVertical: 10 },
    aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
    aiAvatar: { width: 24, height: 24, borderRadius: 8, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' },
    aiName: { color: t.label2, fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
    aiBody: { paddingLeft: 2 },
    msgImage: { width: 196, height: 196, borderRadius: 16, marginVertical: 4 },
    thinking: { color: t.label3, fontSize: 14 },

    attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginBottom: 2, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: t.fill, borderRadius: 14 },
    attachThumb: { width: 36, height: 36, borderRadius: 9 },
    attachLabel: { flex: 1, color: t.label2, fontSize: 13.5, fontWeight: '500' },
    attachX: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },

    inputBar: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: t.bg },
    inputPill: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: t.fill, borderRadius: 26, paddingLeft: 6, paddingRight: 6, paddingVertical: 5, minHeight: 48 },
    plusBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    input: { flex: 1, maxHeight: 120, color: t.label, fontSize: 16, lineHeight: 21, paddingHorizontal: 6, paddingTop: Platform.OS === 'ios' ? 9 : 6, paddingBottom: Platform.OS === 'ios' ? 9 : 6 },
    sendBtn: { padding: 1, alignSelf: 'flex-end' },
    sendCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

    drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row' },
    drawer: { width: '82%', maxWidth: 330, backgroundColor: t.bg, paddingHorizontal: 14, paddingBottom: 20, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.sep },
    drawerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 4 },
    drawerTitle: { color: t.label, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
    newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 100, backgroundColor: t.fill },
    newChatTxt: { color: t.label, fontSize: 14, fontWeight: '600' },
    chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 13, marginTop: 3 },
    chatRowTitle: { color: t.label, fontSize: 15, fontWeight: '500', letterSpacing: -0.1 },
    chatRowTime: { color: t.label3, fontSize: 12, marginTop: 2 },
    settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep, marginTop: 4 },
    settingsTxt: { color: t.label, fontSize: 16, fontWeight: '600' },

    copied: { position: 'absolute', alignSelf: 'center', backgroundColor: t.dark ? '#2C2C2E' : '#1D1D1F', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
    copiedTxt: { color: '#fff', fontSize: 13.5, fontWeight: '500' },
    readyToast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.dark ? '#1E1E20' : '#1D1D1F', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 100, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    readyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.green },
    readyToastTxt: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  });
}
