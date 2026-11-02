import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatUI from './ChatUI';
import VisionEngine from './visionEngine';
import { useTheme } from './theme';
import { loadChats, saveChats, newChat, titleFrom } from './chatStore';

const ENABLED_KEY = 'aria.ai.enabled.v1';

const SYSTEM_PROMPT =
  "You are Aria, a helpful, friendly AI assistant running privately on the user's phone, with no internet. " +
  "Give clear, direct, and accurate answers. Think it through, then answer. Keep it concise unless the user asks for detail. " +
  "If you are unsure or don't know, say so honestly rather than making something up.";

const DOWNLOAD = {
  title: 'Set up Aria',
  body: 'Download the AI once so Aria can run right on your phone. It needs the internet this one time — Wi-Fi is best. After that, it works completely offline.',
  sizeNote: 'About 1.2 GB on iPhone · stays on your device',
};

// Qwen3 reasons inside <think>…</think>; show only the final answer.
function cleanThink(str) {
  if (!str) return str;
  let out = str.replace(/<think>[\s\S]*?<\/think>/g, '');
  const open = out.indexOf('<think>');
  if (open !== -1) out = out.slice(0, open);
  return out.replace(/^\s+/, '');
}

class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch() {}
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

/* The chat model loads ONCE and stays resident. Photos are handled by a small,
   lazily-mounted vision engine (classifier + OCR) that coexists with it. */
function ModelChat({ t, active, activeChatId, chats, persistMessages, onNewChat, onOpenChat, onDeleteChat }) {
  const { models, useLLMChatSession } = require('react-native-executorch');
  const smallLLM = models.llm.QWEN3_0_6B && (models.llm.QWEN3_0_6B.DEFAULT || models.llm.QWEN3_0_6B.XNNPACK_8DA4W);
  const MODEL = (Platform.OS === 'ios' && Platform.isPad && smallLLM) ? smallLLM : models.llm.QWEN3_1_7B.DEFAULT;
  const llm = useLLMChatSession(MODEL, {
    initialMessages: [{ role: 'system', content: SYSTEM_PROMPT }],
    generationConfig: { maxNewTokens: 512, temperature: 0.7 },
  });

  const [messages, setMessages] = useState(active.messages || []);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [attachedUri, setAttachedUri] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [visionArmed, setVisionArmed] = useState(false);
  const [visionStatus, setVisionStatus] = useState(null);
  const [visionReady, setVisionReady] = useState(false);
  const attachRef = useRef(null);
  const analyzeRef = useRef(null);

  useEffect(() => { setMessages(active.messages || []); setInput(''); clearAttach(); }, [activeChatId]);

  const commit = (next) => { setMessages(next); persistMessages(next); };
  function clearAttach() { attachRef.current = null; setAttachedUri(null); }

  const status = (() => {
    if (llm.error) return { state: 'unavailable', label: 'Could not load model' };
    if (!llm.isReady && (llm.downloadProgress || 0) < 1) return { state: 'downloading', progress: llm.downloadProgress || 0, label: `Downloading ${Math.round((llm.downloadProgress || 0) * 100)}%` };
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
      setVisionArmed(true);
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
      if (!visionReady || !analyzeRef.current) return; // send stays disabled until ready
      const uri = attachedUri;
      setInput('');
      clearAttach();
      const base = [...messages, { role: 'user', text: text || '', imageUri: uri }];
      commit([...base, { role: 'assistant', text: '', streaming: true }]);
      setGenerating(true);
      let reply = '';
      try { reply = await analyzeRef.current(img); }
      catch (e) { reply = 'Sorry, I couldn’t read that photo. Try another one.'; }
      commit([...base, { role: 'assistant', text: reply, streaming: false }]);
      setGenerating(false);
      return;
    }

    // Text → on-device LLM.
    if (!text || !llm.isReady || !llm.sendMessage) return;
    setInput('');
    const base = [...messages, { role: 'user', text }];
    commit([...base, { role: 'assistant', text: '', streaming: true }]);
    setGenerating(true);
    let acc = '';
    try {
      await llm.sendMessage(text, (tok) => {
        acc += tok;
        setMessages([...base, { role: 'assistant', text: cleanThink(acc), streaming: true }]);
      });
    } catch (e) {
      acc = acc || ('⚠️ ' + ((e && e.message) ? e.message : String(e)));
    }
    commit([...base, { role: 'assistant', text: cleanThink(acc) || acc, streaming: false }]);
    setGenerating(false);
  }, [input, generating, preparing, attachedUri, visionReady, messages, llm]);

  const onStop = useCallback(() => { try { llm.stop && llm.stop(); } catch (e) {} setGenerating(false); }, [llm]);

  const canSend = llm.isReady && !preparing && (attachRef.current ? visionReady : true);

  return (
    <>
      {visionArmed && (
        <VisionEngine
          onStatus={setVisionStatus}
          onReady={(fn) => { analyzeRef.current = fn; setVisionReady(true); }}
        />
      )}
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
      />
    </>
  );
}

function ChatsManager({ t }) {
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

  if (!chats || !activeId) return null;
  const active = chats.find((c) => c.id === activeId) || chats[0];

  return (
    <ModelChat
      t={t} active={active} activeChatId={activeId} chats={chats}
      persistMessages={persistMessages}
      onNewChat={onNewChat} onOpenChat={onOpenChat} onDeleteChat={onDeleteChat}
    />
  );
}

export default function ChatNative() {
  const t = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ENABLED_KEY).then((v) => { if (v === '1') setEnabled(true); setChecked(true); });
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
      <ChatsManager t={t} />
    </Boundary>
  );
}
