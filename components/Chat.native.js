import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatUI from './ChatUI';
import VisionEngine, { pretty } from './visionEngine';
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
  componentDidCatch(err) { if (this.props.onError) this.props.onError(err); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

/* The chat model loads ONCE and stays resident. Photos are handled by a small,
   lazily-mounted vision engine (classifier + OCR) that coexists with it. */
function ModelChat({ t, active, activeChatId, chats, persistMessages, onNewChat, onOpenChat, onDeleteChat, onClearChats, startSafe }) {
  const { models, useLLMChatSession } = require('react-native-executorch');
  const { model: pref } = usePrefs();
  const dflt = (m) => (m && (m.DEFAULT || m.XNNPACK_8DA4W)) || null;
  const small = dflt(models.llm.QWEN3_0_6B) || models.llm.QWEN3_1_7B.DEFAULT; // ~0.5 GB
  const mid = models.llm.QWEN3_1_7B.DEFAULT;                                   // ~1.2 GB
  const huge = dflt(models.llm.QWEN3_4B) || mid;                               // ~2.8 GB, smartest
  // Tiny models that still load on a genuinely low-RAM device (e.g. 3 GB iPad).
  const tinyA = dflt(models.llm.SMOLLM2_360M) || dflt(models.llm.LFM2_5_350M) || small;
  const tinyB = dflt(models.llm.SMOLLM2_135M) || tinyA;
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  // One chain per preference: try the chosen model, then smaller ones if the
  // device can't load/run it (OOM surfaces as llm.error and we drop a rung).
  // iPads are NOT special-cased any more — a modern iPad (e.g. 11th gen) has
  // plenty of RAM, so it gets the same real models and only falls back if it
  // genuinely can't fit one.
  const chainFor = (p) => {
    if (p === 'light') return [small, tinyA];
    if (p === 'balanced') return [mid, small, tinyA];
    if (p === 'smart') return [huge, mid, small, tinyA]; // 4B, degrades if it won't fit
    return [mid, small, tinyA, tinyB];                   // auto: strong default, tiny floor
  };
  const CHAIN = chainFor(pref);
  const safeStart = Math.max(0, CHAIN.indexOf(small)); // a device flagged weak starts at 0.6B, not 135M
  const [tier, setTier] = useState((startSafe && pref === 'auto') ? safeStart : 0);
  const prefRef = useRef(pref);
  useEffect(() => { if (prefRef.current !== pref) { prefRef.current = pref; setTier(0); } }, [pref]);
  const MODEL = CHAIN[Math.min(tier, CHAIN.length - 1)];
  // Only trim memory once we've fallen back to a tiny model (a weak device).
  // Capable devices — modern iPads included — get the full system prompt and
  // longer answers.
  const lean = MODEL === tinyA || MODEL === tinyB;
  const llm = useLLMChatSession(MODEL, {
    initialMessages: lean ? [] : [{ role: 'system', content: SYSTEM_PROMPT }],
    generationConfig: { maxNewTokens: lean ? 320 : 1024, temperature: 0.7 },
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
  const [visionErr, setVisionErr] = useState('');
  const [visionArmed, setVisionArmed] = useState(false);
  const attachRef = useRef(null);
  const analyzeRef = useRef(null);

  useEffect(() => { setMessages(active.messages || []); setInput(''); clearAttach(); }, [activeChatId]);

  // Vision models failing to load (an .error, not a thrown render error) is also a
  // failure — mark it so the photo send reports the real reason instead of hanging.
  useEffect(() => {
    if (visionStatus && visionStatus.state === 'error') {
      setVisionFailed(true);
      if (visionStatus.detail) setVisionErr(visionStatus.detail);
    }
  }, [visionStatus]);

  const commit = (next) => { setMessages(next); persistMessages(next); };
  function clearAttach() { attachRef.current = null; setAttachedUri(null); }

  const atLast = tier >= CHAIN.length - 1;
  const dlFrac = Math.min(1, (llm.downloadProgress || 0) / 100); // executorch reports 0..100
  const errMsg = llm.error ? (llm.error.message || String(llm.error)) : '';
  const diag = `${Platform.OS}${isPad ? ' iPad' : ' phone'} · model ${Math.min(tier, CHAIN.length - 1) + 1}/${CHAIN.length} · ${pref} · dl ${Math.round(dlFrac * 100)}%${errMsg ? ' · ' + errMsg.slice(0, 220) : ''}`;
  const status = (() => {
    if (llm.error && atLast) return { state: 'unavailable', label: 'Could not load model', detail: diag };
    if (llm.error) return { state: 'loading', label: 'Trying a lighter model…' };
    if (!llm.isReady && dlFrac < 1) return { state: 'downloading', progress: dlFrac, label: `${tier > 0 ? 'Lighter model ' : 'Downloading '}${Math.round(dlFrac * 100)}%` };
    if (!llm.isReady) return { state: 'loading', label: 'Getting ready…' };
    if (preparing) return { state: 'ready', label: 'Reading photo…' };
    if (attachedUri && visionStatus && visionStatus.state === 'downloading') return { state: 'ready', label: `Preparing vision ${Math.round((visionStatus.progress || 0) * 100)}%` };
    if (attachedUri && !visionReady) return { state: 'ready', label: 'Preparing vision…' };
    return { state: 'ready', label: 'On-device · ready' };
  })();
  status.detail = diag; // long-press the header status, or the error card, to copy this

  const capture = useCallback(async (mode) => {
    try {
      const IP = require('expo-image-picker');
      if (mode === 'camera') { const p = await IP.requestCameraPermissionsAsync(); if (!p.granted) return; }
      const res = mode === 'camera'
        ? await IP.launchCameraAsync({ quality: 1 })
        : await IP.launchImageLibraryAsync({ mediaTypes: (IP.MediaTypeOptions && IP.MediaTypeOptions.Images) || 'images', quality: 1 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const uri = res.assets[0].uri;
      setVisionArmed(true); // load the vision models only now, so they don't fight the chat model for memory
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

    // Photo → read it with on-device vision, then let the chat model answer.
    if (img) {
      if (!visionFailed && (!visionReady || !analyzeRef.current)) return; // wait until ready
      const uri = attachedUri;
      setInput('');
      clearAttach();
      const base = [...messages, { role: 'user', text: text || '', imageUri: uri }];

      // Vision engine never started — say so honestly instead of hanging.
      if (visionFailed || !analyzeRef.current) {
        const why = visionErr ? ` (${String(visionErr).slice(0, 160)})` : '';
        const reply = `I couldn’t start the photo reader${why}. Chat still works — ask me anything.`;
        commit([...base, { role: 'assistant', text: reply, streaming: false }]);
        return;
      }

      commit([...base, { role: 'assistant', text: '', think: '', streaming: true }]);
      setGenerating(true);

      let facts;
      try { facts = await analyzeRef.current(img); }
      catch (e) {
        commit([...base, { role: 'assistant', text: `Sorry, I couldn’t read that photo (${String((e && e.message) || e).slice(0, 160)}). Try another one.`, streaming: false }]);
        setGenerating(false);
        return;
      }

      // No chat model ready → fall back to the plain detection summary.
      if (!llm.isReady || !llm.sendMessage) {
        commit([...base, { role: 'assistant', text: facts.summary, streaming: false }]);
        setGenerating(false);
        return;
      }

      // Turn the raw detections into a factual brief and let the LLM answer
      // naturally (and field follow-up questions — the facts stay in context).
      const detected = [];
      const tops = (facts.labels || []).filter((c) => c && c.confidence > 0.04).slice(0, 5);
      if (tops.length) detected.push('Objects most likely in the photo: ' + tops.map((c) => `${pretty(c.label)} (${Math.round(c.confidence * 100)}%)`).join(', ') + '.');
      const lines = (facts.textLines || []).map((r) => (r && r.text ? r.text.trim() : '')).filter(Boolean);
      if (lines.length) detected.push('Text read in the photo: "' + lines.slice(0, 20).join(' ') + '".');
      if (!detected.length) detected.push('No clear objects or text could be detected.');
      const q = text || 'Briefly describe this photo for me.';
      const prompt =
        'The user shared a photo. An on-device vision system analyzed it and found:\n' +
        detected.join('\n') +
        '\n\nThese detections can be imperfect. Using them, answer the user naturally and concisely. ' +
        "If they asked a question, answer it; otherwise describe what's in the photo. " +
        'Do not mention "detections", confidence, or percentages unless it helps.\n\nUser: ' + q;

      let acc = '';
      let errored = false;
      try {
        await llm.sendMessage(prompt, (tok) => {
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
      if (!errored && !finalAnswer.trim()) finalAnswer = facts.summary; // fall back to the plain read
      commit([...base, { role: 'assistant', text: finalAnswer, think, streaming: false }]);
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
  }, [input, generating, preparing, attachedUri, visionReady, visionFailed, visionErr, messages, llm]);

  const onStop = useCallback(() => { try { llm.stop && llm.stop(); } catch (e) {} setGenerating(false); }, [llm]);

  const canSend = llm.isReady && !preparing && (attachRef.current ? (visionReady || visionFailed) : true);

  return (
    <>
      {/* Vision loads only once a photo is added, so the CV models never fight
          the chat model for memory (critical on low-RAM iPads). Its own error
          boundary keeps a vision failure from ever taking down the chat. */}
      {visionArmed && (
        <Boundary fallback={null} onError={(e) => { setVisionFailed(true); setVisionErr((e && (e.message || String(e))) || 'vision crashed'); }}>
          <VisionEngine
            onStatus={setVisionStatus}
            onReady={(fn) => { analyzeRef.current = fn; setVisionReady(true); }}
          />
        </Boundary>
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
