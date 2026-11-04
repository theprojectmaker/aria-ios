import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatUI from './ChatUI';
import VisionEngine from './visionEngine';
import { useTheme } from './theme';
import { loadChats, saveChats, newChat, titleFrom } from './chatStore';
import { usePrefs } from './prefs';

const ENABLED_KEY = 'aria.ai.enabled.v1';

const SYSTEM_PROMPT =
  "You are Aria, a helpful, friendly AI assistant running privately on the user's phone, with no internet. " +
  "Keep any reasoning brief, then ALWAYS finish with a clear, direct answer to the user. " +
  "Be concise unless the user asks for detail. If you are unsure, say so honestly rather than making something up.";

const DOWNLOAD = {
  title: 'Set up Aria',
  body: 'Download the AI once so Aria can run right on your phone. It needs the internet this one time — Wi-Fi is best. After that, it works completely offline.',
  sizeNote: 'About 1.2 GB on iPhone · stays on your device',
};

// Qwen3 reasons inside <think>…</think>. Split the reasoning from the answer so
// the UI can show the answer and keep the thinking in a collapsible section.
function parseThink(s) {
  if (!s) return { think: '', answer: '' };
  const close = s.indexOf('</think>');
  if (close !== -1) {
    let think = s.slice(0, close);
    const open = think.indexOf('<think>');
    if (open !== -1) think = think.slice(open + 7);
    return { think: think.trim(), answer: s.slice(close + 8).replace(/^\s+/, '') };
  }
  const open = s.indexOf('<think>');
  if (open !== -1) return { think: s.slice(open + 7).replace(/^\s+/, ''), answer: '' };
  return { think: '', answer: s };
}

