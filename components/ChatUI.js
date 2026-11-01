import { useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Markdown from 'react-native-markdown-display';

const DEFAULT_EXAMPLES = [
  'Explain quantum entanglement like I’m five.',
  'Write a warm, short thank-you note to a mentor.',
  'Give me 5 dinner ideas with chicken and rice.',
  'Draft a to-do list for moving apartments.',
];

/* ── icons ─────────────────────────────────────────────────────────── */
export const Sparkle = ({ size = 22, c = '#fff', c2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {c2 ? (
      <Defs>
        <LinearGradient id="spk" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c} />
          <Stop offset="1" stopColor={c2} />
        </LinearGradient>
      </Defs>
    ) : null}
    <Path d="M12 2c.4 4.6 2.4 6.6 7 7-4.6.4-6.6 2.4-7 7-.4-4.6-2.4-6.6-7-7 4.6-.4 6.6-2.4 7-7Z" fill={c2 ? 'url(#spk)' : c} />
    <Path d="M19 3c.2 1.8 1 2.6 2.8 2.8-1.8.2-2.6 1-2.8 2.8-.2-1.8-1-2.6-2.8-2.8C18 5.6 18.8 4.8 19 3Z" fill={c2 ? 'url(#spk)' : c} opacity={0.9} />
  </Svg>
);
const SendArrow = ({ c }) => <Svg width={20} height={20} viewBox="0 0 20 20"><Path d="M10 16V5M10 5l-5 5M10 5l5 5" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
const StopSquare = ({ c }) => <Svg width={16} height={16} viewBox="0 0 18 18"><Path d="M4 4h10v10H4z" fill={c} rx={2} /></Svg>;
const PhotoIcon = ({ c }) => <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" /><Path d="M3 16l5-5 4 4 3-3 6 6" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><Circle cx={8} cy={9.5} r={1.4} fill={c} /></Svg>;
const MenuIcon = ({ c }) => <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M4 7h16M4 12h16M4 17h16" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>;
const PlusIcon = ({ c }) => <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>;
const TrashIcon = ({ c }) => <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
const LockIcon = ({ c }) => <Svg width={13} height={13} viewBox="0 0 24 24"><Path d="M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" fill="none" stroke={c} strokeWidth={1.9} strokeLinejoin="round" /><Path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round" /></Svg>;

function timeAgo(ts) {
  const s = Math.round((Date.now() - (ts || 0)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

export default function ChatUI({
  t, messages, input, setInput, onSend, onStop, generating,
  status, onDownload, onPickExample, banner,
  onPickImage, attachedUri, onClearImage, canSend,
  title, chats, activeChatId, onNewChat, onOpenChat, onDeleteChat,
  examples = DEFAULT_EXAMPLES, greetTitle = 'How can I help?',
  greetSub, placeholder = 'Message', download = {},
}) {
  const insets = useSafeAreaInsets();
  const s = styles(t);
  const scrollRef = useRef(null);
  const [drawer, setDrawer] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages, generating, attachedUri]);

  const ready = status.state === 'ready';
  const empty = messages.length === 0;
  const sendEnabled = (canSend !== undefined ? canSend : ready) && (!!input.trim() || !!attachedUri);
  const hasChats = Array.isArray(chats);
  const sub = greetSub || (onPickImage
    ? 'I run entirely on your phone — no internet needed. Add a photo and ask away.'
    : 'I run entirely on your phone — no internet, nothing leaves your device.');

  const copy = (text) => {
    try { const C = require('expo-clipboard'); C.setStringAsync(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch (e) {}
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headRow}>
          {hasChats ? (
            <Pressable onPress={() => setDrawer(true)} hitSlop={10} style={s.headBtn}><MenuIcon c={t.label} /></Pressable>
          ) : <View style={s.headBtn} />}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.hTitle} numberOfLines={1}>{title || 'Aria'}</Text>
            <View style={s.hStatus}>
              <View style={[s.dot, { backgroundColor: ready ? t.green : status.state === 'unavailable' ? t.label3 : t.accent }]} />
              <Text style={s.hStatusTxt}>{status.label}</Text>
            </View>
          </View>
          {hasChats ? (
            <Pressable onPress={onNewChat} hitSlop={10} style={s.headBtn}><PlusIcon c={t.accent} /></Pressable>
          ) : <View style={s.headBtn} />}
        </View>
      </View>

      {banner ? (<View style={s.banner}><Text style={s.bannerTxt}>{banner}</Text></View>) : null}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {status.state === 'needs-download' && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={s.setup}>
              <View style={s.setupGlyph}><Sparkle size={30} c={t.onAccent} /></View>
              <Text style={s.setupTitle}>{download.title || 'Set up on-device AI'}</Text>
              <Text style={s.setupBody}>{download.body || 'Download the AI model once so it can run right on your phone. It needs the internet this one time — Wi-Fi is best. After that, it works fully offline.'}</Text>
              <View style={s.privacyRow}><LockIcon c={t.label2} /><Text style={s.privacyTxt}>{download.sizeNote || 'About 1.2 GB · stored on your device'}</Text></View>
              <Pressable onPress={onDownload} style={({ pressed }) => [s.setupBtn, { backgroundColor: t.accent }, pressed && { opacity: 0.75 }]}><Text style={s.setupBtnTxt}>Download model</Text></Pressable>
            </View>
          </View>
        )}
        {status.state === 'downloading' && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={s.setup}>
              <View style={s.setupGlyph}><Sparkle size={30} c={t.onAccent} /></View>
              <Text style={s.setupTitle}>Downloading model…</Text>
              <View style={s.progressTrack}><View style={[s.progressFill, { backgroundColor: t.accent, width: `${Math.round((status.progress || 0) * 100)}%` }]} /></View>
              <Text style={s.setupBody}>{Math.round((status.progress || 0) * 100)}% — keep Aria open</Text>
            </View>
          </View>
        )}
        {status.state === 'loading' && (<View style={{ flex: 1, justifyContent: 'center' }}><View style={s.setup}><ActivityIndicator color={t.accent} /><Text style={[s.setupBody, { marginTop: 14 }]}>Loading the model into memory…</Text></View></View>)}
        {status.state === 'unavailable' && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={s.setup}>
              <View style={[s.setupGlyph, { backgroundColor: t.fill }]}><Sparkle size={28} c={t.label2} /></View>
              <Text style={s.setupTitle}>Runs in the installed app</Text>
              <Text style={s.setupBody}>Aria’s on-device AI runs in the real app from the App Store. This is a preview of the interface.</Text>
            </View>
          </View>
        )}

        {ready && empty && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={s.heroGlyph}><Sparkle size={34} c={t.accent} c2={t.accent2} /></View>
            <Text style={s.greet}>{greetTitle}</Text>
            <Text style={s.greetSub}>{sub}</Text>
            <View style={{ marginTop: 20, gap: 9 }}>
              {examples.map((ex) => (<Pressable key={ex} onPress={() => onPickExample(ex)} style={({ pressed }) => [s.example, pressed && { opacity: 0.6 }]}><Text style={s.exampleTxt}>{ex}</Text></Pressable>))}
            </View>
          </View>
        )}

        {messages.map((m, i) => (
          <Pressable key={i} onLongPress={() => m.text && copy(m.text)} style={[s.msgRow, { justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }]}>
            <View style={[s.bubble, m.role === 'user' ? { backgroundColor: t.bubbleUser, borderBottomRightRadius: 5 } : { backgroundColor: t.bubbleAI, borderBottomLeftRadius: 5, borderWidth: t.dark ? 0 : StyleSheet.hairlineWidth, borderColor: t.sep }]}>
              {m.imageUri ? <Image source={{ uri: m.imageUri }} style={s.msgImage} resizeMode="cover" /> : null}
              {m.text ? (
                m.role === 'user'
                  ? <Text style={[s.bubbleTxt, { color: t.onAccent }]}>{m.text}</Text>
                  : <Markdown style={mdStyles(t)}>{m.text}</Markdown>
              ) : null}
            </View>
          </Pressable>
        ))}
        {generating && (<View style={s.thinkingRow}><ActivityIndicator size="small" color={t.label3} /><Text style={s.thinking}>Thinking…</Text></View>)}
      </ScrollView>

      {attachedUri ? (
        <View style={s.attachRow}>
          <Image source={{ uri: attachedUri }} style={s.attachThumb} resizeMode="cover" />
          <Text style={s.attachLabel} numberOfLines={1}>Photo attached</Text>
          <Pressable onPress={onClearImage} hitSlop={10} style={s.attachX}><Text style={{ color: t.label2, fontSize: 18 }}>✕</Text></Pressable>
        </View>
      ) : null}

      <View style={[s.inputBar, { paddingBottom: insets.bottom ? 10 : 12 }]}>
        <View style={s.inputWrap}>
          {onPickImage ? (<Pressable onPress={onPickImage} disabled={!ready || generating} style={[s.photoBtn, { opacity: ready && !generating ? 1 : 0.4 }]}><PhotoIcon c={t.accent} /></Pressable>) : null}
          <TextInput style={s.input} value={input} onChangeText={setInput} placeholder={ready ? placeholder : 'Set up the model to start'} placeholderTextColor={t.label3} editable={ready && !generating} multiline onSubmitEditing={onSend} blurOnSubmit={false} />
          {generating ? (
            <Pressable onPress={onStop} style={[s.sendBtn, { backgroundColor: t.label2 }]}><StopSquare c="#FFFFFF" /></Pressable>
          ) : (
            <Pressable onPress={onSend} disabled={!sendEnabled} style={[s.sendBtn, { backgroundColor: sendEnabled ? t.accent : t.fill }]}><SendArrow c={sendEnabled ? '#FFFFFF' : t.label3} /></Pressable>
          )}
        </View>
      </View>

      {/* chats drawer */}
      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <Pressable style={s.drawerBackdrop} onPress={() => setDrawer(false)}>
          <Pressable style={[s.drawer, { paddingTop: insets.top + 12 }]} onPress={() => {}}>
            <View style={s.drawerHead}>
              <Text style={s.drawerTitle}>Chats</Text>
              <Pressable onPress={() => { onNewChat(); setDrawer(false); }} hitSlop={10} style={s.newChatBtn}>
                <PlusIcon c={t.accent} /><Text style={{ color: t.accent, fontSize: 15, fontWeight: '600', marginLeft: 4 }}>New</Text>
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {(chats || []).length === 0 ? (
                <Text style={[s.setupBody, { marginTop: 20 }]}>No saved chats yet.</Text>
              ) : (chats || []).map((c) => (
                <Pressable key={c.id} onPress={() => { onOpenChat(c.id); setDrawer(false); }} style={[s.chatRow, c.id === activeChatId && { backgroundColor: t.fill }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.chatRowTitle} numberOfLines={1}>{c.title || 'New chat'}</Text>
                    <Text style={s.chatRowTime}>{timeAgo(c.updatedAt)}</Text>
                  </View>
                  <Pressable onPress={() => onDeleteChat(c.id)} hitSlop={10} style={{ padding: 6 }}><TrashIcon c={t.label2} /></Pressable>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {copied ? (<View style={[s.copied, { bottom: insets.bottom + 80 }]} pointerEvents="none"><Text style={s.copiedTxt}>Copied</Text></View>) : null}
    </KeyboardAvoidingView>
  );
}

function mdStyles(t) {
  return {
    body: { color: t.label, fontSize: 16, lineHeight: 23 },
    strong: { fontWeight: '700' },
    bullet_list: { marginVertical: 2 },
    ordered_list: { marginVertical: 2 },
    code_inline: { backgroundColor: t.fill, color: t.label, borderRadius: 4, paddingHorizontal: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    fence: { backgroundColor: t.fill, color: t.label, borderRadius: 10, padding: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    code_block: { backgroundColor: t.fill, color: t.label, borderRadius: 10, padding: 11 },
    link: { color: t.accent },
    heading1: { color: t.label, fontSize: 20, fontWeight: '700' },
    heading2: { color: t.label, fontSize: 18, fontWeight: '700' },
  };
}

function styles(t) {
  return StyleSheet.create({
    header: { paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep, backgroundColor: t.card },
    headRow: { flexDirection: 'row', alignItems: 'center' },
    headBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    hTitle: { color: t.label, fontSize: 16, fontWeight: '600', letterSpacing: 0.1, maxWidth: '90%' },
    hStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    hStatusTxt: { color: t.label2, fontSize: 12 },

    banner: { backgroundColor: t.fill, paddingVertical: 8, paddingHorizontal: 16 },
    bannerTxt: { color: t.label2, fontSize: 12.5, textAlign: 'center' },

    setup: { backgroundColor: t.card, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: t.dark ? 0 : StyleSheet.hairlineWidth, borderColor: t.sep },
    setupGlyph: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    setupTitle: { color: t.label, fontSize: 19, fontWeight: '700', marginBottom: 8, letterSpacing: -0.2 },
    setupBody: { color: t.label2, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
    privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
    privacyTxt: { color: t.label2, fontSize: 12.5, fontWeight: '500' },
    setupBtn: { marginTop: 20, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 34, alignSelf: 'stretch', alignItems: 'center' },
    setupBtnTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: t.fill, width: '100%', marginTop: 16, overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: 4 },

    heroGlyph: { width: 72, height: 72, borderRadius: 24, backgroundColor: t.dark ? 'rgba(125,122,255,0.14)' : 'rgba(94,92,230,0.1)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
    greet: { color: t.label, fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
    greetSub: { color: t.label2, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 6, paddingHorizontal: 18 },
    example: { backgroundColor: t.card, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15, borderWidth: t.dark ? 0 : StyleSheet.hairlineWidth, borderColor: t.sep },
    exampleTxt: { color: t.label, fontSize: 14.5 },

    msgRow: { flexDirection: 'row', marginVertical: 5 },
    bubble: { maxWidth: '86%', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14 },
    bubbleTxt: { fontSize: 16, lineHeight: 22 },
    msgImage: { width: 190, height: 190, borderRadius: 14, marginVertical: 5 },
    thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, marginLeft: 4 },
    thinking: { color: t.label3, fontSize: 13 },

    attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
    attachThumb: { width: 38, height: 38, borderRadius: 9 },
    attachLabel: { flex: 1, color: t.label2, fontSize: 13.5 },
    attachX: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

    inputBar: { paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep, backgroundColor: t.card },
    inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    photoBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    input: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: t.fill, borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, color: t.label, fontSize: 16 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

    drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
    drawer: { width: '80%', maxWidth: 320, backgroundColor: t.card, paddingHorizontal: 14, paddingBottom: 20 },
    drawerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
    drawerTitle: { color: t.label, fontSize: 20, fontWeight: '700' },
    newChatBtn: { flexDirection: 'row', alignItems: 'center' },
    chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, marginTop: 4 },
    chatRowTitle: { color: t.label, fontSize: 15, fontWeight: '500' },
    chatRowTime: { color: t.label2, fontSize: 12, marginTop: 2 },

    copied: { position: 'absolute', alignSelf: 'center', backgroundColor: t.dark ? '#2C2C2E' : '#1C1C1E', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
    copiedTxt: { color: '#fff', fontSize: 13.5, fontWeight: '500' },
  });
}
