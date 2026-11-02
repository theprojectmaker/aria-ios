import { useState, useRef } from 'react';
import ChatUI from './ChatUI';
import { useTheme } from './theme';

const VISION_EXAMPLES = [
  'What’s in this photo?',
  'Read any text you can see.',
  'What should I know about this?',
  'Describe this in one sentence.',
];

const DEMO_IMG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='160' height='160' fill='#BFE3D8'/><rect y='104' width='160' height='56' fill='#7FBBA6'/><circle cx='120' cy='40' r='18' fill='#F4EDE4'/><path d='M0 120 L48 80 L84 112 L116 86 L160 120 L160 160 L0 160 Z' fill='#0E7C6B'/></svg>");

const DEMO_REPLY =
  "This is a **preview** of Aria Vision. On your phone, the on-device vision model actually *looks* at the photo you add and answers questions about it — fully offline, nothing uploaded.\n\nHere I'd describe a sunlit landscape with a bright circle (a sun) above rolling hills.";

export default function VisionWeb() {
  const t = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [attachedUri, setAttachedUri] = useState(null);
  const timer = useRef(null);

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
    if ((!text && !attachedUri) || generating) return;
    const shown = text || "What's in this photo?";
    const base = [...messages, { role: 'user', text: shown, imageUri: attachedUri }];
    setMessages([...base, { role: 'assistant', text: '', streaming: true }]);
    setInput(''); setAttachedUri(null);
    setTimeout(() => stream(DEMO_REPLY, base), 250);
  };

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
      onPickImage={() => setAttachedUri(DEMO_IMG)}
      attachedUri={attachedUri}
      onClearImage={() => setAttachedUri(null)}
      banner="Preview — the real on-device vision AI runs in the installed app"
      title="Vision"
      greetTitle="Ask about a photo"
      greetSub="Add a photo and ask Aria anything about it — all on your phone, nothing uploaded."
      placeholder="Ask about the photo"
      examples={VISION_EXAMPLES}
    />
  );
}
