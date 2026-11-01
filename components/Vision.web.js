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
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#5E5CE6'/><stop offset='1' stop-color='#AF52DE'/></linearGradient></defs><rect width='160' height='160' fill='url(#g)'/><circle cx='56' cy='54' r='20' fill='#fff' opacity='0.95'/><path d='M14 150 L64 92 L96 128 L118 104 L150 150 Z' fill='#fff' opacity='0.9'/></svg>");

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
