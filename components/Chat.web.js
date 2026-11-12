import { useState, useRef, useEffect } from 'react';
import ChatUI from './ChatUI';
import { useTheme } from './theme';
import { newChat, titleFrom } from './chatStore';
import { route, calc, mathAnswer } from './brain';
import { catalogEntry } from './catalog';

/* Web preview: the real UI with a simulated model, so the layout, the setup
   flow, thinking, sources and the exact calculator can all be seen here. */

const DEMO_THINK = 'The user is asking about the speed of light. The reference note gives the exact value, so I should state it clearly with units, then add one helpful comparison.';
const DEMO_REPLY = 'Light travels at **299,792,458 metres per second** in a vacuum — about **186,282 miles per second**.\n\n- That is fast enough to circle Earth about **7.5 times in one second**.\n- Sunlight takes about **8 minutes 20 seconds** to reach us.\n\nNothing with mass can reach this speed; it is the universal speed limit in physics.';
const DEMO_WORKSHEET = '**1.** 3x + 5 = 20 → 3x = 15 → **x = 5**\n\n**2.** Area of a triangle = ½ × 8 × 6 = **24 cm²**\n\n**3.** 15% of 80 = **12**';
const DEMO_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='160' height='200'><rect width='160' height='200' fill='#F4F1EA'/><g fill='#333' font-family='Arial' font-size='11'><text x='12' y='28'>Worksheet 4</text><text x='12' y='60'>1. 3x + 5 = 20</text><text x='12' y='88'>2. Area: b=8, h=6</text><text x='12' y='116'>3. 15% of 80</text></g></svg>");

export default function ChatWeb() {
  const t = useTheme();
  const [chats, setChats] = useState(() => {
    const a = newChat();
    const b = { ...newChat(), id: 'demo-old', title: 'Photosynthesis basics', updatedAt: Date.now() - 3 * 86400000, messages: [{ role: 'user', text: 'Explain photosynthesis' }, { role: 'assistant', text: 'Plants turn **light, water and CO₂** into glucose and oxygen.', model: 'Aria', sources: ['Photosynthesis'] }] };
    return [a, b];
  });
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [attachedUri, setAttachedUri] = useState(null);
  const timer = useRef(null);
  const model = catalogEntry('qwen3-1.7b');

  const [sim, setSim] = useState({ state: 'downloading', progress: 0, label: 'Downloading Aria 0%', model });
  useEffect(() => {
    let p = 0;
    const dl = setInterval(() => {
      p = Math.min(1, p + 0.06);
      setSim({ state: 'downloading', progress: p, label: `Downloading Aria ${Math.round(p * 100)}%`, model });
      if (p >= 1) {
        clearInterval(dl);
        setSim({ state: 'loading', label: 'Getting ready…', model });
        setTimeout(() => setSim({ state: 'ready', label: 'Preview · simulated model', model }), 1500);
      }
    }, 120);
    return () => clearInterval(dl);
  }, []);

  const id = activeId || chats[0].id;
  const active = chats.find((c) => c.id === id) || chats[0];
  const messages = active.messages || [];
  const setMessages = (msgs) => setChats((cs) => cs.map((c) => c.id === id
    ? { ...c, messages: msgs, title: (!c.title || c.title === 'New chat') ? titleFrom(msgs) : c.title, updatedAt: Date.now() } : c));

  const stream = (base, answer, think, extra) => {
    setGenerating(true);
    const steps = [];
    if (think) think.split(' ').forEach((_, i, w) => steps.push({ think: w.slice(0, i + 1).join(' '), text: '' }));
    answer.split(' ').forEach((_, i, w) => steps.push({ think: think || '', text: w.slice(0, i + 1).join(' ') }));
    let i = 0;
    timer.current = setInterval(() => {
      const st = steps[i++];
      setMessages([...base, { role: 'assistant', ...st, streaming: true }]);
      if (i >= steps.length) {
        clearInterval(timer.current);
        setMessages([...base, { role: 'assistant', think: think || '', text: answer, streaming: false, model: 'Aria', secs: 2.4, ...extra }]);
        setGenerating(false);
      }
    }, 28);
  };

  const onSend = () => {
    const text = input.trim();
    if ((!text && !attachedUri) || generating) return;
    const base = [...messages, { role: 'user', text: text || '', imageUri: attachedUri }];
    setInput('');
    if (attachedUri) { setAttachedUri(null); setMessages([...base, { role: 'assistant', text: '', streaming: true }]); setTimeout(() => stream(base, DEMO_WORKSHEET, 'Three problems: a linear equation, a triangle area, and a percentage. Solve each.', {}), 300); return; }
    const r = route(text);
    if (r.kind === 'math') { const c = calc(text); if (c) { setMessages([...base, { role: 'assistant', text: mathAnswer(c), model: 'Calculator' }]); return; } }
    setMessages([...base, { role: 'assistant', text: '', streaming: true }]);
    setTimeout(() => stream(base, DEMO_REPLY, r.think || /why|how/i.test(text) ? DEMO_THINK : '', { sources: ['Speed of light', 'Light year'] }), 300);
  };

  const onNewChat = () => { if (!messages.length) return; const c = newChat(); setChats((cs) => [c, ...cs]); setActiveId(c.id); };
  const onDeleteChat = (cid) => setChats((cs) => { let n = cs.filter((c) => c.id !== cid); if (n.length === 0) n = [newChat()]; if (cid === id) setActiveId(n[0].id); return n; });
  const onClearChats = () => { const c = newChat(); setChats([c]); setActiveId(c.id); };

  return (
    <ChatUI
      t={t} messages={messages} input={input} setInput={setInput} onSend={onSend}
      onStop={() => { clearInterval(timer.current); setGenerating(false); }}
      onRegenerate={(i) => { const prior = messages.slice(0, i); stream(prior, DEMO_REPLY, '', { sources: ['Speed of light'] }); }}
      generating={generating} status={sim} onDownload={() => {}}
      onPickExample={(ex) => setInput(ex)} onPickImage={() => setAttachedUri(DEMO_IMG)}
      attachedUri={attachedUri} onClearImage={() => setAttachedUri(null)}
      title={active.title} chats={chats} activeChatId={id}
      onNewChat={onNewChat} onOpenChat={(cid) => setActiveId(cid)} onDeleteChat={onDeleteChat} onClearChats={onClearChats}
    />
  );
}
