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
import { chainIds, catalogEntry, resolveConfig, normalizeModelPref } from './catalog';
import { loadHandbook, searchHandbook } from './handbook';
import { initLibrary, libraryReady, librarySearch, libraryDefine } from './library';
import { definitionTarget } from './libsearch';

const ENABLED_KEY = 'aria.ai.enabled.v1';

const DOWNLOAD = {
  title: 'Set up Aria',
  body: 'Aria downloads its AI once, then runs entirely on this device — private, and it works with no internet. Wi‑Fi is best for the first download.',
  sizeNote: 'About 1.2 GB · stays on your device',
};

// Model-side memory: the engine keeps every turn in its KV cache and offers no
// way to trim it, so a long conversation eventually overflows the context and
// every later message fails. We restart the session (cheap: files are on disk)
// once it gets long, carrying a short recap of the visible chat forward.
const MAX_MODEL_TURNS = 12;

class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(err) { if (this.props.onError) this.props.onError(err); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

function recapOf(messages) {
  const last = messages.filter((m) => m.text && !m.streaming).slice(-4);
  if (!last.length) return '';
  return 'Earlier in this conversation:\n' + last.map((m) => `${m.role === 'user' ? 'User' : 'Aria'}: ${String(m.text).replace(/\s+/g, ' ').slice(0, 280)}`).join('\n') + '\n\n';
}

function ModelChat({ t, active, activeChatId, chats, persistMessages, onNewChat, onOpenChat, onDeleteChat, onClearChats, startSafe, onResetSession, carryRecap }) {
  const { models, useLLMChatSession } = require('react-native-executorch');
  const prefs = usePrefs();
  const pref = normalizeModelPref(prefs.model);
  const kbOn = prefs.knowledge !== 'off';
  const reasoning = prefs.reasoning || 'auto';

  const CHAIN = chainIds(pref).map(catalogEntry).filter(Boolean).filter((e) => resolveConfig(models, e));
  const safeStart = Math.max(0, CHAIN.findIndex((e) => e.id === 'qwen3-0.6b'));
  const [tier, setTier] = useState((startSafe && pref === 'auto') ? safeStart : 0);
  const prefRef = useRef(pref);
  useEffect(() => { if (prefRef.current !== pref) { prefRef.current = pref; setTier(0); } }, [pref]);
  if (!CHAIN.length) CHAIN.push(catalogEntry('qwen3-1.7b'));
  const entry = CHAIN[Math.min(tier, CHAIN.length - 1)];
  const MODEL = resolveConfig(models, entry);
  const lean = entry.ram <= 2;
  const isPad = Platform.OS === 'ios' && Platform.isPad;

  const llm = useLLMChatSession(MODEL, {
    initialMessages: lean ? [] : [{ role: 'system', content: SYSTEM_PROMPT }],
    generationConfig: { maxNewTokens: lean ? 320 : 1024, temperature: 0.65 },
  });

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
  const recapRef = useRef(carryRecap || '');
  const turnsRef = useRef(0);
  const firstChat = useRef(activeChatId);

  useEffect(() => {
    setMessages(active.messages || []); setInput(''); clearAttach();
    // Switching to another chat: the model still remembers the previous one, so
    // give it this chat's recap with the next message instead.
    if (activeChatId !== firstChat.current) { firstChat.current = activeChatId; recapRef.current = recapOf(active.messages || []); }
  }, [activeChatId]);

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
  const dlFrac = Math.min(1, (llm.downloadProgress || 0) / 100); // executorch reports 0..100
  const errMsg = llm.error ? (llm.error.message || String(llm.error)) : '';
  const diag = `${Platform.OS}${isPad ? ' iPad' : ' phone'} · ${entry.base} (${Math.min(tier, CHAIN.length - 1) + 1}/${CHAIN.length}) · ${pref} · dl ${Math.round(dlFrac * 100)}%${errMsg ? ' · ' + errMsg.slice(0, 220) : ''}`;
  const status = (() => {
    if (llm.error && atLast) return { state: 'unavailable', label: 'Could not load model', detail: diag };
    if (llm.error) return { state: 'loading', label: 'Trying a lighter model…' };
    if (!llm.isReady && dlFrac < 1) return { state: 'downloading', progress: dlFrac, label: `Downloading ${entry.name} ${Math.round(dlFrac * 100)}%`, model: entry };
    if (!llm.isReady) return { state: 'loading', label: 'Getting ready…', model: entry };
    if (preparing) return { state: 'ready', label: 'Reading photo…' };
    if (attachedUri && visionStatus && visionStatus.state === 'downloading') return { state: 'ready', label: `Preparing vision ${Math.round((visionStatus.progress || 0) * 100)}%` };
    if (attachedUri && !visionReady) return { state: 'ready', label: 'Preparing vision…' };
    return { state: 'ready', label: entry.name + ' · on-device' };
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

  // Stream one model turn into the last assistant message.
  const runModel = async (base, prompt, { maxTokens, sources, kind }) => {
    let fullPrompt = prompt;
    if (recapRef.current) { fullPrompt = recapRef.current + prompt; recapRef.current = ''; }
    const t0 = Date.now();
    let acc = '';
    let errored = null;
    try {
      await llm.sendMessage(fullPrompt, (tok) => {
        acc += tok;
        const { think, answer } = parseThink(acc);
        setMessages([...base, { role: 'assistant', text: answer, think, streaming: true, sources }]);
      }, { maxNewTokens: lean ? 320 : maxTokens });
    } catch (e) { errored = e; }
    turnsRef.current += 1;
    const { think, answer } = parseThink(acc);
    let text = answer;

    // Safety net: a real question that got an empty or few-word answer (the
    // model spent its budget thinking, or was too terse) gets one follow-up
    // turn asking for the full answer, with thinking switched off.
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const wantsDepth = ['explain', 'reason', 'fact', 'worksheet'].includes(kind);
    if (!errored && !lean && wantsDepth && words < (kind === 'fact' ? 12 : 40)) {
      const ask2 = (words === 0
        ? 'Now write your complete answer to my question, using what you worked out. Do not stop early.'
        : 'That was too short. Please give a complete, detailed answer with the important facts, examples and context.')
        + (DEPTH[kind] ? ' ' + DEPTH[kind] : '') + (entry.think ? ' /no_think' : '');
      let acc2 = '';
      try {
        await llm.sendMessage(ask2, (tok) => {
          acc2 += tok;
          const p = parseThink(acc2);
          setMessages([...base, { role: 'assistant', text: p.answer, think, streaming: true, sources }]);
        }, { maxNewTokens: 1400 });
        turnsRef.current += 1;
        const better = parseThink(acc2).answer.trim();
        if (better.split(/\s+/).length > words) text = better;
      } catch (e) { /* keep the first answer */ }
    }

    if (errored) {
      const short = turnsRef.current <= 1 && !acc;
      text = (answer ? answer + '\n\n' : '') + (short
        ? 'I ran out of memory on that one. Try a lighter model in Settings → Model, or ask again.'
        : '_I reached my memory limit for this conversation, so I’m refreshing — ask again and I’ll pick up from here._');
    } else if (!text.trim()) {
      text = think ? 'I didn’t finish that thought in time. Ask again, or switch on **Think harder** for tough questions.' : (acc || 'Sorry — I couldn’t come up with an answer.');
    }
    const secs = Math.max(0.1, (Date.now() - t0) / 1000);
    const final = [...base, { role: 'assistant', text, think, streaming: false, sources, kind, model: entry.name, secs: Math.round(secs * 10) / 10 }];
    commit(final);
    setGenerating(false);
    if (errored || turnsRef.current >= MAX_MODEL_TURNS) {
      if (errored && turnsRef.current <= 1 && tier < CHAIN.length - 1) setTier((x) => x + 1);
      else onResetSession(recapOf(final));
    }
  };

  const ask = async (text, base) => {
    const r = route(text, reasoning);
    if (r.kind === 'math') {
      const c = calc(text);
      if (c) { commit([...base, { role: 'assistant', text: mathAnswer(c), streaming: false, kind: 'math', model: 'Calculator' }]); return; }
    }
    if (!llm.isReady || !llm.sendMessage) return;
    commit([...base, { role: 'assistant', text: '', think: '', streaming: true }]);
    setGenerating(true);
    // Grounding, most exact first: dictionary (for "define X"), the Handbook
    // (formulas, rules, tables), then the downloaded Library, else the
    // built-in encyclopedia.
    const refs = [];
    const want = lean ? 1 : 3;
    const cap = lean ? 420 : 760;
    if (kbOn && r.kind !== 'write') {
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
    }
    let c = calc(text);
    if (c && /^\d+\s*-\s*\d+$/.test(c.expr)) c = null; // phone numbers, year ranges, scores
    const prompt = buildPrompt({ text, refs, calc: c, think: r.think, canToggleThinking: entry.think, kind: r.kind });
    await runModel(base, prompt, { maxTokens: r.maxTokens, sources: refs.map((x) => x.title), kind: r.kind });
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
      if (!llm.isReady || !llm.sendMessage) { commit([...base, { role: 'assistant', text: facts.summary, streaming: false }]); setGenerating(false); return; }

      const lines = (facts.textLines || []).map((x) => (x && x.text ? x.text.trim() : '')).filter(Boolean);
      const ocrText = lines.join('\n');
      const tops = (facts.labels || []).filter((x) => x && x.confidence > 0.04).slice(0, 5);
      const isDocument = lines.length >= 2 || ocrText.replace(/\s/g, '').length >= 24;
      let prompt; let kind; let maxTokens;
      if (isDocument) {
        kind = 'worksheet'; maxTokens = 1536;
        prompt =
          'The user photographed a worksheet, problem set or document. Text read from it by OCR (may contain small recognition errors — silently fix obvious ones like 0/O or l/1):\n"""\n' +
          ocrText.slice(0, 2400) + '\n"""\n\n' +
          (text ? 'The user asks: ' + text + '\nAnswer using the text above.'
            : 'Work through it. For EACH question or problem, give the answer clearly, numbered to match (e.g. "1. ..."), with brief working for math or science. If a part is unreadable, say which. Be accurate and concise.');
        const c = calc(ocrText.length < 160 ? ocrText : '');
        if (c) prompt += `\n\nVerified calculation (exact): ${c.expr} = ${c.display}`;
        if (entry.think) prompt += ' /think';
      } else {
        kind = 'photo'; maxTokens = 500;
        const detected = [];
        if (tops.length) detected.push('Objects most likely in the photo: ' + tops.map((x) => `${pretty(x.label)} (${Math.round(x.confidence * 100)}%)`).join(', ') + '.');
        if (ocrText) detected.push('Text read in the photo: "' + ocrText.slice(0, 200) + '".');
        if (!detected.length) detected.push('No clear objects or text could be detected.');
        prompt = 'The user shared a photo. An on-device vision system analyzed it and found:\n' + detected.join('\n') +
          '\n\nThese detections can be imperfect. Using them, answer naturally and concisely. If they asked a question, answer it; otherwise describe what\'s in the photo. Do not mention "detections" or percentages unless useful.\n\nUser: ' + (text || 'What is in this photo?');
        if (entry.think) prompt += ' /no_think';
      }
      await runModel(base, prompt, { maxTokens, sources: [], kind });
      return;
    }

    if (!text || !llm.isReady || !llm.sendMessage) return;
    setInput('');
    await ask(text, [...messages, { role: 'user', text }]);
  }, [input, generating, preparing, attachedUri, visionReady, visionFailed, visionErr, messages, llm, kbOn, reasoning, lean, entry]);

  // Ask the same question again for a fresh answer.
  const onRegenerate = useCallback(async (index) => {
    if (generating) return;
    const prior = messages.slice(0, index);
    const lastUser = [...prior].reverse().find((m) => m.role === 'user');
    if (!lastUser || !lastUser.text || lastUser.imageUri) return;
    await ask(lastUser.text, prior);
  }, [messages, generating, llm, kbOn, reasoning, lean, entry]);

  const onStop = useCallback(() => { try { llm.stop && llm.stop(); } catch (e) {} setGenerating(false); }, [llm]);

  const canSend = llm.isReady && !preparing && (attachRef.current ? (visionReady || visionFailed) : true);

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
      />
    </>
  );
}

function ChatsManager({ t, safe }) {
  const [chats, setChats] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [session, setSession] = useState({ key: 0, recap: '' });
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
  const onResetSession = useCallback((recap) => setSession((s) => ({ key: s.key + 1, recap: recap || '' })), []);

  if (!chats || !activeId) return null;
  const active = chats.find((c) => c.id === activeId) || chats[0];

  return (
    <ModelChat
      key={session.key}
      t={t} active={active} activeChatId={activeId} chats={chats}
      persistMessages={persistMessages} startSafe={safe}
      onNewChat={onNewChat} onOpenChat={onOpenChat} onDeleteChat={onDeleteChat} onClearChats={onClearChats}
      onResetSession={onResetSession} carryRecap={session.recap}
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
