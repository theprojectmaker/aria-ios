import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import ChatUI from './ChatUI';
import { useTheme } from './theme';

const ENABLED_KEY = 'aria.vision.enabled.v1';

const SYSTEM =
  'You are Aria, looking at the photo the user sends. Answer their question about it clearly and concisely. ' +
  'If no question is given, briefly describe what is in the photo.';

const VISION_EXAMPLES = [
  'What’s in this photo?',
  'Read any text you can see.',
  'What should I know about this?',
  'Describe this in one sentence.',
];

const VISION_DOWNLOAD = {
  title: 'Set up Vision',
  body: 'Download the on-device vision model once so Aria can look at your photos — right on your phone. It needs the internet this one time. After that, it works completely offline.',
  sizeNote: 'About 0.7 GB · stored on your device',
};

class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch() {}
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

function VLModel({ t }) {
  const { models, useLLMChatSession } = require('react-native-executorch');
  const VL = models.llm.LFM2_5_VL_450M.DEFAULT || models.llm.LFM2_5_VL_450M.XNNPACK_8DA4W;
  const llm = useLLMChatSession(VL, {
    initialMessages: [{ role: 'system', content: SYSTEM }],
    generationConfig: { maxNewTokens: 384, temperature: 0.7 },
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [attachedUri, setAttachedUri] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const attachRef = useRef(null);

  const clearAttach = () => { attachRef.current = null; setAttachedUri(null); };

  const status = (() => {
    if (llm.error) return { state: 'unavailable', label: 'Could not load vision model' };
    if (!llm.isReady && (llm.downloadProgress || 0) < 1) return { state: 'downloading', progress: llm.downloadProgress || 0, label: `Downloading ${Math.round((llm.downloadProgress || 0) * 100)}%` };
    if (!llm.isReady) return { state: 'loading', label: 'Loading vision model…' };
    return { state: 'ready', label: preparing ? 'Reading photo…' : 'On-device · ready' };
  })();

  const capture = useCallback(async (mode) => {
    try {
      const IP = require('expo-image-picker');
      if (mode === 'camera') { const p = await IP.requestCameraPermissionsAsync(); if (!p.granted) return; }
      const res = mode === 'camera'
        ? await IP.launchCameraAsync({ quality: 1 })
        : await IP.launchImageLibraryAsync({ mediaTypes: (IP.MediaTypeOptions && IP.MediaTypeOptions.Images) || 'images', quality: 1 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const uri = res.assets[0].uri;
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
    if ((!text && !img) || generating || preparing || !llm.isReady || !llm.sendMessage) return;
    const shown = text || (img ? "What's in this photo?" : '');
    const uri = attachedUri;
    setInput('');
    clearAttach();
    const base = [...messages, { role: 'user', text: shown, imageUri: uri }];
    setMessages([...base, { role: 'assistant', text: '', streaming: true }]);
    setGenerating(true);
    let acc = '';
    try {
      const content = img ? [{ kind: 'image', image: img }, shown] : shown;
      await llm.sendMessage(content, (tok) => {
        acc += tok;
        setMessages([...base, { role: 'assistant', text: acc, streaming: true }]);
      });
    } catch (e) {
      const info = img ? ` [img ${img.width}x${img.height} ${img.format} ${img.data && img.data.length}b]` : '';
      acc = acc || ('⚠️ ' + ((e && e.message) ? e.message : String(e)) + info);
    }
    setMessages([...base, { role: 'assistant', text: acc, streaming: false }]);
    setGenerating(false);
  }, [input, generating, preparing, attachedUri, messages, llm]);

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
      onPickImage={pickImage}
      attachedUri={attachedUri}
      onClearImage={clearAttach}
      canSend={llm.isReady && !preparing}
      title="Vision"
      greetTitle="Ask about a photo"
      greetSub="Add a photo and ask Aria anything about it — all on your phone, nothing uploaded."
      placeholder="Ask about the photo"
      examples={VISION_EXAMPLES}
      download={VISION_DOWNLOAD}
    />
  );
}

export default function VisionNative() {
  const t = useTheme();
  const onVision = (usePathname() || '').startsWith('/vision');
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ENABLED_KEY).then((v) => { if (v === '1') setEnabled(true); setChecked(true); });
  }, []);

  const enable = () => { setEnabled(true); AsyncStorage.setItem(ENABLED_KEY, '1').catch(() => {}); };

  // Only load the vision model while this tab is open, so it never coexists
  // with the chat model (one model at a time = no out-of-memory crash).
  if (!onVision || !checked) {
    return (
      <ChatUI
        t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
        generating={false} status={{ state: 'loading', label: 'Opening…' }}
        onDownload={() => {}} onPickExample={() => {}} title="Vision"
      />
    );
  }

  if (!enabled) {
    return (
      <ChatUI
        t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
        generating={false} status={{ state: 'needs-download', label: 'Vision model not downloaded' }}
        onDownload={enable} onPickExample={() => {}} title="Vision" download={VISION_DOWNLOAD}
      />
    );
  }

  const fallback = (
    <ChatUI
      t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
      generating={false} status={{ state: 'unavailable', label: 'Needs the installed app' }}
      onDownload={() => {}} onPickExample={() => {}} title="Vision"
    />
  );

  return (
    <Boundary fallback={fallback}>
      <VLModel t={t} />
    </Boundary>
  );
}
