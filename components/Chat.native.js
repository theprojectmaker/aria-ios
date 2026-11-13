import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatUI from './ChatUI';
import VisionEngine, { pretty } from './visionEngine';
import { useTheme } from './theme';
import { loadChats, saveChats, newChat, titleFrom } from './chatStore';
import { usePrefs } from './prefs';
import { loadKnowledge, knowledgeReady, retrieve } from './knowledge';
import { route, calc, buildPrompt, parseThink, mathAnswer, SYSTEM_PROMPT, DEPTH } from './brain';
import { chainFor, catalogEntry, resolveConfig } from './catalog';
import { loadHandbook, searchHandbook } from './handbook';
import { initLibrary, libraryReady, librarySearch, libraryDefine } from './library';
import { definitionTarget } from './libsearch';
import { useAriaEngine } from './engine';
import { useModels, downloadedIds, markFailed, refreshModels } from './models';

const ENABLED_KEY = 'aria.ai.enabled.v1';

const DOWNLOAD = {
  title: 'Set up Aria',
  body: 'Aria downloads its AI once, then runs entirely on this device — private, and it works with no internet. Wi‑Fi is best for the first download.',
  sizeNote: 'About 1.2 GB · stays on your device',
};

class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(err) { if (this.props.onError) this.props.onError(err); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

// The conversation as the model should remember it: plain text of each
// finished turn (reference notes are only attached to the newest question).
function historyOf(messages) {
  const out = [];
  for (const m of messages) {
    if (m.streaming) continue;
    if (m.role === 'user') {
      const content = (m.imageUri ? '[I shared a photo] ' : '') + (m.text || '');
      if (content.trim()) out.push({ role: 'user', content, key: m.text || '[photo]' });
    } else if (m.role === 'assistant' && m.text && m.model !== 'Calculator') {
      out.push({ role: 'assistant', content: m.text });
    } else if (m.role === 'assistant' && m.model === 'Calculator') {
      out.push({ role: 'assistant', content: m.text });
    }
  }
  // The model expects user/assistant alternation; drop an unanswered user turn.
  return out.filter((m, i) => !(m.role === 'user' && out[i + 1] && out[i + 1].role === 'user'));
}

function ModelChat({ t, active, activeChatId, chats, persistMessages, onNewChat, onOpenChat, onDeleteChat, onClearChats, onSetChatModel }) {
  const { models } = require('react-native-executorch');
  const prefs = usePrefs();
  const modelState = useModels();
  const kbOn = prefs.knowledge !== 'off';
  const reasoning = prefs.reasoning || 'auto';

  // This chat's model: locked per chat, or Automatic (smartest downloaded model).
  const chatModel = active.model || 'auto';
  const CHAIN = chainFor(chatModel, 'auto', downloadedIds(), modelState.failed)
    .map(catalogEntry).filter(Boolean).filter((e) => resolveConfig(models, e));
  if (!CHAIN.length) CHAIN.push(catalogEntry('qwen3-1.7b'));
  const chainKey = CHAIN.map((e) => e.id).join(',');
  const [tier, setTier] = useState(0);
  const chainRef = useRef(chainKey);
  useEffect(() => { if (chainRef.current !== chainKey) { chainRef.current = chainKey; setTier(0); } }, [chainKey]);
  const entry = CHAIN[Math.min(tier, CHAIN.length - 1)];
  // Wait until we know what's downloaded, so Automatic doesn't load one model
  // and then immediately switch to a better one.
  const MODEL = modelState.loaded ? resolveConfig(models, entry) : undefined;
  const lean = entry.ram <= 2;
  const isPad = Platform.OS === 'ios' && Platform.isPad;

  const engine = useAriaEngine(MODEL, {
    system: lean ? '' : SYSTEM_PROMPT,
    generationConfig: { maxNewTokens: lean ? 320 : 1024, temperature: 0.65 },
  });

  // A model that fails to load here is remembered, and the chat steps down.
  useEffect(() => {
    if (engine.error) {
      markFailed(entry.id);
      if (tier < CHAIN.length - 1) setTier((x) => x + 1);
    }
  }, [engine.error]);
  useEffect(() => { if (engine.isReady) refreshModels(); }, [engine.isReady]);

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
  useEffect(() => { loadKnowledge(); loadHandbook(); initLibrary(); }, []);
  useEffect(() => {
    if (visionStatus && visionStatus.state === 'error') {
      setVisionFailed(true);
      if (visionStatus.detail) setVisionErr(visionStatus.detail);
    }
  }, [visionStatus]);

  const commit = (next) => { setMessages(next); persistMessages(next); };
  function clearAttach() { attachRef.current = null; setAttachedUri(null); }

  const atLast = tier >= CHAIN.length - 1;
  const dlFrac = Math.min(1, (engine.downloadProgress || 0) / 100); // executorch reports 0..100
  const errMsg = engine.error ? (engine.error.message || String(engine.error)) : '';
  const diag = `${Platform.OS}${isPad ? ' iPad' : ' phone'} · ${entry.base} (${Math.min(tier, CHAIN.length - 1) + 1}/${CHAIN.length}) · ${chatModel} · dl ${Math.round(dlFrac * 100)}%${errMsg ? ' · ' + errMsg.slice(0, 220) : ''}`;
  const status = (() => {
    if (engine.error && atLast) return { state: 'unavailable', label: 'Could not load model', detail: diag };
    if (engine.error) return { state: 'loading', label: 'Trying a lighter model…' };
    if (!engine.isReady && dlFrac < 1) return { state: 'downloading', progress: dlFrac, label: `Downloading ${entry.name} ${Math.round(dlFrac * 100)}%` };
    if (!engine.isReady) return { state: 'loading', label: `Loading ${entry.name}…` };
    if (preparing) return { state: 'ready', label: 'Reading photo…' };
    if (attachedUri && visionStatus && visionStatus.state === 'downloading') return { state: 'ready', label: `Preparing vision ${Math.round((visionStatus.progress || 0) * 100)}%` };
    if (attachedUri && !visionReady) return { state: 'ready', label: 'Preparing vision…' };
    return { state: 'ready', label: entry.name };
  })();
  status.detail = diag;
  status.model = entry;

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

  const pickImage = useCallback((mode) => {
    if (mode === 'camera' || mode === 'library') return capture(mode);
    Alert.alert('Add a photo', undefined, [
      { text: 'Take Photo', onPress: () => capture('camera') },
      { text: 'Choose Photo', onPress: () => capture('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [capture]);

  // One model turn for this chat, streamed into the last assistant message.
  // base = the chat including the new user message (last element).
  const runModel = async (base, prompt, { maxTokens, sources, kind, think: thinkOn }) => {
    const chatId = activeChatId;
    const history = historyOf(base.slice(0, -1));
    const userMsg = base[base.length - 1];
    const key = userMsg.text || '[photo]';
    const t0 = Date.now();
    let acc = '';
    let errored = null;
    try {
      await engine.send(chatId, history, prompt, (tok) => {
        acc += tok;
        const { think, answer } = parseThink(acc);
        setMessages([...base, { role: 'assistant', text: answer, think, streaming: true, sources, thinking: thinkOn }]);
      }, { maxNewTokens: lean ? 320 : maxTokens, key });
    } catch (e) { errored = e; }
    const { think, answer } = parseThink(acc);
    let text = answer;

    // Safety net: a real question that got an empty or few-word answer gets
    // one follow-up turn asking for the complete answer, thinking off.
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const wantsDepth = ['explain', 'reason', 'fact', 'worksheet'].includes(kind);
    if (!errored && !lean && wantsDepth && words < (kind === 'fact' ? 12 : 40)) {
      const ask2 = (words === 0
        ? 'Now write your complete answer to my question, using what you worked out. Do not stop early.'
        : 'That was too short. Please give a complete, detailed answer with the important facts, examples and context.')
        + (DEPTH[kind] ? ' ' + DEPTH[kind] : '') + (entry.think ? ' /no_think' : '');
      let acc2 = '';
      try {
        const h2 = historyOf([...base, { role: 'assistant', text: answer || '…' }]);
        await engine.send(chatId, h2, ask2, (tok) => {
          acc2 += tok;
          setMessages([...base, { role: 'assistant', text: parseThink(acc2).answer, think, streaming: true, sources }]);
        }, { maxNewTokens: 1400, key: '__expand__' });
        const better = parseThink(acc2).answer.trim();
        if (better.split(/\s+/).length > words) text = better;
      } catch (e) { /* keep the first answer */ }
    }

    if (errored) {
      const firstRun = !acc && messages.filter((m) => m.role === 'assistant').length === 0;
      text = (answer ? answer + '\n\n' : '') + (firstRun
        ? 'This model ran out of memory on this device. I’ll switch to a lighter one — ask again in a moment.'
        : 'Something went wrong while answering. Please ask again.');
      if (firstRun) { markFailed(entry.id); if (tier < CHAIN.length - 1) setTier((x) => x + 1); }
    } else if (!text.trim()) {
      text = think ? 'I didn’t finish that thought. Ask again, or turn on **Deep think** for tough questions.' : (acc || 'Sorry — I couldn’t come up with an answer.');
    }
    const secs = Math.max(0.1, (Date.now() - t0) / 1000);
    commit([...base, { role: 'assistant', text, think, streaming: false, sources, kind, model: entry.name, secs: Math.round(secs * 10) / 10 }]);
    setGenerating(false);
  };

  const gatherRefs = async (text, r) => {
    const refs = [];
    const want = lean ? 1 : 3;
    const cap = lean ? 420 : 760;
    if (!kbOn || r.kind === 'write') return refs;
    try {
      const word = definitionTarget(text);
      if (word) { const d = await libraryDefine(word); if (d) refs.push({ title: 'Dictionary: ' + d.word, text: String(d.definition).slice(0, cap) }); }
      if (r.kind !== 'chat' || word) {
        for (const h of searchHandbook(text, lean ? 1 : 2)) if (refs.length < want) refs.push({ title: h.title, text: String(h.text).slice(0, cap) });
        const more = want - refs.length;
        if (more > 0) {
          const hits = libraryReady() ? await librarySearch(text, more)
            : (knowledgeReady() ? retrieve(text, more).map((x) => ({ title: x.title, text: x.summary })) : []);
          for (const x of hits) if (!refs.find((y) => y.title === x.title)) refs.push({ title: x.title, text: String(x.text).slice(0, cap) });
        }
      }
    } catch (e) {}
    return refs;
  };

  const ask = async (text, base) => {
    const r = route(text, reasoning);
    if (r.kind === 'math') {
      const c = calc(text);
      if (c) { commit([...base, { role: 'assistant', text: mathAnswer(c), streaming: false, kind: 'math', model: 'Calculator' }]); return; }
    }
    if (!engine.isReady || !engine.send) return;
    commit([...base, { role: 'assistant', text: '', think: '', streaming: true, thinking: r.think }]);
    setGenerating(true);
    const refs = await gatherRefs(text, r);
    let c = calc(text);
    if (c && /^\d+\s*-\s*\d+$/.test(c.expr)) c = null; // phone numbers, year ranges, scores
    const prompt = buildPrompt({ text, refs, calc: c, think: r.think, canToggleThinking: entry.think, kind: r.kind });
    await runModel(base, prompt, { maxTokens: r.maxTokens, sources: refs.map((x) => x.title), kind: r.kind, think: r.think });
  };

  const onSend = useCallback(async () => {
    const text = input.trim();
    const img = attachRef.current;
    if (generating || preparing) return;

    if (img) {
      if (!visionFailed && (!visionReady || !analyzeRef.current)) return;
      const uri = attachedUri;
      setInput(''); clearAttach();
      const base = [...messages, { role: 'user', text: text || '', imageUri: uri }];
      if (visionFailed || !analyzeRef.current) {
        const why = visionErr ? ` (${String(visionErr).slice(0, 160)})` : '';
        commit([...base, { role: 'assistant', text: `I couldn’t start the photo reader${why}. Chat still works — ask me anything.`, streaming: false }]);
        return;
      }
      commit([...base, { role: 'assistant', text: '', think: '', streaming: true }]);
      setGenerating(true);
      let facts;
      try { facts = await analyzeRef.current(img); }
      catch (e) {
        commit([...base, { role: 'assistant', text: `Sorry, I couldn’t read that photo (${String((e && e.message) || e).slice(0, 160)}). Try another one.`, streaming: false }]);
        setGenerating(false); return;
      }
      if (!engine.isReady || !engine.send) { commit([...base, { role: 'assistant', text: facts.summary, streaming: false }]); setGenerating(false); return; }

      const lines = (facts.textLines || []).map((x) => (x && x.text ? x.text.trim() : '')).filter(Boolean);
      const ocrText = lines.join('\n');
      const tops = (facts.labels || []).filter((x) => x && x.confidence > 0.04).slice(0, 5);
      const isDocument = lines.length >= 2 || ocrText.replace(/\s/g, '').length >= 24;
      let prompt; let kind; let maxTokens;
      if (isDocument) {
        kind = 'worksheet'; maxTokens = 2048;
        prompt =
          'The user photographed a worksheet, problem set or document. Text read from it by OCR (may contain small recognition errors — silently fix obvious ones like 0/O or l/1):\n"""\n' +
          ocrText.slice(0, 2400) + '\n"""\n\n' +
          (text ? 'The user asks: ' + text + '\nAnswer using the text above.'
            : 'Work through it. For EACH question or problem, give the answer clearly, numbered to match (e.g. "1. ..."), with brief working for math or science. If a part is unreadable, say which. Be accurate.');
        const c = calc(ocrText.length < 160 ? ocrText : '');
        if (c) prompt += `\n\nVerified calculation (exact): ${c.expr} = ${c.display}`;
        if (entry.think) prompt += ' /think';
      } else {
        kind = 'photo'; maxTokens = 600;
        const detected = [];
        if (tops.length) detected.push('Objects most likely in the photo: ' + tops.map((x) => `${pretty(x.label)} (${Math.round(x.confidence * 100)}%)`).join(', ') + '.');
        if (ocrText) detected.push('Text read in the photo: "' + ocrText.slice(0, 200) + '".');
        if (!detected.length) detected.push('No clear objects or text could be detected.');
        prompt = 'The user shared a photo. An on-device vision system analyzed it and found:\n' + detected.join('\n') +
          '\n\nThese detections can be imperfect. Using them, answer naturally. If they asked a question, answer it; otherwise describe what\'s in the photo. Do not mention "detections" or percentages unless useful.\n\nUser: ' + (text || 'What is in this photo?');
        if (entry.think) prompt += ' /no_think';
      }
      await runModel(base, prompt, { maxTokens, sources: [], kind, think: isDocument });
      return;
    }

    if (!text || !engine.isReady || !engine.send) return;
    setInput('');
    await ask(text, [...messages, { role: 'user', text }]);
  }, [input, generating, preparing, attachedUri, visionReady, visionFailed, visionErr, messages, engine, kbOn, reasoning, lean, entry, activeChatId]);

  const onRegenerate = useCallback(async (index) => {
    if (generating) return;
    const prior = messages.slice(0, index);
    const lastUser = [...prior].reverse().find((m) => m.role === 'user');
    if (!lastUser || !lastUser.text || lastUser.imageUri) return;
    await ask(lastUser.text, prior);
  }, [messages, generating, engine, kbOn, reasoning, lean, entry, activeChatId]);

  const onStop = useCallback(() => { try { engine.stop && engine.stop(); } catch (e) {} setGenerating(false); }, [engine]);
  const canSend = engine.isReady && !preparing && (attachRef.current ? (visionReady || visionFailed) : true);

  return (
    <>
      {visionArmed && (
        <Boundary fallback={null} onError={(e) => { setVisionFailed(true); setVisionErr((e && (e.message || String(e))) || 'vision crashed'); }}>
          <VisionEngine onStatus={setVisionStatus} onReady={(fn) => { analyzeRef.current = fn; setVisionReady(true); }} />
        </Boundary>
      )}
      <ChatUI
        t={t} messages={messages} input={input} setInput={setInput}
        onSend={onSend} onStop={onStop} onRegenerate={onRegenerate} generating={generating}
        status={status} onDownload={() => {}} onPickExample={(ex) => setInput(ex)}
        onPickImage={pickImage} attachedUri={attachedUri} onClearImage={clearAttach}
        canSend={canSend} title={active.title} download={DOWNLOAD}
        chats={chats} activeChatId={activeChatId}
        onNewChat={onNewChat} onOpenChat={onOpenChat} onDeleteChat={onDeleteChat} onClearChats={onClearChats}
        chatModel={chatModel} onSetChatModel={(id) => onSetChatModel(activeChatId, id)}
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

  const onNewChat = useCallback(() => {
    const cur = chatsRef.current.find((c) => c.id === activeIdRef.current);
    if (cur && (!cur.messages || cur.messages.length === 0)) return; // already on an empty chat
    const c = newChat(); setChats((cs) => [c, ...(cs || [])]); setActiveId(c.id);
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
  const onClearChats = useCallback(() => { const c = newChat(); setChats([c]); setActiveId(c.id); saveChats([c]); }, []);
  const onSetChatModel = useCallback((chatId, model) => {
    const next = chatsRef.current.map((c) => (c.id === chatId ? { ...c, model } : c));
    setChats(next); saveChats(next);
  }, []);

  if (!chats || !activeId) return null;
  const active = chats.find((c) => c.id === activeId) || chats[0];

  return (
    <ModelChat
      t={t} active={active} activeChatId={activeId} chats={chats}
      persistMessages={persistMessages}
      onNewChat={onNewChat} onOpenChat={onOpenChat} onDeleteChat={onDeleteChat} onClearChats={onClearChats}
      onSetChatModel={onSetChatModel}
    />
  );
}

export default function ChatNative() {
  const t = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ENABLED_KEY)
      .then((en) => { if (en === '1') setEnabled(true); setChecked(true); })
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
      <ChatsManager t={t} />
    </Boundary>
  );
}
