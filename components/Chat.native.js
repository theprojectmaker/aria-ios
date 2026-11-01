import React, { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import ChatUI from './ChatUI';
import { useTheme } from './theme';
import { loadChats, saveChats, newChat, titleFrom } from './chatStore';

const ENABLED_KEY = 'aria.ai.enabled.v1';

const SYSTEM_PROMPT =
  "You are Aria, a helpful, friendly AI assistant running privately on the user's phone, with no internet. " +
  "Give clear, direct, and accurate answers. Think it through, then answer. Keep it concise unless the user asks for detail. " +
  "If you are unsure or don't know, say so honestly rather than making something up.";

const CHAT_EXAMPLES = [
  'Explain quantum entanglement like I’m five.',
  'Write a warm, short thank-you note to a mentor.',
  'Give me 5 dinner ideas with chicken and rice.',
  'Help me outline a 3-paragraph cover letter.',
];

const CHAT_DOWNLOAD = {
  title: 'Set up Aria',
  body: 'Download the AI model once so Aria can run right on your phone. It needs the internet this one time — Wi-Fi is best. After that, it works completely offline.',
  sizeNote: 'About 1.2 GB on iPhone · stored on your device',
};

// Qwen3 reasons inside <think>…</think>; show only the final answer.
function cleanThink(s) {
  if (!s) return s;
  let out = s.replace(/<think>[\s\S]*?<\/think>/g, '');
  const open = out.indexOf('<think>');
  if (open !== -1) out = out.slice(0, open); // still thinking — hide the rest
  return out.replace(/^\s+/, '');
}

class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch() {}
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

/* The model is loaded ONCE here and never reloaded (reloading a model on a
   phone can run it out of memory -> "can't load"). Switching chats only swaps
   the on-screen transcript; the model stays resident. */
function ModelChat({ t, active, activeChatId, chats, persistMessages, onNewChat, onOpenChat, onDeleteChat }) {
  const { models, useLLMChatSession } = require('react-native-executorch');
  // iPads tend to have less usable RAM than iPhones and the full 1.7B model gets killed on load,
  // so fall back to the much smaller Qwen3-0.6B there (weaker, but it actually loads).
  const smallLLM = models.llm.QWEN3_0_6B && (models.llm.QWEN3_0_6B.DEFAULT || models.llm.QWEN3_0_6B.XNNPACK_8DA4W);
  const MODEL = (Platform.OS === 'ios' && Platform.isPad && smallLLM) ? smallLLM : models.llm.QWEN3_1_7B.DEFAULT;
  const llm = useLLMChatSession(MODEL, {
    initialMessages: [{ role: 'system', content: SYSTEM_PROMPT }],
    generationConfig: { maxNewTokens: 512, temperature: 0.7 },
  });

  const [messages, setMessages] = useState(active.messages || []);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);

  // show the active chat's transcript (model is NOT reloaded on switch)
  useEffect(() => { setMessages(active.messages || []); setInput(''); }, [activeChatId]);

  const status = (() => {
    if (llm.error) return { state: 'unavailable', label: 'Could not load model' };
    if (!llm.isReady && (llm.downloadProgress || 0) < 1) return { state: 'downloading', progress: llm.downloadProgress || 0, label: `Downloading ${Math.round((llm.downloadProgress || 0) * 100)}%` };
    if (!llm.isReady) return { state: 'loading', label: 'Loading model…' };
    return { state: 'ready', label: 'On-device · ready' };
  })();

  const commit = (next) => { setMessages(next); persistMessages(next); };

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || generating || !llm.isReady || !llm.sendMessage) return;
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
  }, [input, generating, messages, llm]);

  const onStop = useCallback(() => { try { llm.stop && llm.stop(); } catch (e) {} setGenerating(false); }, [llm]);

  return (
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
      canSend={llm.isReady}
      title={active.title}
      greetTitle="How can I help?"
      examples={CHAT_EXAMPLES}
      download={CHAT_DOWNLOAD}
      chats={chats}
      activeChatId={activeChatId}
      onNewChat={onNewChat}
      onOpenChat={onOpenChat}
      onDeleteChat={onDeleteChat}
    />
  );
}

function ChatsManager({ t }) {
  const [chats, setChats] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const chatsRef = useRef([]);
  const activeIdRef = useRef(null);
  chatsRef.current = chats || [];
  activeIdRef.current = activeId;
  // Unload the chat model while the Vision tab is open (it loads its own vision
  // model) — the phone holds only one heavy model at a time.
  const path = usePathname() || '';
  const onHeavy = path.startsWith('/vision');

  useEffect(() => {
    (async () => {
      let list = await loadChats();
      if (list.length === 0) { const c = newChat(); list = [c]; await saveChats(list); }
      setChats(list);
      setActiveId(list[0].id);
    })();
  }, []);

  // stable so a send always writes to the chat that is active right now
  const persistMessages = useCallback((msgs) => {
    const next = chatsRef.current.map((c) => c.id === activeIdRef.current
      ? { ...c, messages: msgs, title: (!c.title || c.title === 'New chat') ? titleFrom(msgs) : c.title, updatedAt: Date.now() }
      : c);
    next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    setChats(next); saveChats(next);
  }, []);

  const onNewChat = useCallback(() => {
    const c = newChat();
    setChats((cs) => [c, ...(cs || [])]);
    setActiveId(c.id);
  }, []);
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

  if (onHeavy) {
    return (
      <ChatUI
        t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
        generating={false} status={{ state: 'loading', label: 'Paused — freeing memory' }}
        onDownload={() => {}} onPickExample={() => {}}
        title={active.title} chats={chats} activeChatId={activeId}
        onNewChat={onNewChat} onOpenChat={onOpenChat} onDeleteChat={onDeleteChat}
      />
    );
  }

  return (
    <ModelChat
      t={t}
      active={active}
      activeChatId={activeId}
      chats={chats}
      persistMessages={persistMessages}
      onNewChat={onNewChat}
      onOpenChat={onOpenChat}
      onDeleteChat={onDeleteChat}
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
        generating={false} status={{ state: 'needs-download', label: 'Model not downloaded' }}
        onDownload={enable} onPickExample={() => {}} download={CHAT_DOWNLOAD}
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
