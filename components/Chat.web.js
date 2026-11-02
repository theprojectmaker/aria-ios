import { useState, useRef, useEffect } from 'react';
import ChatUI from './ChatUI';
import { useTheme } from './theme';
import { newChat, titleFrom } from './chatStore';

const DEMO_REPLY =
  "Here's a **preview** of Aria. On your phone I run completely on-device — no internet — and I can:\n\n- answer questions and help you write\n- look at a **photo** and tell you what's in it or read its text\n- keep your **saved chats**\n\nInstall Aria to use the real offline AI.";

const DEMO_THINK =
  "The user wants quick dinner ideas. I should give a few simple, common options that are fast to make and use everyday ingredients, then keep it short.";

const DEMO_VISION =
  "I can see **lakeside** (86% sure) — it might also be valley, mountain, seashore.\n\n**Text I can read:**\nNORTH TRAIL\n2.4 mi";

const DEMO_IMG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='160' height='160' fill='#CFD6DA'/><rect y='104' width='160' height='56' fill='#9AA6AC'/><circle cx='120' cy='40' r='18' fill='#EDEDED'/><path d='M0 120 L48 80 L84 112 L116 86 L160 120 L160 160 L0 160 Z' fill='#5A646B'/></svg>");

export default function ChatWeb() {
  const t = useTheme();
  const [chats, setChats] = useState([newChat()]);
  const [activeId, setActiveId] = useState(() => null);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [attachedUri, setAttachedUri] = useState(null);
  const timer = useRef(null);

  // Demo the first-run setup flow (download → load → ready) so the preview shows it.
  const [sim, setSim] = useState({ state: 'downloading', progress: 0, label: 'Downloading 0%' });
  useEffect(() => {
    let p = 0;
    const dl = setInterval(() => {
      p = Math.min(1, p + 0.045);
      setSim({ state: 'downloading', progress: p, label: `Downloading ${Math.round(p * 100)}%` });
      if (p >= 1) {
        clearInterval(dl);
        setSim({ state: 'loading', label: 'Getting ready…' });
        setTimeout(() => setSim({ state: 'ready', label: 'Preview (demo)' }), 2600);
      }
    }, 150);
    return () => clearInterval(dl);
  }, []);

  const id = activeId || chats[0].id;
  const active = chats.find((c) => c.id === id) || chats[0];
  const messages = active.messages || [];

  const setMessages = (msgs) => setChats((cs) => cs.map((c) => c.id === id
    ? { ...c, messages: msgs, title: (!c.title || c.title === 'New chat') ? titleFrom(msgs) : c.title, updatedAt: Date.now() } : c));

  const runStream = (field, full, keepThink, base, done) => {
    const words = full.split(' ');
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      const partial = words.slice(0, i).join(' ');
      const msg = field === 'think'
        ? { role: 'assistant', think: partial, text: '', streaming: true }
        : { role: 'assistant', think: keepThink || '', text: partial, streaming: true };
      setMessages([...base, msg]);
      if (i >= words.length) { clearInterval(timer.current); done && done(); }
    }, 30);
  };

  const stream = (answer, base, think) => {
    setGenerating(true);
    const finish = () => {
      setMessages([...base, { role: 'assistant', think: think || '', text: answer, streaming: false }]);
      setGenerating(false);
    };
    if (think) runStream('think', think, null, base, () => runStream('answer', answer, think, base, finish));
    else runStream('answer', answer, '', base, finish);
  };

  const onSend = () => {
    const text = input.trim();
    if ((!text && !attachedUri) || generating) return;
    const isPhoto = !!attachedUri;
    const base = [...messages, { role: 'user', text: text || '', imageUri: attachedUri }];
    setMessages([...base, { role: 'assistant', text: '', think: '', streaming: true }]);
    setInput(''); setAttachedUri(null);
    setTimeout(() => stream(isPhoto ? DEMO_VISION : DEMO_REPLY, base, isPhoto ? null : DEMO_THINK), 220);
  };

  const onNewChat = () => { const c = newChat(); setChats((cs) => [c, ...cs]); setActiveId(c.id); };
  const onDeleteChat = (cid) => setChats((cs) => { let n = cs.filter((c) => c.id !== cid); if (n.length === 0) n = [newChat()]; if (cid === id) setActiveId(n[0].id); return n; });
  const onClearChats = () => { const c = newChat(); setChats([c]); setActiveId(c.id); };

  return (
    <ChatUI
      t={t}
      messages={messages}
      input={input}
      setInput={setInput}
      onSend={onSend}
      onStop={() => { clearInterval(timer.current); setGenerating(false); }}
      generating={generating}
      status={sim}
      onDownload={() => {}}
      onPickExample={(ex) => setInput(ex)}
      onPickImage={() => setAttachedUri(DEMO_IMG)}
      attachedUri={attachedUri}
      onClearImage={() => setAttachedUri(null)}
      banner="Preview — the real on-device AI runs in the installed app"
      title={active.title}
      chats={chats}
      activeChatId={id}
      onNewChat={onNewChat}
      onOpenChat={(cid) => setActiveId(cid)}
      onDeleteChat={onDeleteChat}
      onClearChats={onClearChats}
    />
  );
}
