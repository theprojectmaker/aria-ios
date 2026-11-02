import { useState, useRef } from 'react';
import ChatUI from './ChatUI';
import { useTheme } from './theme';

const DEMO_IMG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='160' height='160' fill='#BFE3D8'/><rect y='104' width='160' height='56' fill='#7FBBA6'/><circle cx='120' cy='40' r='18' fill='#F4EDE4'/><path d='M0 120 L48 80 L84 112 L116 86 L160 120 L160 160 L0 160 Z' fill='#0E7C6B'/></svg>");

const DEMO_REPLY =
  "I can see **lakeside** (86% sure) — it might also be valley, mountain, seashore.\n\n**Text I can read:**\nNORTH TRAIL\n2.4 mi\n\n*(Preview — on your phone Aria identifies photos and reads text fully offline.)*";

export default function VisionWeb() {
  const t = useTheme();
  const [messages, setMessages] = useState([]);
  const [attachedUri, setAttachedUri] = useState(null);
  const [generating, setGenerating] = useState(false);
  const timer = useRef(null);

  const onSend = () => {
    if (!attachedUri || generating) return;
    const base = [...messages, { role: 'user', text: '', imageUri: attachedUri }];
    setMessages([...base, { role: 'assistant', text: '', streaming: true }]);
    setAttachedUri(null);
    setGenerating(true);
    timer.current = setTimeout(() => {
      setMessages([...base, { role: 'assistant', text: DEMO_REPLY, streaming: false }]);
      setGenerating(false);
    }, 650);
  };

  return (
    <ChatUI
      t={t}
      messages={messages}
      input=""
      setInput={() => {}}
      onSend={onSend}
      onStop={() => { clearTimeout(timer.current); setGenerating(false); }}
      generating={generating}
      status={{ state: 'ready', label: 'Preview (demo)' }}
      onDownload={() => {}}
      onPickExample={() => {}}
      onPickImage={() => setAttachedUri(DEMO_IMG)}
      attachedUri={attachedUri}
      onClearImage={() => setAttachedUri(null)}
      canSend={!!attachedUri}
      banner="Preview — the real on-device vision AI runs in the installed app"
      title="Vision"
      greetTitle="Point at anything"
      greetSub="Add a photo and Aria will tell you what’s in it and read any text — all on your phone, nothing uploaded."
      placeholder="Add a photo to analyze"
      examples={[]}
    />
  );
}