class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch() { if (this.props.onError) this.props.onError(); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

/* The chat model loads ONCE and stays resident. Photos are handled by a small,
   lazily-mounted vision engine (classifier + OCR) that coexists with it. */
function ModelChat({ t, active, activeChatId, chats, persistMessages, onNewChat, onOpenChat, onDeleteChat, onClearChats, startSafe }) {
  const { models, useLLMChatSession } = require('react-native-executorch');
  const { model: pref } = usePrefs();
  const small = (models.llm.QWEN3_0_6B && (models.llm.QWEN3_0_6B.DEFAULT || models.llm.QWEN3_0_6B.XNNPACK_8DA4W)) || models.llm.QWEN3_1_7B.DEFAULT;
  const mid = (models.llm.LFM2_5_1_2B && models.llm.LFM2_5_1_2B.DEFAULT) || small;
  const big = models.llm.QWEN3_1_7B.DEFAULT;
  // Tiny models that fit a low-RAM device (e.g. iPad 9th gen, 3 GB).
  const tinyA = (models.llm.SMOLLM2_360M && models.llm.SMOLLM2_360M.DEFAULT) || (models.llm.LFM2_5_350M && models.llm.LFM2_5_350M.DEFAULT) || small;
  const tinyB = (models.llm.SMOLLM2_135M && models.llm.SMOLLM2_135M.DEFAULT) || tinyA;
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  // Chain of models to try: the user's pick first, then smaller fallbacks if the
  // device can't load it (OOM shows up as llm.error). iPads have far less usable
  // RAM, so "Automatic" starts with a tiny model that actually loads there.
  const chainFor = (p) => {
    if (isPad) {
      if (p === 'smart') return [big, mid, small, tinyA, tinyB];
      if (p === 'balanced') return [mid, small, tinyA, tinyB];
      if (p === 'light') return [small, tinyA, tinyB];
      return [tinyA, tinyB]; // auto — fits an iPad 9th gen
    }
    if (p === 'light') return [small, tinyA];
    if (p === 'balanced') return [mid, small, tinyA];
    if (p === 'smart') return [big, mid, small, tinyA];
    return [big, mid, small, tinyA]; // iPhone auto
  };
  const CHAIN = chainFor(pref);
  const [tier, setTier] = useState((startSafe && pref === 'auto') ? CHAIN.length - 1 : 0);
  const prefRef = useRef(pref);
  useEffect(() => { if (prefRef.current !== pref) { prefRef.current = pref; setTier(0); } }, [pref]);
  const MODEL = CHAIN[Math.min(tier, CHAIN.length - 1)];
  const llm = useLLMChatSession(MODEL, {
    initialMessages: [{ role: 'system', content: SYSTEM_PROMPT }],
    generationConfig: { maxNewTokens: 1024, temperature: 0.7 },
  });

  // If a model fails to load, drop to a smaller one (and, in auto mode, remember).
  useEffect(() => {
    if (llm.error && tier < CHAIN.length - 1) {
      setTier((x) => x + 1);
      if (pref === 'auto') AsyncStorage.setItem('aria.model.safe.v1', '1').catch(() => {});
    }
  }, [llm.error]);

  const [messages, setMessages] = useState(active.messages || []);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [attachedUri, setAttachedUri] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [visionStatus, setVisionStatus] = useState(null);
  const [visionReady, setVisionReady] = useState(false);
  const [visionFailed, setVisionFailed] = useState(false);
  const attachRef = useRef(null);
  const analyzeRef = useRef(null);

  useEffect(() => { setMessages(active.messages || []); setInput(''); clearAttach(); }, [activeChatId]);

  const commit = (next) => { setMessages(next); persistMessages(next); };
  function clearAttach() { attachRef.current = null; setAttachedUri(null); }

  const atLast = tier >= CHAIN.length - 1;
  const status = (() => {
    if (llm.error && atLast) return { state: 'unavailable', label: 'Could not load model' };
    if (llm.error) return { state: 'loading', label: 'Trying a lighter model…' };
    if (!llm.isReady && (llm.downloadProgress || 0) < 1) return { state: 'downloading', progress: llm.downloadProgress || 0, label: `${tier > 0 ? 'Lighter model ' : 'Downloading '}${Math.round((llm.downloadProgress || 0) * 100)}%` };
    if (!llm.isReady) return { state: 'loading', label: 'Getting ready…' };
    if (preparing) return { state: 'ready', label: 'Reading photo…' };
    if (attachedUri && visionStatus && visionStatus.state === 'downloading') return { state: 'ready', label: `Preparing vision ${Math.round((visionStatus.progress || 0) * 100)}%` };
    if (attachedUri && !visionReady) return { state: 'ready', label: 'Preparing vision…' };
    return { state: 'ready', label: 'On-device · ready' };
  })();

  const capture = useCallback(async (mode) => {
    try {
      const IP = require('expo-image-picker');
      if (mode === 'camera') { const p = await IP.requestCameraPermissionsAsync(); if (!p.granted) return; }
      const res = mode === 'camera'
        ? await IP.launchCameraAsync({ quality: 1 })
        : await IP.launchImageLibraryAsync({ mediaTypes: (IP.MediaTypeOptions && IP.MediaTypeOptions.Images) || 'images', quality: 1 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const uri = res.assets[0].uri;
      setAttachedUri(uri);
      setPreparing(true);
      const { uriToImageBuffer } = require('./imageBuffer');
      attachRef.current = await uriToImageBuffer(uri);
    } catch (e) { clearAttach(); } finally { setPreparing(false); }
  }, []);

  const pickImage = useCallback(() => {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take Photo', onPress: () => capture('camera') },
      { text: 'Choose Photo', onPress: () => capture('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [capture]);

  const onSend = useCallback(async () => {
    const text = input.trim();
    const img = attachRef.current;
    if (generating || preparing) return;

    // Photo → on-device vision (classify + read text).
    if (img) {
      if (!visionFailed && (!visionReady || !analyzeRef.current)) return; // wait until ready
      const uri = attachedUri;
      setInput('');
      clearAttach();
      const base = [...messages, { role: 'user', text: text || '', imageUri: uri }];
      commit([...base, { role: 'assistant', text: '', streaming: true }]);
      setGenerating(true);
      let reply = '';
      if (visionFailed || !analyzeRef.current) {
        reply = "I couldn’t start the photo reader on this device. Chat still works — ask me anything.";
      } else {
        try { reply = await analyzeRef.current(img); }
        catch (e) { reply = 'Sorry, I couldn’t read that photo. Try another one.'; }
      }
      commit([...base, { role: 'assistant', text: reply, streaming: false }]);
      setGenerating(false);
      return;
    }

    // Text → on-device LLM.
    if (!text || !llm.isReady || !llm.sendMessage) return;
    setInput('');
    const base = [...messages, { role: 'user', text }];
    commit([...base, { role: 'assistant', text: '', think: '', streaming: true }]);
    setGenerating(true);
    let acc = '';
    let errored = false;
    try {
      await llm.sendMessage(text, (tok) => {
        acc += tok;
        const { think, answer } = parseThink(acc);
        setMessages([...base, { role: 'assistant', text: answer, think, streaming: true }]);
      });
    } catch (e) {
      errored = true;
      acc = acc || ('⚠️ ' + ((e && e.message) ? e.message : String(e)));
    }
    const { think, answer } = parseThink(acc);
    let finalAnswer = answer;
    if (!errored && !finalAnswer.trim()) {
      // Ran out of room while thinking — don't leave the user with nothing.
      finalAnswer = think ? 'Hmm, I didn’t quite finish that thought. Try asking again, or ask for something shorter.' : acc;
    }
    commit([...base, { role: 'assistant', text: finalAnswer, think, streaming: false }]);
    setGenerating(false);
  }, [input, generating, preparing, attachedUri, visionReady, visionFailed, messages, llm]);

  const onStop = useCallback(() => { try { llm.stop && llm.stop(); } catch (e) {} setGenerating(false); }, [llm]);

  const canSend = llm.isReady && !preparing && (attachRef.current ? (visionReady || visionFailed) : true);

  return (
    <>
      {/* Vision loads eagerly, alongside the chat model, in its own error
          boundary so a vision failure can never take down the chat. */}
      <Boundary fallback={null} onError={() => setVisionFailed(true)}>
        <VisionEngine
          onStatus={setVisionStatus}
          onReady={(fn) => { analyzeRef.current = fn; setVisionReady(true); }}
        />
      </Boundary>
      <ChatUI
        t={t}
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={onSend}
        onStop={onStop}
        generating={generating}
        status={status}
        onDownload={() => {}}
        onPickExample={(ex) => setInput(ex)}
        onPickImage={pickImage}
        attachedUri={attachedUri}
        onClearImage={clearAttach}
        canSend={canSend}
        title={active.title}
        download={DOWNLOAD}
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={onNewChat}
        onOpenChat={onOpenChat}
        onDeleteChat={onDeleteChat}
        onClearChats={onClearChats}
      />
    </>
  );
}

function ChatsManager({ t, safe }) {
  const [chats, setChats] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const chatsRef = useRef([]);
  const activeIdRef = useRef(null);
  chatsRef.current = chats || [];
  activeIdRef.current = activeId;

  useEffect(() => {
    (async () => {
      let list = await loadChats();
      if (list.length === 0) { const c = newChat(); list = [c]; await saveChats(list); }
      setChats(list);
      setActiveId(list[0].id);
    })();
  }, []);

  const persistMessages = useCallback((msgs) => {
    const next = chatsRef.current.map((c) => c.id === activeIdRef.current
      ? { ...c, messages: msgs, title: (!c.title || c.title === 'New chat') ? titleFrom(msgs) : c.title, updatedAt: Date.now() }
      : c);
    next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    setChats(next); saveChats(next);
  }, []);

  const onNewChat = useCallback(() => { const c = newChat(); setChats((cs) => [c, ...(cs || [])]); setActiveId(c.id); }, []);
  const onOpenChat = useCallback((id) => setActiveId(id), []);
  const onDeleteChat = useCallback((id) => {
    setChats((cs) => {
      let next = (cs || []).filter((c) => c.id !== id);
      if (next.length === 0) next = [newChat()];
      saveChats(next);
      if (id === activeIdRef.current) setActiveId(next[0].id);
      return next;
    });
  }, []);
  const onClearChats = useCallback(() => {
    const c = newChat();
    setChats([c]); setActiveId(c.id); saveChats([c]);
  }, []);

  if (!chats || !activeId) return null;
  const active = chats.find((c) => c.id === activeId) || chats[0];

  return (
    <ModelChat
      t={t} active={active} activeChatId={activeId} chats={chats}
      persistMessages={persistMessages} startSafe={safe}
      onNewChat={onNewChat} onOpenChat={onOpenChat} onDeleteChat={onDeleteChat} onClearChats={onClearChats}
    />
  );
}

export default function ChatNative() {
  const t = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [safe, setSafe] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(ENABLED_KEY), AsyncStorage.getItem('aria.model.safe.v1')])
      .then(([en, sf]) => { if (en === '1') setEnabled(true); if (sf === '1') setSafe(true); setChecked(true); })
      .catch(() => setChecked(true));
  }, []);

  const enable = () => { setEnabled(true); AsyncStorage.setItem(ENABLED_KEY, '1').catch(() => {}); };

  if (!checked) return null;

  if (!enabled) {
    return (
      <ChatUI
        t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
        generating={false} status={{ state: 'needs-download', label: 'Not set up yet' }}
        onDownload={enable} onPickExample={() => {}} download={DOWNLOAD}
      />
    );
  }

  const fallback = (
    <ChatUI
      t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
      generating={false} status={{ state: 'unavailable', label: 'Needs the installed app' }}
      onDownload={() => {}} onPickExample={() => {}}
    />
  );

  return (
    <Boundary fallback={fallback}>
      <ChatsManager t={t} safe={safe} />
    </Boundary>
  );
}
