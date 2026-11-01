import { useState, useRef } from 'react';
import ChatUI from './ChatUI';
import { useTheme } from './theme';
import { newChat, titleFrom } from './chatStore';

const CHAT_EXAMPLES = [
  'Explain quantum entanglement like I’m five.',
  'Write a warm, short thank-you note to a mentor.',
  'Give me 5 dinner ideas with chicken and rice.',
  'Help me outline a 3-paragraph cover letter.',
];

const DEMO_REPLY =
  "Here's a **preview** of Aria. On your phone I run completely on-device — no internet needed — and I can:\n\n- answer questions and help you write\n- keep your **saved chats**\n- look at **photos** on the Vision tab\n\nInstall Aria to use the real offline AI.";

export default function ChatWeb() {
  const t = useTheme();
  const [chats, setChats] = useState([newChat()]);
  const [activeId, setActiveId] = useState(() => null);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const timer = useRef(null);

  const id = activeId || chats[0].id;
  const active = chats.find((c) => c.id === id) || chats[0];
  const messages = active.messages || [];

  const setMessages = (msgs) => setChats((cs) => cs.map((c) => c.id === id
    ? { ...c, messages: msgs, title: (!c.title || c.title === 'New chat') ? titleFrom(msgs) : c.title, updatedAt: Date.now() } : c));

  const stream = (full, base) => {
    const words = full.split(' ');
    let i = 0;
    setGenerating(true);
    timer.current = setInterval(() => {
      i += 1;
      setMessages([...base, { role: 'assistant', text: words.slice(0, i).join(' '), streaming: i < words.length }]);
      if (i >= words.length) { clearInterval(timer.current); setGenerating(false); }
    }, 40);
  };

  const onSend = () => {
    const text = input.trim();
    if (!text || generating) return;
    const base = [...messages, { role: 'user', text }];
    setMessages([...base, { role: 'assistant', text: '', streaming: true }]);
    setInput('');
    setTimeout(() => stream(DEMO_REPLY, base), 250);
  };

  const onNewChat = () => { const c = newChat(); setChats((cs) => [c, ...cs]); setActiveId(c.id); };
  const onDeleteChat = (cid) => setChats((cs) => { let n = cs.filter((c) => c.id !== cid); if (n.length === 0) n = [newChat()]; if (cid === id) setActiveId(n[0].id); return n; });

  return (
    <ChatUI
      t={t}
      messages={messages}
      input={input}
      setInput={setInput}
      onSend={onSend}
      onStop={() => { clearInterval(timer.current); setGenerating(false); }}
      generating={generating}
      status={{ state: 'ready', label: 'Preview (demo)' }}
      onDownload={() => {}}
      onPickExample={(ex) => setInput(ex)}
      banner="Preview — the real on-device AI runs in the installed app"
      title={active.title}
      greetTitle="How can I help?"
      examples={CHAT_EXAMPLES}
      chats={chats}
      activeChatId={id}
      onNewChat={onNewChat}
      onOpenChat={(cid) => setActiveId(cid)}
      onDeleteChat={onDeleteChat}
    />
  );
}
